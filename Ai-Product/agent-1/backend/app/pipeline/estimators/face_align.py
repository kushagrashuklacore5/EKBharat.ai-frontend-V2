"""ArcFace-style 5-point face alignment (norm_crop to 112x112).

Produces the canonical aligned crop ArcFace expects, using a similarity transform from 5
facial points (two eye centres, nose tip, two mouth corners) to the standard template.
The 5 points can come from SCRFD or be derived from MediaPipe dense landmarks.
"""
from __future__ import annotations

import cv2
import numpy as np

# Canonical 5-point template for a 112x112 ArcFace crop (image-left first).
ARCFACE_TEMPLATE = np.array([
    [38.2946, 51.6963],   # left eye
    [73.5318, 51.5014],   # right eye
    [56.0252, 71.7366],   # nose
    [41.5493, 92.3655],   # left mouth corner
    [70.7299, 92.2041],   # right mouth corner
], dtype=np.float32)

# MediaPipe indices used to derive the 5 points.
_MP_LEFT_EYE = (33, 133)
_MP_RIGHT_EYE = (362, 263)
_MP_NOSE = 1
_MP_MOUTH_L = 61
_MP_MOUTH_R = 291


def five_points_from_mediapipe(points: np.ndarray) -> np.ndarray:
    """Return 5 alignment points, ordered image-left-first, from 478 MediaPipe landmarks."""
    eye_a = points[list(_MP_LEFT_EYE), :2].mean(axis=0)
    eye_b = points[list(_MP_RIGHT_EYE), :2].mean(axis=0)
    mouth_a = points[_MP_MOUTH_L, :2]
    mouth_b = points[_MP_MOUTH_R, :2]
    nose = points[_MP_NOSE, :2]
    # Order each pair by x so point[0] is always image-left (robust to mirroring).
    eye_l, eye_r = (eye_a, eye_b) if eye_a[0] <= eye_b[0] else (eye_b, eye_a)
    mouth_l, mouth_r = (mouth_a, mouth_b) if mouth_a[0] <= mouth_b[0] else (mouth_b, mouth_a)
    return np.array([eye_l, eye_r, nose, mouth_l, mouth_r], dtype=np.float32)


def norm_crop(frame_bgr: np.ndarray, five_points: np.ndarray, size: int = 112) -> np.ndarray | None:
    """Align and crop a face to `size`x`size` using the 5-point similarity transform."""
    if five_points.shape != (5, 2):
        return None
    dst = ARCFACE_TEMPLATE.copy()
    if size != 112:
        dst = dst * (size / 112.0)
    M, _ = cv2.estimateAffinePartial2D(five_points, dst, method=cv2.LMEDS)
    if M is None:
        return None
    return cv2.warpAffine(frame_bgr, M, (size, size), borderValue=0.0)
