"""Dense face landmarks (478 points incl. iris) via MediaPipe Face Mesh.

We use MediaPipe's `face_mesh` solution with `refine_landmarks=True`, which returns
468 face landmarks + 10 iris landmarks (indices 468-477). No extra model download is
required (the mesh model ships inside the mediapipe wheel).

The detector returns, per face, landmarks in **source-frame pixel coordinates** plus
derived eye/mouth boxes, EAR, MAR and iris centres. Head pose and gaze are computed
from these points by the `estimators` package.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ..._compat import lazy_import_mediapipe
from ...config import settings

logger = logging.getLogger(__name__)

# --- MediaPipe landmark index constants -------------------------------------
# Iris (require refine_landmarks=True)
LEFT_IRIS = [468, 469, 470, 471, 472]      # 468 = centre
RIGHT_IRIS = [473, 474, 475, 476, 477]     # 473 = centre
LEFT_IRIS_CENTER = 468
RIGHT_IRIS_CENTER = 473

# Eye contours (for eye boxes)
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133,
            173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263,
             466, 388, 387, 386, 385, 384, 398]

# EAR points p1..p6 (Soukupova & Cech). Order: [corner_a, top1, top2, corner_b, bot2, bot1]
LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]

# Mouth: outer corners + inner top/bottom for MAR, outer ring for the mouth box
MOUTH_LEFT_CORNER = 61
MOUTH_RIGHT_CORNER = 291
MOUTH_TOP = 13
MOUTH_BOTTOM = 14
MOUTH_RING = [61, 291, 0, 17, 13, 14, 78, 308, 82, 312, 87, 317]

# solvePnP 6-point set (indices) and their canonical 3D model coordinates (mm).
PNP_LANDMARKS = [1, 152, 33, 263, 61, 291]  # nose tip, chin, l-eye-out, r-eye-out, l-mouth, r-mouth
# Canonical 3D face model aligned to the OpenCV solvePnP convention used here:
# X right, Y DOWN (chin/mouth positive, eyes negative), and the nose tip PROTRUDING
# toward the camera so the inner features sit at NEGATIVE Z. With these signs a frontal
# face solves to ~(yaw=0, pitch~0, roll=0) instead of the degenerate 180-degree axis
# flip (verified empirically against synthetic frontal/yaw cases).
PNP_MODEL_3D = np.array([
    (0.0, 0.0, 0.0),            # nose tip
    (0.0, 63.6, -12.5),         # chin
    (-43.3, -32.7, -26.0),      # left eye outer corner
    (43.3, -32.7, -26.0),       # right eye outer corner
    (-28.9, 28.9, -24.1),       # left mouth corner
    (28.9, 28.9, -24.1),        # right mouth corner
], dtype=np.float64)


@dataclass
class FaceLandmarks:
    """478 landmarks + derived eye/mouth geometry, in source-frame pixels."""
    points: np.ndarray            # (478, 3) x,y in px, z normalized
    box_xywh: tuple[float, float, float, float]
    left_eye_box: tuple[float, float, float, float]
    right_eye_box: tuple[float, float, float, float]
    mouth_box: tuple[float, float, float, float]
    left_iris: tuple[float, float]
    right_iris: tuple[float, float]
    ear_left: float
    ear_right: float
    mar: float


def _box_from_indices(pts: np.ndarray, idx: list[int], pad: float = 0.0
                      ) -> tuple[float, float, float, float]:
    sel = pts[idx, :2]
    x0, y0 = sel[:, 0].min(), sel[:, 1].min()
    x1, y1 = sel[:, 0].max(), sel[:, 1].max()
    w, h = x1 - x0, y1 - y0
    if pad:
        x0 -= w * pad; y0 -= h * pad; w *= (1 + 2 * pad); h *= (1 + 2 * pad)
    return (float(x0), float(y0), float(w), float(h))


def _ear(pts: np.ndarray, idx: list[int]) -> float:
    """Eye aspect ratio from 6 points [p1,p2,p3,p4,p5,p6]."""
    p = pts[idx, :2]
    a = np.linalg.norm(p[1] - p[5])
    b = np.linalg.norm(p[2] - p[4])
    c = np.linalg.norm(p[0] - p[3])
    return float((a + b) / (2.0 * c)) if c > 1e-6 else 0.0


def _mar(pts: np.ndarray) -> float:
    """Mouth aspect ratio = vertical opening / horizontal width."""
    top = pts[MOUTH_TOP, :2]
    bot = pts[MOUTH_BOTTOM, :2]
    left = pts[MOUTH_LEFT_CORNER, :2]
    right = pts[MOUTH_RIGHT_CORNER, :2]
    v = np.linalg.norm(top - bot)
    h = np.linalg.norm(left - right)
    return float(v / h) if h > 1e-6 else 0.0


class FaceLandmarkDetector:
    """MediaPipe Face Mesh wrapper returning 478 landmarks + derived geometry."""

    def __init__(self) -> None:
        mp = lazy_import_mediapipe()
        self._mp = mp
        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=settings.FACE_MESH_MAX_FACES,
            refine_landmarks=True,                 # enables the 10 iris landmarks
            min_detection_confidence=settings.FACE_MESH_MIN_DET_CONF,
            min_tracking_confidence=settings.FACE_MESH_MIN_TRACK_CONF,
        )
        logger.info("Loaded MediaPipe FaceMesh (max_faces=%d, iris=on)",
                    settings.FACE_MESH_MAX_FACES)

    def detect(self, frame_bgr: np.ndarray) -> list[FaceLandmarks]:
        h, w = frame_bgr.shape[:2]
        # MediaPipe expects RGB and a C-contiguous array.
        rgb = frame_bgr[:, :, ::-1]
        rgb = np.ascontiguousarray(rgb)
        res = self.mesh.process(rgb)
        out: list[FaceLandmarks] = []
        if not res.multi_face_landmarks:
            return out

        for fl in res.multi_face_landmarks:
            n = len(fl.landmark)
            pts = np.empty((n, 3), dtype=np.float64)
            for i, lm in enumerate(fl.landmark):
                pts[i, 0] = lm.x * w
                pts[i, 1] = lm.y * h
                pts[i, 2] = lm.z        # normalized depth (roughly in units of face width)

            has_iris = n >= 478
            left_iris = (tuple(pts[LEFT_IRIS_CENTER, :2]) if has_iris
                         else tuple(pts[LEFT_EYE, :2].mean(axis=0)))
            right_iris = (tuple(pts[RIGHT_IRIS_CENTER, :2]) if has_iris
                          else tuple(pts[RIGHT_EYE, :2].mean(axis=0)))

            out.append(FaceLandmarks(
                points=pts,
                box_xywh=_box_from_indices(pts, list(range(min(n, 468))), pad=0.05),
                left_eye_box=_box_from_indices(pts, LEFT_EYE, pad=0.25),
                right_eye_box=_box_from_indices(pts, RIGHT_EYE, pad=0.25),
                mouth_box=_box_from_indices(pts, MOUTH_RING, pad=0.15),
                left_iris=(float(left_iris[0]), float(left_iris[1])),
                right_iris=(float(right_iris[0]), float(right_iris[1])),
                ear_left=_ear(pts, LEFT_EYE_EAR),
                ear_right=_ear(pts, RIGHT_EYE_EAR),
                mar=_mar(pts),
            ))
        return out

    def close(self) -> None:
        try:
            self.mesh.close()
        except Exception:  # pragma: no cover
            pass
