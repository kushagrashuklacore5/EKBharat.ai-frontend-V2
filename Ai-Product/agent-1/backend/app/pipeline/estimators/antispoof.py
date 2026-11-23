"""Passive anti-spoof (liveness) via a MiniFASNet-style CNN on ONNX Runtime.

Scores a face crop as live-vs-spoof every few frames, catching printed photos, phone/laptop
screen replays and masks WITHOUT asking the student to do anything. Complements the active
blink+head-turn challenge run at calibration (which does not need this model).

The model is OPTIONAL: if `minifasnet.onnx` is absent the pipeline falls back to the active
challenge + passive no-blink heuristic. Export the model with
`scripts/download_models.py --antispoof` (downloads + converts the Silent-Face MiniFASNet).

MiniFASNet convention: 3-class softmax output; index 1 = live. Input is an 80x80 BGR crop
expanded around the face box by a fixed scale, normalized to [0,1].
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

from ...config import settings

logger = logging.getLogger(__name__)


class AntiSpoofEstimator:
    def __init__(self) -> None:
        from ..._compat import make_ort_session
        path = settings.model_path(settings.SPOOF_MODEL)
        if not path.exists():
            raise FileNotFoundError(
                f"Anti-spoof model not at {path}. Run scripts/download_models.py --antispoof "
                "(or rely on the active blink/head-turn challenge)."
            )
        self.sess = make_ort_session(str(path), settings.ort_providers)
        self.input_name = self.sess.get_inputs()[0].name
        shape = self.sess.get_inputs()[0].shape
        self.size = int(shape[2]) if isinstance(shape[2], int) else 80
        logger.info("Loaded anti-spoof model %s (in=%d)", settings.SPOOF_MODEL, self.size)

    def _crop(self, frame_bgr, box, scale: float = 2.7):
        h, w = frame_bgr.shape[:2]
        x, y, bw, bh = box
        cx, cy = x + bw / 2, y + bh / 2
        side = max(bw, bh) * scale
        x0 = max(0, int(cx - side / 2)); y0 = max(0, int(cy - side / 2))
        x1 = min(w, int(cx + side / 2)); y1 = min(h, int(cy + side / 2))
        if x1 <= x0 or y1 <= y0:
            return None
        return frame_bgr[y0:y1, x0:x1]

    def score(self, frame_bgr: np.ndarray, face_box) -> float | None:
        """Return P(live) in [0,1], or None if the crop is invalid."""
        crop = self._crop(frame_bgr, face_box)
        if crop is None:
            return None
        img = cv2.resize(crop, (self.size, self.size)).astype(np.float32) / 255.0
        blob = np.ascontiguousarray(np.transpose(img, (2, 0, 1))[None], dtype=np.float32)
        out = self.sess.run(None, {self.input_name: blob})[0][0]
        e = np.exp(out - out.max())
        probs = e / e.sum()
        return float(probs[1]) if probs.shape[0] >= 2 else float(probs[0])
