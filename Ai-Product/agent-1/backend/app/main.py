"""FastAPI application + WebSocket proctoring endpoint.

Transport contract (kept abstract so WebRTC/aiortc can replace it later):
  1. Client connects to  ws://<host>/ws/proctor
  2. Client sends a JSON `hello` {session_id, student_id?, mirrored, debug}
  3. Client streams frames, either:
       - JSON  {type:"frame", frame_id, ts_client_ms, jpeg_b64}
       - or a binary message: 16-byte header (frame_id uint32, ts_client_ms float64,
         flags uint32) followed by raw JPEG bytes  (lower overhead; preferred)
  4. Client may also send JSON `browser_event` messages.
  5. Server replies with a JSON `result` per processed frame_id.

The server processes **only the most recent frame** per connection and drops stale ones
(DROP_STALE_FRAMES) -- it never builds a queue. CPU-bound inference runs in a thread so
the event loop keeps draining the socket.
"""
from __future__ import annotations

import asyncio
import json
import logging
import struct
import time
from collections import deque

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .pipeline.frame_decoder import decode_jpeg_b64, decode_jpeg_bytes
from .pipeline.pipeline import ProctorPipeline
from .schemas import ServerError

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("proctor")

app = FastAPI(title="EKBharat AI Proctoring", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_BIN_HEADER = struct.Struct("<IdI")  # frame_id(uint32), ts_client_ms(float64), flags(uint32)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "version": "0.2.0",
        "phase": 2,
        "device": settings.DEVICE,
        "pose_model": settings.POSE_MODEL,
        "object_model": settings.OBJECT_MODEL,
        "target_fps": settings.TARGET_FPS,
    })


class Connection:
    """Per-socket state: latest-frame slot + a single processing worker."""

    def __init__(self, ws: WebSocket, session_id: str, debug: bool) -> None:
        self.ws = ws
        self.session_id = session_id
        self.debug = debug
        self.pipeline = ProctorPipeline(session_id)
        self._latest: tuple[bytes, int, float] | None = None   # (jpeg, frame_id, ts)
        self._event = asyncio.Event()
        self._browser_events: deque[str] = deque(maxlen=32)
        self._closing = False
        self._dropped = 0

    def submit(self, jpeg: bytes, frame_id: int, ts_client_ms: float) -> None:
        if settings.DROP_STALE_FRAMES and self._latest is not None:
            self._dropped += 1
        self._latest = (jpeg, frame_id, ts_client_ms)
        self._event.set()

    async def worker(self) -> None:
        """Consume the latest frame, process in a thread, send result. Repeat."""
        loop = asyncio.get_running_loop()
        while not self._closing:
            await self._event.wait()
            self._event.clear()
            item = self._latest
            self._latest = None
            if item is None:
                continue
            jpeg, frame_id, ts = item
            try:
                img = decode_jpeg_bytes(jpeg)
                if img is None:
                    await self._send_error(frame_id, "decode_failed")
                    continue
                events = list(self._browser_events)
                self._browser_events.clear()
                result = await loop.run_in_executor(
                    None, self.pipeline.process, img, frame_id, ts, self.debug, events
                )
                await self.ws.send_text(result.model_dump_json())
            except WebSocketDisconnect:
                break
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Processing error for %s: %s", self.session_id, exc)
                await self._send_error(frame_id, str(exc))

    async def _send_error(self, frame_id: int, msg: str) -> None:
        try:
            await self.ws.send_text(ServerError(frame_id=frame_id, message=msg).model_dump_json())
        except Exception:
            pass

    def close(self) -> None:
        self._closing = True
        self._event.set()
        try:
            self.pipeline.close()
        except Exception:
            pass
        logger.info("Session %s closed (dropped %d stale frames)", self.session_id, self._dropped)


async def _handle_calibration(conn: "Connection", payload: dict) -> None:
    """Handle calibrate_* messages against the pipeline's latest frame state.

    Message types:
      calibrate_enroll  -> capture one enrolment frame (avg ArcFace over N)
      calibrate_gaze    -> {target_x, target_y} capture a gaze-dot sample
      calibrate_env     -> run the environment check on the current frame
      calibrate_status  -> report enrolment / gaze / env / complete flags
      calibrate_reset   -> start calibration over
    """
    cal = conn.pipeline.calibration
    state = conn.pipeline.latest_state
    mtype = payload["type"]
    resp: dict = {"type": mtype + "_result"}

    if mtype == "calibrate_enroll":
        resp.update(cal.enroll_frame(state))
    elif mtype == "calibrate_gaze":
        resp.update(cal.add_gaze_sample(
            state, float(payload.get("target_x", 0.5)), float(payload.get("target_y", 0.5))))
    elif mtype == "calibrate_env":
        ec = cal.environment_check(state)
        resp.update({"ok": ec.ok, "issues": ec.issues, "brightness": ec.brightness,
                     "face_count": ec.face_count, "face_frac": ec.face_frac})
    elif mtype == "calibrate_liveness":
        resp.update(cal.update_liveness(state))
    elif mtype == "calibrate_reset":
        conn.pipeline.calibration = cal.__class__()
        resp.update({"ok": True})
    # Always include the gating summary.
    cal = conn.pipeline.calibration
    resp["summary"] = {
        "enrolled": cal.is_enrolled,
        "gaze_ready": cal.gaze.ready,
        "env_passed": cal.env_passed,
        "liveness_passed": cal.liveness_passed,
        "complete": cal.is_complete,
    }
    await conn.ws.send_text(json.dumps(resp))


@app.websocket("/ws/proctor")
async def proctor_ws(ws: WebSocket) -> None:
    await ws.accept()
    conn: Connection | None = None
    worker_task: asyncio.Task | None = None
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break

            # Binary frame (preferred path).
            if msg.get("bytes") is not None:
                data: bytes = msg["bytes"]
                if conn is None:
                    # No hello yet; ignore until we have a session.
                    continue
                if len(data) <= _BIN_HEADER.size:
                    continue
                frame_id, ts_ms, _flags = _BIN_HEADER.unpack(data[:_BIN_HEADER.size])
                conn.submit(data[_BIN_HEADER.size:], int(frame_id), float(ts_ms))
                continue

            # Text / JSON messages.
            text = msg.get("text")
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            mtype = payload.get("type")

            if mtype == "hello":
                session_id = payload.get("session_id") or f"sess-{int(time.time())}"
                debug = bool(payload.get("debug", False))
                conn = Connection(ws, session_id, debug)
                worker_task = asyncio.create_task(conn.worker())
                await ws.send_text(json.dumps({
                    "type": "ready", "session_id": session_id,
                    "capabilities": conn.pipeline.capabilities,
                }))
                logger.info("Session %s started (debug=%s) caps=%s",
                            session_id, debug, conn.pipeline.capabilities)

            elif mtype == "frame" and conn is not None:
                b64 = payload.get("jpeg_b64")
                img = decode_jpeg_b64(b64) if b64 else None
                if img is None:
                    await conn._send_error(payload.get("frame_id", -1), "decode_failed")
                    continue
                # Re-encode is wasteful; store the already-decoded bytes path instead.
                # To keep the worker uniform we hand it the original base64-decoded JPEG.
                import base64
                raw = base64.b64decode(b64.split(",")[-1])
                conn.submit(raw, int(payload.get("frame_id", 0)),
                            float(payload.get("ts_client_ms", time.time() * 1000)))

            elif mtype == "browser_event" and conn is not None:
                conn._browser_events.append(payload.get("event", "unknown"))

            elif mtype and mtype.startswith("calibrate_") and conn is not None:
                await _handle_calibration(conn, payload)

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        logger.exception("WS error: %s", exc)
    finally:
        if conn is not None:
            conn.close()
        if worker_task is not None:
            worker_task.cancel()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
