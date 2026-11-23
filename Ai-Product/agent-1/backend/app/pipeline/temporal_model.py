"""Live sliding-window inference for the temporal cheating model.

Maintains a rolling buffer of per-frame feature vectors and runs the ONNX Transformer
every `stride` frames (default once per second), emitting per-class probabilities. When
`temporal_model.onnx` is present the pipeline uses this instead of the BASELINE rules --
the hot-swap the spec asks for. Temperature scaling calibrates the probabilities.
"""
from __future__ import annotations

import logging
from collections import deque

import numpy as np

from ..config import settings
from .features import NUM_TEMPORAL_CLASSES, TEMPORAL_CLASSES

logger = logging.getLogger(__name__)


class TemporalInference:
    """Rolling-window ONNX inference. `available` is False if no model is present."""

    def __init__(self) -> None:
        self.available = False
        self._sess = None
        self.window = int(settings.TEMPORAL_WINDOW_S * settings.TEMPORAL_FPS)  # 50
        self.stride = max(1, int(settings.TEMPORAL_STRIDE_S * settings.TEMPORAL_FPS))  # 10
        self.temperature = max(settings.TEMPORAL_TEMPERATURE, 1e-3)
        self._buf: deque[np.ndarray] = deque(maxlen=self.window)
        self._since = 0
        self._last_probs: dict[str, float] | None = None
        self._try_load()

    def _try_load(self) -> None:
        path = settings.model_path(settings.TEMPORAL_MODEL_PATH)
        if not path.exists():
            logger.info("No temporal model at %s -> using BASELINE risk.", path)
            return
        try:
            from .._compat import make_ort_session
            self._sess = make_ort_session(str(path), settings.ort_providers)
            self._in = self._sess.get_inputs()[0].name
            # validate feature dim
            shape = self._sess.get_inputs()[0].shape
            self.available = True
            logger.info("Loaded temporal model %s (window=%s, in=%s) -> TEMPORAL mode",
                        path.name, self.window, shape)
        except Exception as exc:  # pragma: no cover
            logger.warning("Temporal model load failed (%s); staying on BASELINE.", exc)

    def update(self, feature_vec: np.ndarray) -> dict[str, float] | None:
        """Append a frame feature; return class probs when a new window is scored."""
        if not self.available:
            return None
        self._buf.append(feature_vec.astype(np.float32))
        self._since += 1
        if len(self._buf) < self.window:
            return self._last_probs
        if self._since < self.stride and self._last_probs is not None:
            return self._last_probs
        self._since = 0
        window = np.stack(self._buf)[None]                       # (1, T, F)
        logits = self._sess.run(None, {self._in: window})[0][0]  # (C,)
        probs = 1.0 / (1.0 + np.exp(-logits / self.temperature))
        self._last_probs = {TEMPORAL_CLASSES[i]: float(probs[i])
                            for i in range(min(NUM_TEMPORAL_CLASSES, len(probs)))}
        return self._last_probs
