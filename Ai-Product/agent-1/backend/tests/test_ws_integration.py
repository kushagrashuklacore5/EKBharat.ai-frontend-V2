"""End-to-end WebSocket transport test using FastAPI's TestClient.

Verifies: hello -> ready handshake, binary-frame submission, and that a well-formed
`result` message comes back for the submitted frame_id, with the expected schema. Runs
the real pipeline (YOLO + MediaPipe), so it is skipped automatically if weights/models
cannot load in the environment.
"""
import struct
import time

import cv2
import numpy as np
import pytest

_BIN = struct.Struct("<IdI")


def _synthetic_jpeg() -> bytes:
    img = (np.random.default_rng(1).integers(40, 90, (480, 640, 3))).astype("uint8")
    cv2.ellipse(img, (320, 240), (90, 120), 0, 0, 360, (180, 170, 160), -1)
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    return buf.tobytes()


def test_ws_roundtrip():
    try:
        from fastapi.testclient import TestClient
        from app.main import app
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"app import failed: {exc}")

    client = TestClient(app)
    # Health first.
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["phase"] == 2

    with client.websocket_connect("/ws/proctor") as ws:
        ws.send_json({"type": "hello", "session_id": "test", "mirrored": True, "debug": False})
        ready = ws.receive_json()
        assert ready["type"] == "ready"

        jpeg = _synthetic_jpeg()
        header = _BIN.pack(7, time.time() * 1000, 0)
        ws.send_bytes(header + jpeg)

        # The worker processes asynchronously; the next message should be our result.
        msg = ws.receive_json()
        assert msg["type"] == "result"
        assert msg["frame_id"] == 7
        assert msg["source_w"] == 640 and msg["source_h"] == 480
        assert "hud" in msg and "risk_score" in msg["hud"]
        assert msg["hud"]["mode"] == "BASELINE"
        # persons/faces are lists (possibly empty on a synthetic frame).
        assert isinstance(msg["persons"], list)
        assert isinstance(msg["faces"], list)
