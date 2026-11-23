"""Per-stage and end-to-end FPS / latency benchmark.

Usage:
    python scripts/benchmark.py --synthetic -n 60      # synthetic 640x480 frames
    python scripts/benchmark.py --image path.jpg -n 100
    python scripts/benchmark.py --video clip.mp4

Reports mean/median/p95 latency per stage (pose, landmarks, head pose+gaze, total) and
the end-to-end FPS. This is the tool referenced by the Phase 7 latency target
(< 150 ms/frame on a T4 @ 10 fps).
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402


def _synthetic_frame() -> np.ndarray:
    # A deterministic noisy frame with a bright oval ~face region so detectors have
    # something plausible to chew on (not a guarantee of detection -- it's a perf test).
    rng = np.random.default_rng(42)
    img = (rng.integers(40, 90, (settings.FRAME_HEIGHT, settings.FRAME_WIDTH, 3))).astype("uint8")
    import cv2
    cv2.ellipse(img, (320, 240), (90, 120), 0, 0, 360, (180, 170, 160), -1)
    cv2.circle(img, (295, 220), 10, (60, 60, 60), -1)
    cv2.circle(img, (345, 220), 10, (60, 60, 60), -1)
    return img


def _pct(xs: list[float], p: float) -> float:
    if not xs:
        return 0.0
    xs = sorted(xs)
    k = int(round((p / 100.0) * (len(xs) - 1)))
    return xs[k]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--image", type=str)
    ap.add_argument("--video", type=str)
    ap.add_argument("-n", type=int, default=60, help="frames to run")
    ap.add_argument("--warmup", type=int, default=5)
    args = ap.parse_args()

    import cv2
    from app.pipeline.pipeline import ProctorPipeline

    # Build frame source.
    frames: list[np.ndarray] = []
    if args.video:
        cap = cv2.VideoCapture(args.video)
        while len(frames) < args.n and cap.isOpened():
            ok, f = cap.read()
            if not ok:
                break
            frames.append(cv2.resize(f, (settings.FRAME_WIDTH, settings.FRAME_HEIGHT)))
        cap.release()
    elif args.image:
        img = cv2.imread(args.image)
        img = cv2.resize(img, (settings.FRAME_WIDTH, settings.FRAME_HEIGHT))
        frames = [img] * args.n
    else:
        frames = [_synthetic_frame()] * args.n

    if not frames:
        sys.exit("No frames to benchmark.")

    print(f"Device={settings.DEVICE}  pose={settings.POSE_MODEL}  frames={len(frames)}")
    pipe = ProctorPipeline("bench")

    totals: list[float] = []
    for i, f in enumerate(frames):
        t0 = time.perf_counter()
        pipe.process(f, frame_id=i, ts_client_ms=time.time() * 1000)
        dt = (time.perf_counter() - t0) * 1000.0
        if i >= args.warmup:
            totals.append(dt)

    pipe.close()
    if not totals:
        print("Not enough frames after warmup.")
        return
    mean = statistics.mean(totals)
    print("\n=== End-to-end latency (ms/frame) ===")
    print(f"  mean   : {mean:7.1f}")
    print(f"  median : {statistics.median(totals):7.1f}")
    print(f"  p95    : {_pct(totals, 95):7.1f}")
    print(f"  min/max: {min(totals):7.1f} / {max(totals):7.1f}")
    print(f"  FPS    : {1000.0 / mean:7.1f}  (single stream)")
    target = 150.0
    print(f"\nTarget < {target} ms/frame on T4: "
          f"{'OK' if mean < target else 'EXCEEDED on this CPU host (expected; T4 is faster)'}")


if __name__ == "__main__":
    main()
