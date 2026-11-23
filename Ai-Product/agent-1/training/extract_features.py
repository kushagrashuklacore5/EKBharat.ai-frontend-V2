"""Run the FROZEN live pipeline over recorded videos -> per-frame feature sequences.

This guarantees train/serve parity: the trainer sees exactly the vectors the live system
emits. Labels come from a scenario timeline (produced by labeling/record_tool's scenario
mode, or hand-labelled in Label Studio).

Inputs per session:
  video.mp4
  labels.json : {"person_id": 3, "fps": 10,
                 "segments": [{"start": 0.0, "end": 8.0, "class": "normal"},
                              {"start": 8.0, "end": 14.0, "class": "phone_use"}, ...]}

Output: data/features/<name>.npz  with arrays features (N,F), labels (N,C), person_id.

Usage:
    python training/extract_features.py --video s1.mp4 --labels s1.json --out data/features
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))
from app.config import settings                                   # noqa: E402
from app.pipeline.features import TEMPORAL_CLASSES                # noqa: E402
from app.pipeline.pipeline import ProctorPipeline                 # noqa: E402

CLS = {c: i for i, c in enumerate(TEMPORAL_CLASSES)}


def _label_at(t: float, segments: list[dict]) -> np.ndarray:
    y = np.zeros(len(TEMPORAL_CLASSES), dtype=np.float32)
    active = [s["class"] for s in segments if s["start"] <= t < s["end"]]
    if not active:
        active = ["normal"]
    for c in active:
        if c in CLS:
            y[CLS[c]] = 1.0
    if not any(c != "normal" for c in active):
        y[CLS["normal"]] = 1.0
    return y


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--out", default="data/features")
    args = ap.parse_args()

    meta = json.loads(Path(args.labels).read_text())
    person_id = int(meta.get("person_id", 0))
    segments = meta["segments"]
    target_fps = int(meta.get("fps", settings.TARGET_FPS))

    cap = cv2.VideoCapture(args.video)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or target_fps
    step = max(1, int(round(src_fps / target_fps)))

    pipe = ProctorPipeline(f"extract-{Path(args.video).stem}")
    feats, labels = [], []
    idx, kept = 0, 0
    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            frame = cv2.resize(frame, (settings.FRAME_WIDTH, settings.FRAME_HEIGHT))
            t = kept / target_fps
            pipe.process(frame, kept, t * 1000.0)
            feats.append(pipe.last_feature.copy())
            labels.append(_label_at(t, segments))
            kept += 1
        idx += 1
    cap.release()
    pipe.close()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{Path(args.video).stem}.npz"
    np.savez_compressed(out_path, features=np.asarray(feats, np.float32),
                        labels=np.asarray(labels, np.float32), person_id=person_id)
    print(f"[ok] {kept} frames -> {out_path}")


if __name__ == "__main__":
    main()
