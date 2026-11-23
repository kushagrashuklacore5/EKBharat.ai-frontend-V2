"""Head pose via 6DRepNet, with automatic backend selection.

Backends, in priority order (first that is available wins):
  1. ONNX  -- app/models/sixdrepnet.onnx (export via scripts/export_onnx.py), ONNX Runtime
  2. torch -- the `sixdrepnet` package (auto-downloads weights), CPU/GPU
  3. geometric fallback -- the Phase 1 solvePnP estimate (always available)

All backends return the shared `HeadPose` (angles + a drawable axis gnomon), so the
pipeline is identical regardless of which one is active. `backend_name` reports which is
live (surfaced in logs / HUD mode).
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

from ...config import settings
from . import head_pose as geometric
from .head_pose import HeadPose, axis_from_euler

logger = logging.getLogger(__name__)

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _preprocess(face_bgr: np.ndarray, size: int = 224) -> np.ndarray:
    img = cv2.resize(face_bgr, (size, size))
    img = img[:, :, ::-1].astype(np.float32) / 255.0      # BGR->RGB, [0,1]
    img = (img - _IMAGENET_MEAN) / _IMAGENET_STD
    blob = np.transpose(img, (2, 0, 1))[None]
    return np.ascontiguousarray(blob, dtype=np.float32)


def _rot6d_to_euler(x: np.ndarray) -> tuple[float, float, float]:
    """Convert a 6D rotation representation (Zhou et al.) to yaw/pitch/roll degrees."""
    a1 = x[0:3]
    a2 = x[3:6]
    b1 = a1 / (np.linalg.norm(a1) + 1e-9)
    a2 = a2 - np.dot(b1, a2) * b1
    b2 = a2 / (np.linalg.norm(a2) + 1e-9)
    b3 = np.cross(b1, b2)
    R = np.stack([b1, b2, b3], axis=-1)
    yaw, pitch, roll = geometric._rotation_to_euler(R)
    return yaw, pitch, roll


class HeadPoseEstimator:
    """Backend-selecting head-pose estimator."""

    def __init__(self) -> None:
        self.backend_name = "geometric"
        self._onnx = None
        self._torch_model = None
        if settings.USE_6DREPNET:
            self._try_onnx() or self._try_torch()
        logger.info("Head pose backend: %s", self.backend_name)

    def _try_onnx(self) -> bool:
        path = settings.model_path(settings.HEADPOSE_MODEL)
        if not path.exists():
            return False
        try:
            from ..._compat import make_ort_session
            self._onnx = make_ort_session(str(path), settings.ort_providers)
            self._onnx_in = self._onnx.get_inputs()[0].name
            self.backend_name = "6drepnet-onnx"
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("6DRepNet ONNX load failed (%s); trying torch.", exc)
            return False

    def _try_torch(self) -> bool:
        try:
            from sixdrepnet import SixDRepNet
            gpu = 0 if settings.DEVICE == "cuda" else -1
            self._torch_model = SixDRepNet(gpu_id=gpu)
            self.backend_name = "6drepnet-torch"
            return True
        except Exception as exc:
            logger.warning("6DRepNet torch unavailable (%s); using geometric fallback.", exc)
            return False

    def estimate(self, frame_bgr: np.ndarray, points: np.ndarray,
                 face_box: tuple[float, float, float, float],
                 frame_w: int, frame_h: int) -> HeadPose | None:
        nose = (float(points[1, 0]), float(points[1, 1]))

        if self._onnx is not None:
            crop = _crop(frame_bgr, face_box)
            if crop is not None:
                out = self._onnx.run(None, {self._onnx_in: _preprocess(crop)})[0][0]
                if out.shape[0] >= 6:
                    yaw, pitch, roll = _rot6d_to_euler(out[:6])
                else:  # already angles
                    pitch, yaw, roll = float(out[0]), float(out[1]), float(out[2])
                return axis_from_euler(yaw, pitch, roll, nose)

        if self._torch_model is not None:
            crop = _crop(frame_bgr, face_box)
            if crop is not None:
                pitch, yaw, roll = self._torch_model.predict(crop)
                return axis_from_euler(float(yaw), float(pitch), float(roll), nose)

        # Geometric fallback (always works).
        return geometric.estimate(points, frame_w, frame_h)


def _crop(frame_bgr: np.ndarray, box: tuple[float, float, float, float],
          pad: float = 0.25) -> np.ndarray | None:
    h, w = frame_bgr.shape[:2]
    x, y, bw, bh = box
    x0 = max(0, int(x - bw * pad)); y0 = max(0, int(y - bh * pad))
    x1 = min(w, int(x + bw * (1 + pad))); y1 = min(h, int(y + bh * (1 + pad)))
    if x1 <= x0 or y1 <= y0:
        return None
    return frame_bgr[y0:y1, x0:x1]
