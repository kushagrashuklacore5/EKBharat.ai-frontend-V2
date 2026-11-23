"""Export head-pose / gaze models to ONNX for runtime use by ONNX Runtime.

6DRepNet: exported from the `sixdrepnet` package's trained model (auto-downloaded).
L2CS-Net: requires the Gaze360 checkpoint (manual download from the L2CS-Net repo); the
exporter is provided and documented -- point it at the .pkl to produce l2cs.onnx.

Usage:
    python scripts/export_onnx.py --sixdrepnet
    python scripts/export_onnx.py --l2cs path/to/L2CSNet_gaze360.pkl
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import settings  # noqa: E402


def export_sixdrepnet() -> None:
    try:
        import torch
        from sixdrepnet.model import SixDRepNet as SixDRepNetModel
        from sixdrepnet import SixDRepNet
    except ImportError as exc:
        sys.exit(f"sixdrepnet/torch not installed: {exc}. pip install sixdrepnet torch")

    out = settings.model_path(settings.HEADPOSE_MODEL)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Load the trained weights via the high-level wrapper, then export the inner module.
    wrapper = SixDRepNet(gpu_id=-1)
    model = wrapper.model if hasattr(wrapper, "model") else wrapper
    model.eval()
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model, dummy, str(out), input_names=["input"], output_names=["rotation"],
        dynamic_axes={"input": {0: "batch"}, "rotation": {0: "batch"}}, opset_version=17,
    )
    print(f"[ok] exported 6DRepNet -> {out}")


def export_l2cs(ckpt: str) -> None:
    try:
        import torch
        import torchvision
    except ImportError as exc:
        sys.exit(f"torch/torchvision not installed: {exc}")
    ckpt_path = Path(ckpt)
    if not ckpt_path.exists():
        sys.exit(f"L2CS checkpoint not found: {ckpt_path}\n"
                 "Download L2CSNet_gaze360.pkl from https://github.com/Ahmednull/L2CS-Net")
    # L2CS-Net = ResNet50 backbone with two FC heads (yaw, pitch) over 90 bins.
    from torchvision.models import resnet50
    import torch.nn as nn

    class L2CS(nn.Module):
        def __init__(self, num_bins=90):
            super().__init__()
            base = resnet50()
            self.backbone = nn.Sequential(*list(base.children())[:-1])
            self.fc_yaw = nn.Linear(2048, num_bins)
            self.fc_pitch = nn.Linear(2048, num_bins)

        def forward(self, x):
            f = self.backbone(x).flatten(1)
            return self.fc_yaw(f), self.fc_pitch(f)

    model = L2CS()
    sd = torch.load(ckpt_path, map_location="cpu")
    model.load_state_dict(sd, strict=False)
    model.eval()
    out = settings.model_path(settings.GAZE_MODEL)
    dummy = torch.randn(1, 3, 448, 448)
    torch.onnx.export(
        model, dummy, str(out), input_names=["input"],
        output_names=["yaw", "pitch"], opset_version=17,
    )
    print(f"[ok] exported L2CS -> {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sixdrepnet", action="store_true")
    ap.add_argument("--l2cs", type=str, help="path to L2CSNet_gaze360.pkl")
    args = ap.parse_args()
    if args.sixdrepnet:
        export_sixdrepnet()
    if args.l2cs:
        export_l2cs(args.l2cs)
    if not args.sixdrepnet and not args.l2cs:
        ap.print_help()


if __name__ == "__main__":
    main()
