"""Prohibited / neutral object detection via Ultralytics YOLO11s.

Phase 2 starts from COCO weights, which already cover the highest-value classes:
cell phone, book, laptop, tv (-> second monitor/screen) and person (-> another person).
The remaining spec classes (tablet, earbuds, smartwatch, paper/notes, calculator) require
the Phase 3 fine-tune (`training/train_objects.py`); their slots exist here so the overlay
and feature vector are stable now.

NOTE: Ultralytics YOLO is AGPL-3.0 -- see LICENSES.md.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from ..._compat import lazy_import_ultralytics
from ...config import settings

logger = logging.getLogger(__name__)

# COCO id -> our proctoring label. Only the classes we care about are mapped.
# NOTE: person (COCO class 0) is deliberately NOT here. The student themselves is a
# person; counting them as an object would flag "another_person" every frame. Person
# COUNTING (and therefore second-person detection) is done by the pose detector, which
# distinguishes the student from additional people. See pipeline/risk.py.
COCO_TO_LABEL = {
    67: "cell phone",
    73: "book",
    63: "laptop",
    62: "second_monitor",   # COCO "tv" used as a stand-in for an extra screen
}

# Labels that are a violation (red) vs neutral (blue). "laptop" is allowed/neutral by
# default (the exam may run on one); tune per deployment in config if needed.
VIOLATION_LABELS = {"cell phone", "book", "paper", "tablet", "earphones",
                    "smartwatch", "calculator", "another_person"}
NEUTRAL_LABELS = {"laptop", "second_monitor"}

# Full label space (stable ordering shared with features.OBJECT_CLASSES).
ALL_LABELS = [
    "cell phone", "book", "laptop", "tablet", "earphones", "smartwatch",
    "paper", "calculator", "second_monitor", "another_person",
]


@dataclass
class ObjectDetection:
    label: str
    box_xywh: tuple[float, float, float, float]
    confidence: float
    is_violation: bool
    track_id: int = -1


class ObjectDetector:
    """YOLO11s object detector filtered to the proctoring label set."""

    def __init__(self) -> None:
        YOLO = lazy_import_ultralytics()
        weights = settings.model_path(settings.OBJECT_MODEL)
        model_ref = str(weights) if weights.exists() else settings.OBJECT_MODEL
        if not weights.exists():
            logger.warning("Object weights %s not found; Ultralytics will auto-download "
                           "'%s'. Run scripts/download_models.py.", weights, settings.OBJECT_MODEL)
        self.model = YOLO(model_ref)
        self.device = 0 if settings.DEVICE == "cuda" else "cpu"
        logger.info("Loaded object model %s on device=%s", model_ref, self.device)

    def detect(self, frame_bgr: np.ndarray) -> list[ObjectDetection]:
        # Native ByteTrack via Ultralytics for stable per-object IDs across frames.
        results = self.model.track(
            frame_bgr, persist=True, conf=settings.OBJECT_CONF, iou=settings.OBJECT_IOU,
            max_det=settings.OBJECT_MAX_DET, imgsz=settings.OBJECT_IMGSZ, device=self.device,
            classes=list(COCO_TO_LABEL.keys()), tracker="bytetrack.yaml", verbose=False,
        )
        out: list[ObjectDetection] = []
        if not results:
            return out
        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return out
        xyxy = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        clss = r.boxes.cls.cpu().numpy().astype(int)
        ids = (r.boxes.id.cpu().numpy().astype(int)
               if r.boxes.id is not None else np.full(len(xyxy), -1))
        for i in range(len(xyxy)):
            label = COCO_TO_LABEL.get(int(clss[i]))
            if label is None:
                continue
            x1, y1, x2, y2 = xyxy[i]
            out.append(ObjectDetection(
                label=label,
                box_xywh=(float(x1), float(y1), float(x2 - x1), float(y2 - y1)),
                confidence=float(confs[i]),
                is_violation=label in VIOLATION_LABELS,
                track_id=int(ids[i]),
            ))
        return out
