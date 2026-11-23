"""Decode incoming JPEG frames (binary or base64) into BGR ndarrays.

Kept deliberately small and dependency-light so the transport layer can stay abstract
(WebSocket today, WebRTC/aiortc later).
"""
from __future__ import annotations

import base64
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def decode_jpeg_bytes(data: bytes) -> np.ndarray | None:
    """Decode raw JPEG bytes to a BGR image. Returns None on failure."""
    if not data:
        return None
    buf = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        logger.warning("Failed to decode JPEG (%d bytes)", len(data))
    return img


def decode_jpeg_b64(b64: str) -> np.ndarray | None:
    """Decode a base64-encoded JPEG (optionally a data: URL) to a BGR image."""
    if not b64:
        return None
    if b64.startswith("data:"):
        # strip "data:image/jpeg;base64,"
        _, _, b64 = b64.partition(",")
    try:
        data = base64.b64decode(b64)
    except (ValueError, base64.binascii.Error) as exc:  # type: ignore[attr-defined]
        logger.warning("Bad base64 JPEG: %s", exc)
        return None
    return decode_jpeg_bytes(data)


def encode_jpeg_b64(img: np.ndarray, quality: int = 70) -> str:
    """Encode a BGR image to a base64 data URL (for debug annotated frames)."""
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
