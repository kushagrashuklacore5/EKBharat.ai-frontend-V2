"""Face identity via ArcFace (buffalo_l w600k_r50.onnx) on ONNX Runtime.

Produces a 512-d L2-normalized embedding from an aligned 112x112 face crop. The pipeline
enrols a student (averaged embedding over N frames) during calibration and then reports
cosine similarity to the enrolment each frame; below IDENTITY_MATCH_THRESH raises a
mismatch flag.

Weights are the InsightFace buffalo_l recognition model -- CHECK ITS LICENCE before
commercial deployment (see LICENSES.md).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from ..._compat import lazy_import_onnxruntime
from ...config import settings

logger = logging.getLogger(__name__)


@dataclass
class IdentityResult:
    embedding: np.ndarray        # (512,) L2-normalized
    similarity: float | None     # cosine vs enrolment, or None if not enrolled


class IdentityEstimator:
    def __init__(self) -> None:
        from ..._compat import make_ort_session
        path = settings.model_path(settings.ARCFACE_MODEL)
        if not path.exists():
            raise FileNotFoundError(
                f"ArcFace model not found at {path}. Run scripts/download_models.py --all"
            )
        self.sess = make_ort_session(str(path), settings.ort_providers)
        self.input_name = self.sess.get_inputs()[0].name
        shape = self.sess.get_inputs()[0].shape   # [1,3,112,112]
        self.size = int(shape[3]) if isinstance(shape[3], int) else 112
        logger.info("Loaded ArcFace %s (input=%d) providers=%s",
                    settings.ARCFACE_MODEL, self.size, settings.ort_providers)

    def embed(self, aligned_bgr: np.ndarray) -> np.ndarray:
        """aligned_bgr: 112x112 aligned face crop. Returns L2-normalized 512-d embedding."""
        img = aligned_bgr.astype(np.float32)
        img = (img - 127.5) / 127.5               # [-1,1]
        img = img[:, :, ::-1]                      # BGR->RGB
        blob = np.transpose(img, (2, 0, 1))[None]  # NCHW
        blob = np.ascontiguousarray(blob, dtype=np.float32)
        out = self.sess.run(None, {self.input_name: blob})[0][0]
        norm = np.linalg.norm(out) + 1e-9
        return out / norm

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))   # both already L2-normalized

    def compare(self, aligned_bgr: np.ndarray, enrolled: np.ndarray | None) -> IdentityResult:
        emb = self.embed(aligned_bgr)
        sim = self.cosine(emb, enrolled) if enrolled is not None else None
        return IdentityResult(embedding=emb, similarity=sim)
