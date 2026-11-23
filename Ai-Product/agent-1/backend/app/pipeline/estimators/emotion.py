"""Facial affect via HSEmotion (EfficientNet trained on AffectNet), ONNX runtime.

This is a FEATURE only -- it feeds the temporal model and the HUD, and must never be a
standalone cheating flag (an anxious but honest student should not be penalised).

Model weights are auto-downloaded by the `hsemotion-onnx` package on first use.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from ...config import settings

logger = logging.getLogger(__name__)

# HSEmotion label set -> our canonical feature labels (features.EMOTION_CLASSES).
_LABEL_MAP = {
    "Anger": "anger", "Contempt": "contempt", "Disgust": "disgust", "Fear": "fear",
    "Happiness": "happy", "Neutral": "neutral", "Sadness": "sad", "Surprise": "surprise",
}


@dataclass
class EmotionResult:
    top3: list[tuple[str, float]]          # [(label, prob), ...] canonical labels
    probs: dict[str, float]                # canonical label -> prob (all classes)


class EmotionEstimator:
    def __init__(self) -> None:
        from hsemotion_onnx.facial_emotions import HSEmotionRecognizer
        self.model = HSEmotionRecognizer(model_name=settings.EMOTION_MODEL)
        logger.info("Loaded HSEmotion model %s", settings.EMOTION_MODEL)

    def estimate(self, face_bgr: np.ndarray) -> EmotionResult | None:
        """face_bgr: a cropped face image (BGR). HSEmotion handles resizing."""
        if face_bgr is None or face_bgr.size == 0:
            return None
        # HSEmotion expects RGB.
        rgb = face_bgr[:, :, ::-1]
        _label, scores = self.model.predict_emotions(rgb, logits=False)
        scores = np.asarray(scores, dtype=np.float32)
        labels = [self._canon(i) for i in range(len(scores))]
        probs = {labels[i]: float(scores[i]) for i in range(len(scores))}
        order = np.argsort(scores)[::-1][:3]
        top3 = [(labels[i], float(scores[i])) for i in order]
        return EmotionResult(top3=top3, probs=probs)

    def _canon(self, idx: int) -> str:
        raw = self.model.idx_to_class[idx]
        return _LABEL_MAP.get(raw, raw.lower())
