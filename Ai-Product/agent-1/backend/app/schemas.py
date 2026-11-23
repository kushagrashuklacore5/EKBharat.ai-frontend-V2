"""Pydantic message schemas for the WebSocket protocol.

All coordinates the backend emits are in the **source frame pixel space**
(FRAME_WIDTH x FRAME_HEIGHT, un-mirrored). The client is responsible for mapping
them to its displayed/mirrored canvas (see frontend/src/lib/geometry.ts). Keeping the
server in one canonical space is what makes the overlay pixel-accurate.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


# --- Client -> Server -------------------------------------------------------
class ClientHello(BaseModel):
    """First message a client sends after connecting."""
    type: Literal["hello"] = "hello"
    session_id: str
    student_id: Optional[str] = None
    mirrored: bool = True                 # selfie preview is mirrored by default
    debug: bool = False                   # request annotated JPEG back


class FrameMessage(BaseModel):
    """A single JPEG frame. Sent as JSON header + binary, or base64 in `jpeg_b64`."""
    type: Literal["frame"] = "frame"
    frame_id: int
    ts_client_ms: float                   # client capture timestamp (ms epoch)
    jpeg_b64: Optional[str] = None        # base64 JPEG when not using binary channel


class BrowserEvent(BaseModel):
    """Browser integrity event (tab switch, blur, fullscreen exit, etc.)."""
    type: Literal["browser_event"] = "browser_event"
    ts_client_ms: float
    event: Literal[
        "tab_hidden", "tab_visible", "blur", "focus",
        "fullscreen_exit", "copy", "paste", "contextmenu",
        "devtools_open", "resize",
    ]
    detail: Optional[str] = None


# --- Geometry primitives ----------------------------------------------------
class Box(BaseModel):
    """Axis-aligned box in source-frame pixels (x,y = top-left)."""
    x: float
    y: float
    w: float
    h: float


class Point(BaseModel):
    x: float
    y: float
    z: float = 0.0                        # normalized depth where available (landmarks)
    v: Optional[float] = None             # visibility/confidence where available


class State(str, Enum):
    """Colour state for a drawable element (maps to overlay colours client-side)."""
    NORMAL = "normal"     # green
    WARNING = "warning"   # amber
    VIOLATION = "violation"  # red
    NEUTRAL = "neutral"   # blue


# --- Per-person / per-face payloads -----------------------------------------
class PersonResult(BaseModel):
    track_id: int
    box: Box
    confidence: float
    keypoints: list[Point]                # 17 COCO keypoints (may be empty if occluded)
    state: State = State.NORMAL
    # motion metrics (basic in Phase 1; expanded Phase 2)
    movement_energy: float = 0.0          # 0..1
    kpt_velocity: float = 0.0             # px/s normalized by shoulder width
    posture_flags: list[str] = Field(default_factory=list)


class EyeResult(BaseModel):
    box: Box
    iris_center: Optional[Point] = None
    ear: Optional[float] = None           # eye aspect ratio


class FaceResult(BaseModel):
    track_id: int
    box: Box
    confidence: float
    state: State = State.NORMAL
    landmarks: list[Point] = Field(default_factory=list)   # 478 dense points (may be downsampled for mesh)
    left_eye: Optional[EyeResult] = None
    right_eye: Optional[EyeResult] = None
    mouth_box: Optional[Box] = None
    mar: Optional[float] = None
    # head pose (degrees)
    yaw: Optional[float] = None
    pitch: Optional[float] = None
    roll: Optional[float] = None
    head_axis: Optional[dict[str, list[float]]] = None     # {"origin":[x,y], "x":[..],"y":[..],"z":[..]}
    # gaze
    gaze_class: Optional[str] = None      # center/left/right/up/down/off-screen
    gaze_left: Optional[dict[str, list[float]]] = None     # {"origin":[x,y], "dir":[dx,dy]}
    gaze_right: Optional[dict[str, list[float]]] = None
    gaze_point: Optional[list[float]] = None               # calibrated on-screen point [0..1,0..1]
    # Phase 2 fields
    emotions: Optional[list[dict[str, float]]] = None      # top-3 [{"label","prob"}]
    identity_score: Optional[float] = None


class ObjectResult(BaseModel):
    """Prohibited / neutral object (Phase 2+). Included in schema now for stability."""
    track_id: int
    label: str
    box: Box
    confidence: float
    state: State = State.NEUTRAL


# --- HUD + risk -------------------------------------------------------------
class Hud(BaseModel):
    fps: float = 0.0
    latency_ms: float = 0.0
    yaw: Optional[float] = None
    pitch: Optional[float] = None
    roll: Optional[float] = None
    gaze_class: Optional[str] = None
    ear: Optional[float] = None
    mar: Optional[float] = None
    movement_energy: float = 0.0
    top_emotion: Optional[str] = None
    identity_score: Optional[float] = None
    risk_score: float = 0.0               # 0..100
    temporal_class: str = "normal"
    mode: str = "BASELINE"                # "BASELINE" until temporal_model.onnx loads


class Alert(BaseModel):
    kind: str                             # e.g. "looking_away", "second_person", "phone"
    state: State
    message: str
    since_ms: float


# --- Server -> Client -------------------------------------------------------
class FrameResult(BaseModel):
    """One analysis result, echoed back with the frame_id it belongs to."""
    type: Literal["result"] = "result"
    frame_id: int
    ts_client_ms: float
    ts_server_ms: float                   # when the server finished (for interpolation)
    source_w: int
    source_h: int
    persons: list[PersonResult] = Field(default_factory=list)
    faces: list[FaceResult] = Field(default_factory=list)
    objects: list[ObjectResult] = Field(default_factory=list)
    hud: Hud = Field(default_factory=Hud)
    alerts: list[Alert] = Field(default_factory=list)
    debug_jpeg_b64: Optional[str] = None  # only when debug requested


class ServerError(BaseModel):
    type: Literal["error"] = "error"
    frame_id: Optional[int] = None
    message: str
