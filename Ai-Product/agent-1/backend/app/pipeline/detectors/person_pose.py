"""Person detection + 17-keypoint body pose via Ultralytics YOLO11-pose.

Returns persons in **source-frame pixel coordinates**. Track IDs come from
Ultralytics' built-in tracker (ByteTrack) so IDs are stable across frames; a dedicated
ByteTrack wrapper (tracking.py) is introduced in Phase 2 for the object streams.

NOTE: Ultralytics YOLO is AGPL-3.0 -- see LICENSES.md before commercial deployment.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ..._compat import lazy_import_ultralytics
from ...config import settings

logger = logging.getLogger(__name__)

# COCO 17-keypoint skeleton edges (pairs of keypoint indices) for drawing limbs.
# 0 nose,1 l-eye,2 r-eye,3 l-ear,4 r-ear,5 l-sho,6 r-sho,7 l-elb,8 r-elb,
# 9 l-wri,10 r-wri,11 l-hip,12 r-hip,13 l-knee,14 r-knee,15 l-ank,16 r-ank
COCO_SKELETON: list[tuple[int, int]] = [
    (5, 7), (7, 9), (6, 8), (8, 10),          # arms
    (5, 6), (5, 11), (6, 12), (11, 12),       # torso
    (11, 13), (13, 15), (12, 14), (14, 16),   # legs
    (0, 1), (0, 2), (1, 3), (2, 4), (0, 5), (0, 6),  # head/neck
]

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]


@dataclass
class Keypoint:
    x: float
    y: float
    conf: float


@dataclass
class PersonDetection:
    track_id: int
    box_xywh: tuple[float, float, float, float]  # source-frame pixels
    confidence: float
    keypoints: list[Keypoint] = field(default_factory=list)  # 17 COCO kpts


class PersonPoseDetector:
    """Thin wrapper over a YOLO11-pose model with persistent tracking."""

    def __init__(self) -> None:
        YOLO = lazy_import_ultralytics()
        weights = settings.model_path(settings.POSE_MODEL)
        if not weights.exists():
            # Ultralytics will auto-download by name on first use, but we prefer an
            # explicit, pinned local file placed by scripts/download_models.py.
            logger.warning(
                "Pose weights %s not found locally; falling back to Ultralytics "
                "auto-download of '%s'. Run scripts/download_models.py to pin it.",
                weights, settings.POSE_MODEL,
            )
            model_ref = settings.POSE_MODEL
        else:
            model_ref = str(weights)
        self.model = YOLO(model_ref)
        self.device = 0 if settings.DEVICE == "cuda" else "cpu"
        logger.info("Loaded pose model %s on device=%s", model_ref, self.device)

    def detect(self, frame_bgr: np.ndarray) -> list[PersonDetection]:
        """Run pose + tracking on one frame. Coordinates are source-frame pixels."""
        results = self.model.track(
            frame_bgr,
            persist=True,
            conf=settings.POSE_CONF,
            iou=settings.POSE_IOU,
            max_det=settings.POSE_MAX_PERSONS,
            imgsz=settings.POSE_IMGSZ,
            device=self.device,
            tracker="bytetrack.yaml",
            verbose=False,
        )
        if not results:
            return []
        r = results[0]
        out: list[PersonDetection] = []
        if r.boxes is None or len(r.boxes) == 0:
            return out

        boxes_xyxy = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        ids = (
            r.boxes.id.cpu().numpy().astype(int)
            if r.boxes.id is not None
            else np.arange(len(boxes_xyxy))
        )
        kpts_all = (
            r.keypoints.data.cpu().numpy()        # (N,17,3) x,y,conf
            if r.keypoints is not None
            else None
        )

        for i in range(len(boxes_xyxy)):
            x1, y1, x2, y2 = boxes_xyxy[i]
            kps: list[Keypoint] = []
            if kpts_all is not None and i < len(kpts_all):
                for (kx, ky, kc) in kpts_all[i]:
                    kps.append(Keypoint(float(kx), float(ky), float(kc)))
            out.append(
                PersonDetection(
                    track_id=int(ids[i]),
                    box_xywh=(float(x1), float(y1), float(x2 - x1), float(y2 - y1)),
                    confidence=float(confs[i]),
                    keypoints=kps,
                )
            )
        return out
