"""Evaluate the exported temporal model (ONNX) with the metrics the spec requires.

Reports per-class precision/recall/F1, a confusion matrix over the dominant class, the
two headline metrics -- **false alerts per exam-hour on normal-only sessions** (target
< 0.5) and **recall on cheating scenarios** (target > 0.90) -- and inference latency.

Usage:
    python training/evaluate.py                     # held-out synthetic persons
    python training/evaluate.py --recorded data/features
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent / "backend"))
from app.pipeline.features import TEMPORAL_CLASSES  # noqa: E402

MODELS_DIR = ROOT.parent / "backend" / "app" / "models"


def _session(onnx, X, batch=256):
    inp = onnx.get_inputs()[0].name
    out = []
    for s in range(0, len(X), batch):
        out.append(onnx.run(None, {inp: X[s:s + batch].astype(np.float32)})[0])
    return 1 / (1 + np.exp(-np.concatenate(out)))   # sigmoid


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--recorded", type=str)
    ap.add_argument("--persons", type=int, default=20)
    ap.add_argument("--thresh", type=float, default=0.5)
    args = ap.parse_args()

    import onnxruntime as ort
    path = MODELS_DIR / "temporal_model.onnx"
    if not path.exists():
        sys.exit("No temporal_model.onnx. Train it first: python training/train_temporal.py")
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])

    if args.recorded:
        from datasets.real import load_recorded
        data = load_recorded(args.recorded)
    else:
        from datasets.synthetic import build_dataset
        # held-out seed so eval persons differ from training
        data = build_dataset(num_persons=args.persons, seed=999)
    X, Y = data["X"], data["Y"]
    probs = _session(sess, X)
    pred = (probs >= args.thresh).astype(np.float32)
    C = len(TEMPORAL_CLASSES)

    print("\n=== Per-class precision / recall / F1 ===")
    print(f"{'class':<24}{'P':>7}{'R':>7}{'F1':>7}{'support':>9}")
    for i, c in enumerate(TEMPORAL_CLASSES):
        tp = float((pred[:, i] * Y[:, i]).sum())
        fp = float((pred[:, i] * (1 - Y[:, i])).sum())
        fn = float(((1 - pred[:, i]) * Y[:, i]).sum())
        prec = tp / (tp + fp + 1e-9); rec = tp / (tp + fn + 1e-9)
        f1 = 2 * prec * rec / (prec + rec + 1e-9)
        print(f"{c:<24}{prec:7.3f}{rec:7.3f}{f1:7.3f}{int(Y[:, i].sum()):9d}")

    # --- Confusion over the dominant (argmax) class ---
    print("\n=== Confusion (dominant class, rows=true cols=pred) ===")
    yt = Y.argmax(1); yp = probs.argmax(1)
    cm = np.zeros((C, C), int)
    for a, b in zip(yt, yp):
        cm[a, b] += 1
    hdr = "".join(f"{i:>5}" for i in range(C))
    print(f"{'true/pred':<22}{hdr}")
    for i, c in enumerate(TEMPORAL_CLASSES):
        print(f"{i} {c:<20}" + "".join(f"{cm[i, j]:>5}" for j in range(C)))

    # --- Headline: recall on cheating scenarios (any suspicious label) ---
    susp = [i for i, c in enumerate(TEMPORAL_CLASSES) if c != "normal"]
    true_susp = Y[:, susp].max(1) > 0.5
    pred_susp = pred[:, susp].max(1) > 0.5
    recall_cheat = float((pred_susp & true_susp).sum() / max(true_susp.sum(), 1))
    print(f"\nRecall on cheating windows: {recall_cheat:.3f}  (target > 0.90)")

    # --- Headline: false alerts per exam-hour on NORMAL-ONLY sessions ---
    from datasets.synthetic import PersonProfile, _segment, make_windows
    master = np.random.default_rng(321)
    fp_alerts, total_windows = 0, 0
    fps, window, stride = 10, 50, 5
    for _ in range(args.persons):
        rng = np.random.default_rng(master.integers(1 << 30))
        p = PersonProfile.random(rng)
        f, l = _segment("normal", 60 * fps, p)      # 60s of pure normal
        Xn, _ = make_windows(f, l, window, stride)
        pn = _session(sess, Xn)
        alerts = (pn[:, susp].max(1) >= args.thresh).sum()
        fp_alerts += int(alerts); total_windows += len(Xn)
    sec_per_window = stride / fps
    hours = total_windows * sec_per_window / 3600.0
    fa_per_hour = fp_alerts / max(hours, 1e-9)
    print(f"False alerts / exam-hour (normal-only): {fa_per_hour:.2f}  (target < 0.5)")

    # --- Latency ---
    x1 = X[:1].astype(np.float32)
    inp = sess.get_inputs()[0].name
    for _ in range(5):
        sess.run(None, {inp: x1})
    t0 = time.perf_counter()
    for _ in range(50):
        sess.run(None, {inp: x1})
    print(f"\nTemporal inference latency: {(time.perf_counter()-t0)/50*1000:.2f} ms/window (CPU)")


if __name__ == "__main__":
    main()
