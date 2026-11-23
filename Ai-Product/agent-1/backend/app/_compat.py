"""Lazy imports for heavy optional dependencies.

Importing ultralytics / mediapipe at module load makes the whole app slow to import
and brittle in test/CI environments. These helpers defer the import to first use and
raise a clear, actionable error if the dependency is missing.
"""
from __future__ import annotations

import importlib
from functools import lru_cache
from typing import Any


class MissingDependency(RuntimeError):
    pass


def _require(module: str, pip_hint: str) -> Any:
    try:
        return importlib.import_module(module)
    except ImportError as exc:  # pragma: no cover - env dependent
        raise MissingDependency(
            f"'{module}' is required but not installed. Install with: {pip_hint}"
        ) from exc


@lru_cache(maxsize=1)
def lazy_import_ultralytics() -> Any:
    """Return the Ultralytics YOLO class."""
    mod = _require("ultralytics", "pip install ultralytics")
    return mod.YOLO


@lru_cache(maxsize=1)
def lazy_import_mediapipe() -> Any:
    """Return the mediapipe module."""
    return _require("mediapipe", "pip install mediapipe")


@lru_cache(maxsize=1)
def lazy_import_onnxruntime() -> Any:
    """Return the onnxruntime module (Phase 2 ONNX estimators)."""
    return _require("onnxruntime", "pip install onnxruntime  # or onnxruntime-gpu")


def make_ort_session(path: str, providers: list[str]):
    """Create an ONNX Runtime session tuned for throughput.

    Uses all CPU cores (intra-op) and full graph optimization. This matters a lot on CPU
    hosts where ONNX Runtime otherwise under-uses the machine (e.g. SCRFD/ArcFace).
    """
    from .config import settings

    ort = lazy_import_onnxruntime()
    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    # Leave intra_op_num_threads at the ORT default (physical cores); forcing it to the
    # logical-core count caused contention/slowdowns on hyperthreaded CPUs in testing.
    if settings.ORT_INTRA_THREADS > 0:
        so.intra_op_num_threads = settings.ORT_INTRA_THREADS
    return ort.InferenceSession(path, sess_options=so, providers=providers)
