"""Gaze estimation.

Phase 1: a geometric estimate from iris position within the eye opening, combined with
head pose. Horizontal/vertical iris offset inside each eye maps to an eye-in-head angle;
added to head yaw/pitch it yields an approximate gaze direction and class. This is a
real estimate suitable for live overlay, but appearance-based gaze (**L2CS-Net, ONNX**)
replaces it in Phase 2 for accuracy and for the calibrated on-screen gaze point.

All outputs are in source-frame pixels / degrees.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..detectors.landmarks import (
    LEFT_EYE, RIGHT_EYE, LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER,
)
from ...config import settings

# Eye corner indices (inner/outer) for normalizing iris position.
LEFT_EYE_OUTER, LEFT_EYE_INNER = 33, 133
RIGHT_EYE_OUTER, RIGHT_EYE_INNER = 263, 362
# Eyelid top/bottom for vertical normalization.
LEFT_EYE_TOP, LEFT_EYE_BOTTOM = 159, 145
RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM = 386, 374

# Gain converting normalized iris offset (-0.5..0.5) to eye-in-head degrees.
HGAIN_DEG = 45.0
VGAIN_DEG = 35.0


@dataclass
class Gaze:
    yaw: float          # combined gaze yaw (deg, +right)
    pitch: float        # combined gaze pitch (deg, +down)
    gaze_class: str     # center/left/right/up/down/off-screen
    left_origin: tuple[float, float]
    left_dir: tuple[float, float]       # unit-ish image vector for the arrow
    right_origin: tuple[float, float]
    right_dir: tuple[float, float]


def _norm_offset(iris: np.ndarray, outer: np.ndarray, inner: np.ndarray,
                 top: np.ndarray, bottom: np.ndarray) -> tuple[float, float]:
    """Return (hx, vy) in roughly [-0.5, 0.5], 0 = centre of the eye opening."""
    eye_c = (outer + inner) / 2.0
    width = np.linalg.norm(outer - inner) + 1e-6
    height = np.linalg.norm(top - bottom) + 1e-6
    # project iris offset onto eye horizontal/vertical axes
    hx = float((iris[0] - eye_c[0]) / width)
    vy = float((iris[1] - eye_c[1]) / height)
    return np.clip(hx, -0.6, 0.6), np.clip(vy, -0.6, 0.6)


def _classify(yaw: float, pitch: float) -> str:
    tol = settings.GAZE_CENTER_TOL_DEG
    off = settings.GAZE_OFFSCREEN_DEG
    if abs(yaw) > off or abs(pitch) > off:
        return "off-screen"
    if abs(yaw) <= tol and abs(pitch) <= tol:
        return "center"
    if abs(yaw) >= abs(pitch):
        return "right" if yaw > 0 else "left"
    return "down" if pitch > 0 else "up"


def build_gaze(points: np.ndarray, yaw: float, pitch: float,
               arrow_len: float = 40.0) -> Gaze:
    """Build a Gaze (origins from iris, arrows+class from given yaw/pitch degrees).

    Shared by the geometric estimator and the L2CS backend so the overlay is identical
    regardless of which produced the angles.
    """
    li = points[LEFT_IRIS_CENTER, :2]
    ri = points[RIGHT_IRIS_CENTER, :2]
    gaze_class = _classify(yaw, pitch)
    dx = np.sin(np.radians(yaw)) * arrow_len
    dy = np.sin(np.radians(pitch)) * arrow_len
    return Gaze(
        yaw=yaw, pitch=pitch, gaze_class=gaze_class,
        left_origin=(float(li[0]), float(li[1])),
        left_dir=(float(dx), float(dy)),
        right_origin=(float(ri[0]), float(ri[1])),
        right_dir=(float(dx), float(dy)),
    )


def estimate(points: np.ndarray, head_yaw: float, head_pitch: float,
             arrow_len: float = 40.0) -> Gaze:
    """Estimate gaze geometrically from iris positions + head pose."""
    li = points[LEFT_IRIS_CENTER, :2]
    ri = points[RIGHT_IRIS_CENTER, :2]

    lhx, lvy = _norm_offset(
        li, points[LEFT_EYE_OUTER, :2], points[LEFT_EYE_INNER, :2],
        points[LEFT_EYE_TOP, :2], points[LEFT_EYE_BOTTOM, :2],
    )
    rhx, rvy = _norm_offset(
        ri, points[RIGHT_EYE_OUTER, :2], points[RIGHT_EYE_INNER, :2],
        points[RIGHT_EYE_TOP, :2], points[RIGHT_EYE_BOTTOM, :2],
    )
    hx = (lhx + rhx) / 2.0
    vy = (lvy + rvy) / 2.0

    eye_yaw = hx * HGAIN_DEG
    eye_pitch = vy * VGAIN_DEG
    yaw = head_yaw + eye_yaw
    pitch = head_pitch + eye_pitch
    gaze_class = _classify(yaw, pitch)

    # Arrow direction in image space: horizontal follows +yaw (to image right),
    # vertical follows +pitch (down). Scale by arrow_len.
    dx = np.sin(np.radians(yaw)) * arrow_len
    dy = np.sin(np.radians(pitch)) * arrow_len
    return Gaze(
        yaw=yaw, pitch=pitch, gaze_class=gaze_class,
        left_origin=(float(li[0]), float(li[1])),
        left_dir=(float(dx), float(dy)),
        right_origin=(float(ri[0]), float(ri[1])),
        right_dir=(float(dx), float(dy)),
    )
