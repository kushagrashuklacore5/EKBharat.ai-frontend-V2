"""Download / pin model weights into backend/app/models/.

Phase 1 needs only the YOLO11-pose weights (MediaPipe Face Mesh ships inside the
mediapipe wheel, so no download is required for landmarks/iris). Phase 2+ models are
listed with their sources and are downloaded by later phases.

Usage:
    python scripts/download_models.py                # pose weights
    python scripts/download_models.py --all          # + print Phase 2 sources
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make `app` importable when run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

PHASE2_SOURCES = {
    "6DRepNet (head pose, ONNX)":
        "https://github.com/thohemp/6DRepNet  (export to ONNX via export_onnx.py)",
    "L2CS-Net (gaze, ONNX)":
        "https://github.com/Ahmednull/L2CS-Net  (ONNX export)",
    "HSEmotion (emotion, ONNX)":
        "https://github.com/av-savchenko/face-emotion-recognition",
    "ArcFace / buffalo_l (identity)":
        "insightface model zoo: FaceAnalysis(name='buffalo_l')  -- CHECK LICENCE",
    "SCRFD (face det)":
        "insightface buffalo_l det_10g.onnx",
    "YOLO11s (objects)":
        "ultralytics: YOLO('yolo11s.pt')  -- AGPL-3.0, see LICENSES.md",
}


BUFFALO_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"


def _download_yolo(name: str) -> None:
    models_dir: Path = settings.models_dir
    models_dir.mkdir(parents=True, exist_ok=True)
    target = models_dir / name
    if target.exists():
        print(f"[ok] {name} already present")
        return
    print(f"[..] downloading {name} via ultralytics ...")
    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit("ultralytics not installed. Run: pip install -r requirements.txt")
    model = YOLO(name)
    ckpt = Path(model.ckpt_path) if getattr(model, "ckpt_path", None) else None
    if ckpt and ckpt.exists():
        import shutil
        shutil.copy2(ckpt, target)
        print(f"[ok] pinned -> {target}")
    else:
        print(f"[warn] could not pin {name}; Ultralytics will auto-load by name.")


def download_pose() -> None:
    _download_yolo(settings.POSE_MODEL)


def download_objects() -> None:
    _download_yolo(settings.OBJECT_MODEL)


def download_buffalo() -> None:
    """SCRFD (det_10g) + ArcFace (w600k_r50) from the InsightFace buffalo_l pack."""
    import urllib.request
    import zipfile

    models_dir: Path = settings.models_dir
    out = models_dir / "buffalo_l"
    if (out / "det_10g.onnx").exists() and (out / "w600k_r50.onnx").exists():
        print(f"[ok] buffalo_l (SCRFD + ArcFace) already present in {out}")
        return
    out.mkdir(parents=True, exist_ok=True)
    zip_path = models_dir / "buffalo_l.zip"
    print(f"[..] downloading buffalo_l (~280MB) from {BUFFALO_URL} ...")
    urllib.request.urlretrieve(BUFFALO_URL, zip_path)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out)
    print(f"[ok] extracted buffalo_l -> {out}  (CHECK ARCFACE LICENCE, see LICENSES.md)")


def main() -> None:
    ap = argparse.ArgumentParser(description="Download proctoring model weights")
    ap.add_argument("--all", action="store_true", help="also print Phase 2 model sources")
    ap.add_argument("--antispoof", action="store_true",
                    help="print steps to enable the passive MiniFASNet anti-spoof CNN")
    args = ap.parse_args()

    if args.antispoof:
        print("Passive anti-spoof (optional -- the active blink/head-turn challenge works "
              "without it):\n"
              "  1. Clone github.com/minivision-ai/Silent-Face-Anti-Spoofing\n"
              "  2. Its resources/anti_spoof_models/*.pth are MiniFASNet weights.\n"
              "  3. Convert one to ONNX (80x80 input, 3-class output) and save as\n"
              f"     {settings.model_path(settings.SPOOF_MODEL)}\n"
              "  4. Restart the backend -> capability 'antispoof' becomes 'cnn'.\n"
              "  Licence: MIT. Verify before commercial use (see LICENSES.md).")
        return

    download_pose()
    print("[ok] MediaPipe Face Mesh (478 landmarks + iris) ships in the mediapipe wheel "
          "-- no download needed.")
    print("[ok] HSEmotion (emotion) auto-downloads via the hsemotion-onnx package.")

    if args.all:
        download_objects()
        download_buffalo()
        print("\n[info] 6DRepNet (head pose) + L2CS-Net (gaze) ONNX are produced by "
              "scripts/export_onnx.py. Without them the pipeline uses the geometric "
              "head-pose/gaze estimators (clearly labelled).")
        print("\nRemaining Phase 2+ model sources:")
        for name, src in PHASE2_SOURCES.items():
            print(f"  - {name}\n      {src}")


if __name__ == "__main__":
    main()
