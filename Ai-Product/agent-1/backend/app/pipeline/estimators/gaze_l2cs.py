"""Gaze via L2CS-Net with backend selection + per-student screen calibration.

Backends:
  1. ONNX  -- app/models/l2cs.onnx (export via scripts/export_onnx.py), ONNX Runtime.
             L2CS outputs binned yaw/pitch; we take the softmax expectation over bin
             centres (Gaze360 convention: 90 bins, 4-degree width, -180 offset).
  2. geometric fallback -- the Phase 1 iris-geometry estimate (always available).

Both return the shared `Gaze` (origins + arrows + class). On top of either, the
`GazeCalibration` class fits a per-student polynomial mapping from gaze (yaw, pitch) to
normalized on-screen coordinates using the 5-9 dot calibration captured at exam start.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

from ...config import settings
from . import gaze as geometric
from .gaze import Gaze

logger = logging.getLogger(__name__)

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
_NUM_BINS = 90
_BIN_WIDTH = 4.0
_BIN_OFFSET = 180.0


def _preprocess(face_bgr: np.ndarray, size: int = 448) -> np.ndarray:
    img = cv2.resize(face_bgr, (size, size))
    img = img[:, :, ::-1].astype(np.float32) / 255.0
    img = (img - _IMAGENET_MEAN) / _IMAGENET_STD
    return np.ascontiguousarray(np.transpose(img, (2, 0, 1))[None], dtype=np.float32)


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


def _decode_bins(logits: np.ndarray) -> float:
    """Expectation over bin centres -> angle in degrees."""
    probs = _softmax(logits.ravel())
    idx = np.arange(_NUM_BINS)
    return float((probs * idx).sum() * _BIN_WIDTH - _BIN_OFFSET)


class GazeEstimator:
    def __init__(self) -> None:
        self.backend_name = "geometric"
        self._onnx = None
        if settings.USE_L2CS:
            self._try_onnx()
        logger.info("Gaze backend: %s", self.backend_name)

    def _try_onnx(self) -> bool:
        path = settings.model_path(settings.GAZE_MODEL)
        if not path.exists():
            return False
        try:
            from ..._compat import make_ort_session
            self._onnx = make_ort_session(str(path), settings.ort_providers)
            self._onnx_in = self._onnx.get_inputs()[0].name
            self.backend_name = "l2cs-onnx"
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("L2CS ONNX load failed (%s); using geometric gaze.", exc)
            return False

    def estimate(self, frame_bgr: np.ndarray, points: np.ndarray,
                 face_box: tuple[float, float, float, float],
                 head_yaw: float, head_pitch: float) -> Gaze:
        if self._onnx is not None:
            crop = _crop(frame_bgr, face_box)
            if crop is not None:
                outs = self._onnx.run(None, {self._onnx_in: _preprocess(crop)})
                # L2CS returns (yaw_logits, pitch_logits).
                yaw = _decode_bins(np.asarray(outs[0]))
                pitch = _decode_bins(np.asarray(outs[1]))
                return geometric.build_gaze(points, yaw, pitch)
        return geometric.estimate(points, head_yaw, head_pitch)


def _crop(frame_bgr: np.ndarray, box: tuple[float, float, float, float],
          pad: float = 0.2) -> np.ndarray | None:
    h, w = frame_bgr.shape[:2]
    x, y, bw, bh = box
    x0 = max(0, int(x - bw * pad)); y0 = max(0, int(y - bh * pad))
    x1 = min(w, int(x + bw * (1 + pad))); y1 = min(h, int(y + bh * (1 + pad)))
    if x1 <= x0 or y1 <= y0:
        return None
    return frame_bgr[y0:y1, x0:x1]


class GazeCalibration:
    """Per-student polynomial map from (yaw, pitch) degrees to normalized screen (x,y).

    Fitted from the 5-9 dot calibration. Degree-2 features [1, y, p, y^2, p^2, y*p] give
    a smooth, well-conditioned fit from few points. `ready` is False until fit succeeds.
    """

    def __init__(self) -> None:
        self.coef_x: np.ndarray | None = None
        self.coef_y: np.ndarray | None = None

    @staticmethod
    def _features(yaw: float, pitch: float) -> np.ndarray:
        return np.array([1.0, yaw, pitch, yaw * yaw, pitch * pitch, yaw * pitch])

    def fit(self, samples: list[tuple[float, float, float, float]]) -> bool:
        """samples: list of (yaw, pitch, target_screen_x, target_screen_y) in [0,1]."""
        if len(samples) < 5:
            return False
        A = np.array([self._features(y, p) for (y, p, _sx, _sy) in samples])
        bx = np.array([sx for (_y, _p, sx, _sy) in samples])
        by = np.array([sy for (_y, _p, _sx, sy) in samples])
        self.coef_x, *_ = np.linalg.lstsq(A, bx, rcond=None)
        self.coef_y, *_ = np.linalg.lstsq(A, by, rcond=None)
        return True

    @property
    def ready(self) -> bool:
        return self.coef_x is not None and self.coef_y is not None

    def predict(self, yaw: float, pitch: float) -> tuple[float, float] | None:
        if not self.ready:
            return None
        f = self._features(yaw, pitch)
        x = float(np.clip(np.dot(f, self.coef_x), 0.0, 1.0))
        y = float(np.clip(np.dot(f, self.coef_y), 0.0, 1.0))
        return x, y
