"""Start-of-exam calibration: face enrolment, gaze calibration, environment check.

Driven by WebSocket messages from the client (see main.py). The manager reads the
pipeline's latest per-frame state (primary-face embedding, gaze angles, brightness,
counts, framing) so calibration uses the exact same inference path as live proctoring.

Exam start is blocked until `is_complete` is True (enrolled + environment passed; gaze
calibration is recommended but can be skipped per policy).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ..config import settings
from .estimators.gaze_l2cs import GazeCalibration

logger = logging.getLogger(__name__)


@dataclass
class EnvCheck:
    ok: bool
    issues: list[str] = field(default_factory=list)
    brightness: float = 0.0
    face_count: int = 0
    face_frac: float = 0.0


@dataclass
class LatestState:
    """Snapshot of the most recent frame's signals, written by the pipeline."""
    embedding: np.ndarray | None = None
    gaze_yaw: float | None = None
    gaze_pitch: float | None = None
    head_yaw: float | None = None
    head_pitch: float | None = None
    ear: float | None = None
    brightness: float = 0.0
    face_count: int = 0
    person_count: int = 0
    face_frac: float = 0.0
    object_labels: list[str] = field(default_factory=list)


class CalibrationManager:
    def __init__(self) -> None:
        self._emb_sum: np.ndarray | None = None
        self._emb_n = 0
        self.enrolled_embedding: np.ndarray | None = None
        self.gaze = GazeCalibration()
        self._gaze_samples: list[tuple[float, float, float, float]] = []
        self.baseline_head: tuple[float, float] | None = None
        self.env_passed = False
        # active liveness challenge state
        self._blinks = 0
        self._eye_closed = False
        self._turned_left = False
        self._turned_right = False
        self.liveness_passed = False

    # --- face enrolment -------------------------------------------------
    def enroll_frame(self, state: LatestState) -> dict:
        if state.embedding is None:
            return {"ok": False, "captured": self._emb_n, "need": settings.IDENTITY_ENROLL_FRAMES,
                    "message": "no face detected"}
        self._emb_sum = state.embedding.copy() if self._emb_sum is None else self._emb_sum + state.embedding
        self._emb_n += 1
        if self._emb_n >= settings.IDENTITY_ENROLL_FRAMES:
            avg = self._emb_sum / self._emb_n
            self.enrolled_embedding = avg / (np.linalg.norm(avg) + 1e-9)
            logger.info("Enrolment complete over %d frames", self._emb_n)
        return {
            "ok": True,
            "captured": self._emb_n,
            "need": settings.IDENTITY_ENROLL_FRAMES,
            "enrolled": self.enrolled_embedding is not None,
        }

    @property
    def is_enrolled(self) -> bool:
        return self.enrolled_embedding is not None

    # --- gaze calibration ----------------------------------------------
    def add_gaze_sample(self, state: LatestState, target_x: float, target_y: float) -> dict:
        if state.gaze_yaw is None or state.gaze_pitch is None:
            return {"ok": False, "samples": len(self._gaze_samples), "message": "no gaze"}
        self._gaze_samples.append((state.gaze_yaw, state.gaze_pitch, target_x, target_y))
        fitted = False
        if len(self._gaze_samples) >= 5:
            fitted = self.gaze.fit(self._gaze_samples)
        if self.baseline_head is None and state.head_yaw is not None:
            self.baseline_head = (state.head_yaw, state.head_pitch or 0.0)
        return {"ok": True, "samples": len(self._gaze_samples), "gaze_ready": fitted}

    # --- environment check ---------------------------------------------
    def environment_check(self, state: LatestState) -> EnvCheck:
        issues: list[str] = []
        if state.brightness < settings.CALIB_MIN_BRIGHTNESS:
            issues.append("too_dark")
        if state.brightness > settings.CALIB_MAX_BRIGHTNESS:
            issues.append("too_bright_or_backlit")
        if state.face_count == 0:
            issues.append("no_face")
        elif state.face_count > 1:
            issues.append("multiple_faces")
        if state.object_labels:
            issues.append("prohibited_object:" + ",".join(sorted(set(state.object_labels))))
        if state.face_count >= 1 and state.face_frac < settings.CALIB_MIN_FACE_FRAC:
            issues.append("face_too_small_or_far")
        self.env_passed = len(issues) == 0
        return EnvCheck(ok=self.env_passed, issues=issues,
                        brightness=round(state.brightness, 1),
                        face_count=state.face_count, face_frac=round(state.face_frac, 3))

    # --- active liveness (anti-spoof) ----------------------------------
    def update_liveness(self, state: LatestState) -> dict:
        """Count blinks (EAR dip+recover) and detect left/right head turns.

        A printed photo or static image cannot blink on cue or turn in 3D, so passing this
        challenge is strong evidence the face is a live person in front of the camera.
        """
        if state.ear is not None:
            closed = state.ear < settings.EAR_CLOSED_THRESH
            if closed and not self._eye_closed:
                self._eye_closed = True
            elif not closed and self._eye_closed:
                self._eye_closed = False
                self._blinks += 1
        if state.head_yaw is not None:
            if state.head_yaw <= -settings.LIVENESS_TURN_YAW_DEG:
                self._turned_left = True
            if state.head_yaw >= settings.LIVENESS_TURN_YAW_DEG:
                self._turned_right = True
        self.liveness_passed = (
            self._blinks >= settings.LIVENESS_NEED_BLINKS
            and self._turned_left and self._turned_right
        )
        return {
            "ok": True, "blinks": self._blinks, "need_blinks": settings.LIVENESS_NEED_BLINKS,
            "turned_left": self._turned_left, "turned_right": self._turned_right,
            "liveness_passed": self.liveness_passed,
        }

    # --- gating ---------------------------------------------------------
    @property
    def is_complete(self) -> bool:
        live_ok = self.liveness_passed or not settings.LIVENESS_REQUIRED
        return self.is_enrolled and self.env_passed and live_ok
