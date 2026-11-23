"""Head pose (yaw / pitch / roll) via PnP on canonical face landmarks.

Phase 1 uses a geometric solvePnP estimate from 6 stable MediaPipe landmarks against a
canonical 3D face model. This is a genuine, camera-calibrated estimate (not a stub).
Phase 2 swaps in **6DRepNet (ONNX)** for appearance-based accuracy; the interface
(`estimate -> HeadPose`) stays identical so the pipeline does not change.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import numpy as np

from ..detectors.landmarks import PNP_LANDMARKS, PNP_MODEL_3D


@dataclass
class HeadPose:
    yaw: float      # degrees, +right
    pitch: float    # degrees, +down
    roll: float     # degrees, +clockwise
    # 3D axis projected to the image for drawing (origin = nose tip).
    origin: tuple[float, float]
    x_axis: tuple[float, float]   # red
    y_axis: tuple[float, float]   # green
    z_axis: tuple[float, float]   # blue


def _camera_matrix(w: int, h: int) -> np.ndarray:
    """Pinhole intrinsics approximation (focal ~ image width)."""
    f = float(w)
    cx, cy = w / 2.0, h / 2.0
    return np.array([[f, 0, cx], [0, f, cy], [0, 0, 1]], dtype=np.float64)


def _rotation_to_euler(rmat: np.ndarray) -> tuple[float, float, float]:
    """Convert rotation matrix to yaw/pitch/roll in degrees."""
    sy = math.sqrt(rmat[0, 0] ** 2 + rmat[1, 0] ** 2)
    singular = sy < 1e-6
    if not singular:
        x = math.atan2(rmat[2, 1], rmat[2, 2])
        y = math.atan2(-rmat[2, 0], sy)
        z = math.atan2(rmat[1, 0], rmat[0, 0])
    else:
        x = math.atan2(-rmat[1, 2], rmat[1, 1])
        y = math.atan2(-rmat[2, 0], sy)
        z = 0.0
    pitch, yaw, roll = math.degrees(x), math.degrees(y), math.degrees(z)
    return yaw, pitch, roll


def axis_from_euler(yaw: float, pitch: float, roll: float,
                    origin: tuple[float, float], size: float = 60.0) -> HeadPose:
    """Build a drawable HeadPose (axis gnomon) directly from Euler angles (degrees).

    Uses the standard Hopenet/6DRepNet draw-axis projection so the gnomon is consistent
    with model-reported angles even without a translation vector. Red X = right ear,
    green Y = down, blue Z = out of the face toward the camera.
    """
    y, p, r = map(math.radians, (yaw, pitch, roll))
    ox, oy = origin
    # X axis (points to the person's left/right in image)
    x_ax = (size * (math.cos(y) * math.cos(r)) + ox,
            size * (math.cos(p) * math.sin(r) + math.cos(r) * math.sin(p) * math.sin(y)) + oy)
    # Y axis (down)
    y_ax = (size * (-math.cos(y) * math.sin(r)) + ox,
            size * (math.cos(p) * math.cos(r) - math.sin(p) * math.sin(y) * math.sin(r)) + oy)
    # Z axis (toward camera)
    z_ax = (size * (math.sin(y)) + ox,
            size * (-math.cos(y) * math.sin(p)) + oy)
    return HeadPose(yaw=yaw, pitch=pitch, roll=roll, origin=(ox, oy),
                    x_axis=x_ax, y_axis=y_ax, z_axis=z_ax)


def estimate(points: np.ndarray, frame_w: int, frame_h: int,
             axis_len: float = 60.0) -> HeadPose | None:
    """Estimate head pose from the full 478-landmark array (uses a 6-point subset)."""
    img_pts = points[PNP_LANDMARKS, :2].astype(np.float64)
    cam = _camera_matrix(frame_w, frame_h)
    dist = np.zeros((4, 1), dtype=np.float64)

    ok, rvec, tvec = cv2.solvePnP(
        PNP_MODEL_3D, img_pts, cam, dist, flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not ok:
        return None

    rmat, _ = cv2.Rodrigues(rvec)
    yaw, pitch, roll = _rotation_to_euler(rmat)

    # Draw the gnomon with a fixed PIXEL length anchored at the nose tip (via
    # axis_from_euler), rather than projecting a fixed 3D length -- a fixed metric axis
    # explodes to hundreds of pixels for a close face. This keeps the overlay bounded and
    # consistent with the 6DRepNet path.
    nose = (float(points[1, 0]), float(points[1, 1]))
    return axis_from_euler(yaw, pitch, roll, nose, size=axis_len)
