"""Train the temporal cheating Transformer and export it to ONNX for live hot-swap.

- Split TRAIN/VAL/TEST **by person** (no identity leakage).
- Multi-label focal loss (handles class imbalance; exam data is mostly 'normal').
- Early stopping on val macro-F1.
- Exports best model to backend/app/models/temporal_model.onnx + a metrics JSON + model card.

Usage:
    python training/train_temporal.py                    # bootstrap on synthetic data
    python training/train_temporal.py --recorded data/features   # on real recordings
    python training/train_temporal.py --persons 60 --epochs 40
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent / "backend"))
from model import TemporalTransformer                                  # noqa: E402
from app.pipeline.features import FEATURE_DIM, TEMPORAL_CLASSES        # noqa: E402

MODELS_DIR = ROOT.parent / "backend" / "app" / "models"


def split_by_person(data: dict, seed: int = 0):
    persons = np.unique(data["person"])
    rng = np.random.default_rng(seed)
    rng.shuffle(persons)
    n = len(persons)
    tr = set(persons[: int(0.7 * n)])
    va = set(persons[int(0.7 * n): int(0.85 * n)])
    masks = {
        "train": np.isin(data["person"], list(tr)),
        "val": np.isin(data["person"], list(va)),
        "test": ~np.isin(data["person"], list(tr | va)),
    }
    return {k: (data["X"][m], data["Y"][m]) for k, m in masks.items()}


def focal_bce(logits, targets, alpha, gamma=2.0):
    """Multi-label focal loss with per-class positive weight `alpha`."""
    p = torch.sigmoid(logits)
    ce = nn.functional.binary_cross_entropy_with_logits(logits, targets, reduction="none")
    p_t = p * targets + (1 - p) * (1 - targets)
    w = alpha * targets + (1 - targets)
    return (w * (1 - p_t).pow(gamma) * ce).mean()


def macro_f1(logits, targets, thresh=0.5):
    pred = (torch.sigmoid(logits) >= thresh).float()
    tp = (pred * targets).sum(0)
    fp = (pred * (1 - targets)).sum(0)
    fn = ((1 - pred) * targets).sum(0)
    f1 = (2 * tp) / (2 * tp + fp + fn + 1e-9)
    return f1.mean().item(), f1.cpu().numpy()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--recorded", type=str, help="dir of recorded .npz feature files")
    ap.add_argument("--persons", type=int, default=48)
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--window", type=int, default=50)
    ap.add_argument("--patience", type=int, default=6)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    if args.recorded:
        from datasets.real import load_recorded
        data = load_recorded(args.recorded, window=args.window)
        source = f"recorded:{args.recorded}"
    else:
        from datasets.synthetic import build_dataset
        data = build_dataset(num_persons=args.persons, window=args.window, seed=args.seed)
        source = f"synthetic:{args.persons}persons"
    print(f"[data] {source}  windows={len(data['X'])}  dim={data['X'].shape[-1]}")

    sp = split_by_person(data, seed=args.seed)
    for k, (X, Y) in sp.items():
        print(f"  {k}: {len(X)} windows")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    def loader(split, shuffle):
        X, Y = sp[split]
        return DataLoader(TensorDataset(torch.tensor(X), torch.tensor(Y)),
                          batch_size=args.batch, shuffle=shuffle)
    train_dl, val_dl = loader("train", True), loader("val", False)

    # per-class positive weight = neg/pos (clamped), to fight imbalance
    Ytr = sp["train"][1]
    pos = Ytr.sum(0) + 1e-6
    alpha = torch.tensor(np.clip((len(Ytr) - pos) / pos, 1.0, 20.0), dtype=torch.float32).to(device)

    model = TemporalTransformer(feature_dim=FEATURE_DIM).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)

    best_f1, best_state, since = -1.0, None, 0
    for epoch in range(args.epochs):
        model.train()
        for xb, yb in train_dl:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            loss = focal_bce(model(xb), yb, alpha)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        sched.step()

        model.eval()
        with torch.no_grad():
            vlog = torch.cat([model(xb.to(device)).cpu() for xb, _ in val_dl])
            vtar = torch.cat([yb for _, yb in val_dl])
        f1, _ = macro_f1(vlog, vtar)
        print(f"epoch {epoch+1:02d}/{args.epochs}  val_macroF1={f1:.3f}")
        if f1 > best_f1:
            best_f1, best_state, since = f1, {k: v.cpu().clone() for k, v in model.state_dict().items()}, 0
        else:
            since += 1
            if since >= args.patience:
                print(f"[early stop] no val improvement for {args.patience} epochs")
                break

    model.load_state_dict(best_state)

    # --- Test metrics ---
    model.eval()
    Xte, Yte = sp["test"]
    with torch.no_grad():
        tlog = model(torch.tensor(Xte).to(device)).cpu()
    test_f1, per_class = macro_f1(tlog, torch.tensor(Yte))
    print(f"[test] macro-F1 ={test_f1:.3f}")

    # --- Export ONNX + metadata ---
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(best_state, MODELS_DIR / "temporal_model.pt")   # keep weights for re-export
    onnx_path = MODELS_DIR / "temporal_model.onnx"
    dummy = torch.randn(1, args.window, FEATURE_DIM)
    torch.onnx.export(
        model.cpu(), dummy, str(onnx_path), input_names=["window"],
        output_names=["logits"], opset_version=17,   # >=13 for aten::unflatten (Transformer)
        dynamic_axes={"window": {0: "batch"}, "logits": {0: "batch"}},
    )
    version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    metrics = {
        "version": version, "source": source, "window": args.window,
        "feature_dim": FEATURE_DIM, "classes": TEMPORAL_CLASSES,
        "val_macro_f1": round(best_f1, 4), "test_macro_f1": round(test_f1, 4),
        "per_class_f1": {c: round(float(x), 4) for c, x in zip(TEMPORAL_CLASSES, per_class)},
        "n_train": int(len(sp["train"][0])), "n_test": int(len(Xte)),
    }
    (MODELS_DIR / "temporal_model.metrics.json").write_text(json.dumps(metrics, indent=2))
    _write_model_card(MODELS_DIR / "temporal_model.card.md", metrics, source)
    print(f"[ok] exported {onnx_path}")
    print(f"[ok] metrics -> temporal_model.metrics.json (test macro-F1 {test_f1:.3f})")
    print("     Restart the backend; the pipeline hot-swaps from BASELINE to this model.")


def _write_model_card(path: Path, metrics: dict, source: str) -> None:
    card = f"""# Temporal cheating model -- card

- **Version:** {metrics['version']}
- **Source:** {source}
- **Window:** {metrics['window']} frames (5s @ 10fps), feature dim {metrics['feature_dim']}
- **Classes:** {', '.join(metrics['classes'])}
- **Test macro-F1:** {metrics['test_macro_f1']}  (val {metrics['val_macro_f1']})
- **Per-class F1:** {metrics['per_class_f1']}

## Intended use
Smooths per-frame proctoring features into per-second multi-label cheating signals that
feed risk.py. A human proctor makes every final decision; this model only flags.

## Caveats
If `source` is synthetic, this is a BOOTSTRAP to prove the pipeline and provide temporal
smoothing -- NOT production truth. Retrain on real recorded sessions (labeling/record_tool
-> extract_features.py -> --recorded) and re-evaluate (false-alerts/hour < 0.5, recall
> 0.90) before relying on it.
"""
    path.write_text(card, encoding="utf-8")


if __name__ == "__main__":
    main()
