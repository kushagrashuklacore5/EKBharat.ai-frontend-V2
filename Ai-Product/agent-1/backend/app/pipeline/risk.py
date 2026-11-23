"""Risk scoring.

Turns per-frame signals (Phase 1/2 BASELINE) or temporal-model probabilities (Phase 3)
into a smoothed 0-100 risk score plus discrete alerts with hysteresis and a minimum
duration, so alerts do not flicker.

The BASELINE scorer uses the per-frame model outputs with configurable thresholds and is
clearly labelled `BASELINE`. When `temporal_model.onnx` is present it is replaced
automatically by the temporal path (wired in Phase 3); the public interface is identical.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import settings
from ..schemas import Alert, State

logger = logging.getLogger(__name__)


@dataclass
class _AlertState:
    active: bool = False
    first_seen_ms: float | None = None
    since_ms: float = 0.0


@dataclass
class RiskState:
    risk_ema: float = 0.0
    looking_away_since_ms: float | None = None
    alerts: dict[str, _AlertState] = field(default_factory=dict)


class BaselineRiskScorer:
    """Per-session baseline risk. One instance per connected student."""

    MODE = "BASELINE"

    def __init__(self) -> None:
        self.state = RiskState()

    def _hysteresis(self, kind: str, raw_active: bool, ts_ms: float,
                    message: str, level: State) -> Alert | None:
        st = self.state.alerts.setdefault(kind, _AlertState())
        min_dur = settings.ALERT_MIN_DURATION_S * 1000.0
        if raw_active:
            if st.first_seen_ms is None:
                st.first_seen_ms = ts_ms
            st.since_ms = ts_ms - st.first_seen_ms
            if st.since_ms >= min_dur:
                st.active = True
        else:
            # Release immediately once the condition clears (could add a release delay).
            st.active = False
            st.first_seen_ms = None
            st.since_ms = 0.0
        if st.active:
            return Alert(kind=kind, state=level, message=message, since_ms=st.since_ms)
        return None

    def score(self, *, ts_ms: float, person_count: int, face_count: int,
              gaze_class: str | None, head_yaw: float | None,
              identity_score: float | None, movement_energy: float,
              object_labels: list[str] | None = None,
              hand_zone_flags: list[str] | None = None,
              head_pitch: float | None = None,
              gaze_offscreen: bool = False) -> tuple[float, list[Alert], str]:
        """Return (risk_0_100, alerts, temporal_class)."""
        object_labels = object_labels or []
        hand_zone_flags = hand_zone_flags or []
        instant = 0.0
        alerts: list[Alert] = []

        # --- Looking away (sustained) -> amber then red ---
        # Only CLEAR deviations count, so normal on-screen reading (small gaze angles,
        # a webcam mounted below eye level) does not false-positive. Mild gaze
        # left/right/up/down is ignored by the baseline; the temporal model (Phase 3)
        # handles the subtler "glancing at notes" cases from labelled data.
        # "Face not visible while a person is present" = the student has turned away from
        # the camera (back/side of head). This is a strong looking-away signal that the
        # head-pose/gaze path cannot see, because there is no face to measure.
        face_hidden = person_count >= 1 and face_count == 0
        away = (
            face_hidden
            or gaze_class == "off-screen"
            or gaze_offscreen
            or (head_yaw is not None and abs(head_yaw) > settings.HEADPOSE_AWAY_YAW_DEG)
            or (head_pitch is not None and abs(head_pitch) > settings.HEADPOSE_AWAY_PITCH_DEG)
        )
        if away:
            if self.state.looking_away_since_ms is None:
                self.state.looking_away_since_ms = ts_ms
            dur_s = (ts_ms - self.state.looking_away_since_ms) / 1000.0
        else:
            self.state.looking_away_since_ms = None
            dur_s = 0.0

        msg = "Face not visible (turned away)" if face_hidden else "Sustained looking away"
        if dur_s >= settings.LOOKING_AWAY_ALERT_S:
            instant += 75 if face_hidden else 55   # drive risk into the red when sustained
            a = self._hysteresis("looking_away", True, ts_ms, msg, State.VIOLATION)
            if a:
                alerts.append(a)
        elif dur_s >= settings.LOOKING_AWAY_WARN_S:
            instant += 45 if face_hidden else 25   # climb faster when clearly turned away
            self._hysteresis("looking_away", False, ts_ms, "", State.WARNING)
        else:
            self._hysteresis("looking_away", False, ts_ms, "", State.NORMAL)

        # --- Second person present ---
        second_person = person_count > 1 or "another_person" in object_labels
        if second_person:
            instant += 50
        a = self._hysteresis("other_person_present", second_person, ts_ms,
                             "Another person detected", State.VIOLATION)
        if a:
            alerts.append(a)

        # --- Person absent / no face ---
        absent = person_count == 0 and face_count == 0
        if absent:
            instant += 35
        a = self._hysteresis("person_absent", absent, ts_ms,
                             "Student not visible", State.VIOLATION)
        if a:
            alerts.append(a)

        # --- Prohibited object (Phase 2 feeds real labels) ---
        prohibited = [o for o in object_labels
                      if o in {"cell phone", "book", "paper", "tablet", "earphones"}]
        if prohibited:
            instant += 50
        a = self._hysteresis("prohibited_object", bool(prohibited), ts_ms,
                             f"Prohibited object: {', '.join(prohibited)}", State.VIOLATION)
        if a:
            alerts.append(a)

        # --- Identity mismatch (Phase 2 feeds real score) ---
        if identity_score is not None and identity_score < 0.4:
            instant += 40
            a = self._hysteresis("identity_mismatch", True, ts_ms,
                                 "Face does not match enrolment", State.VIOLATION)
            if a:
                alerts.append(a)
        else:
            self._hysteresis("identity_mismatch", False, ts_ms, "", State.NORMAL)

        # --- Suspicious hand movement (earpiece / hand-to-mouth) ---
        suspicious_hand = "hand_to_ear" in hand_zone_flags or "hand_to_mouth" in hand_zone_flags
        if suspicious_hand:
            instant += 25
        a = self._hysteresis("suspicious_hand_movement", suspicious_hand, ts_ms,
                             "Hand near ear/mouth (possible earpiece)", State.WARNING)
        if a:
            alerts.append(a)

        # --- Excess body movement (soft signal) ---
        instant += min(movement_energy, 1.0) * 10

        instant = min(instant, 100.0)
        a = settings.RISK_EMA_ALPHA
        self.state.risk_ema = a * instant + (1 - a) * self.state.risk_ema
        risk = round(self.state.risk_ema, 1)

        temporal_class = self._dominant_class(risk, alerts)
        return risk, alerts, temporal_class

    @staticmethod
    def _dominant_class(risk: float, alerts: list[Alert]) -> str:
        if alerts:
            # map alert kinds to the temporal class vocabulary
            mapping = {
                "looking_away": "looking_away",
                "other_person_present": "other_person_present",
                "person_absent": "person_absent",
                "prohibited_object": "phone_use",
                "identity_mismatch": "identity_mismatch",
                "suspicious_hand_movement": "suspicious_hand_movement",
            }
            return mapping.get(alerts[0].kind, "normal")
        return "normal"


# Per-class contribution to risk + whether it is a hard violation (red) or a warning.
_CLASS_WEIGHT = {
    "phone_use": 1.0, "other_person_present": 1.0, "identity_mismatch": 1.0,
    "person_absent": 0.9, "reading_material": 0.9, "looking_away": 0.8,
    "screen_switching": 0.7, "suspicious_hand_movement": 0.7, "talking": 0.5,
}
_CLASS_MESSAGE = {
    "phone_use": "Phone use detected", "other_person_present": "Another person detected",
    "identity_mismatch": "Face does not match enrolment", "person_absent": "Student not visible",
    "reading_material": "Reading material detected", "looking_away": "Looking away",
    "screen_switching": "Screen / tab switching", "suspicious_hand_movement": "Hand near ear/mouth",
    "talking": "Talking detected",
}


class TemporalRiskScorer:
    """Risk from the trained temporal model's per-class probabilities (hot-swap target).

    Same EMA + hysteresis + min-duration machinery as the baseline, but driven by learned
    probabilities instead of hand-written rules. Active whenever temporal_model.onnx loads.
    """

    MODE = "TEMPORAL"

    def __init__(self) -> None:
        self._ema = 0.0
        self._alerts: dict[str, _AlertState] = {}

    def _hysteresis(self, kind: str, raw_active: bool, ts_ms: float,
                    message: str, level: State) -> Alert | None:
        st = self._alerts.setdefault(kind, _AlertState())
        min_dur = settings.ALERT_MIN_DURATION_S * 1000.0
        if raw_active:
            if st.first_seen_ms is None:
                st.first_seen_ms = ts_ms
            st.since_ms = ts_ms - st.first_seen_ms
            st.active = st.since_ms >= min_dur
        else:
            st.active = False; st.first_seen_ms = None; st.since_ms = 0.0
        if st.active:
            return Alert(kind=kind, state=level, message=message, since_ms=st.since_ms)
        return None

    def score(self, ts_ms: float, class_probs: dict[str, float]
              ) -> tuple[float, list[Alert], str]:
        alerts: list[Alert] = []
        weighted = 0.0
        dominant, dom_p = "normal", 0.0
        thr = settings.TEMPORAL_CLASS_THRESH
        for cls, w in _CLASS_WEIGHT.items():
            p = class_probs.get(cls, 0.0)
            weighted = max(weighted, p * w)
            if p > dom_p:
                dominant, dom_p = cls, p
            active = p >= thr
            level = State.VIOLATION if w >= 0.8 else State.WARNING
            a = self._hysteresis(cls, active, ts_ms, _CLASS_MESSAGE.get(cls, cls), level)
            if a:
                alerts.append(a)
        inst = min(weighted * 100.0, 100.0)
        a = settings.RISK_EMA_ALPHA
        self._ema = a * inst + (1 - a) * self._ema
        temporal_class = dominant if dom_p >= thr else "normal"
        return round(self._ema, 1), alerts, temporal_class
