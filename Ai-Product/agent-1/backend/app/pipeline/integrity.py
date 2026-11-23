"""Hard integrity rules applied ON TOP of the behavioural risk (baseline OR temporal).

These are signals that should never be a learned "maybe" -- a second voice, a second
monitor, devtools, screen sharing, leaving fullscreen -- plus a pose "leaning to peek"
cue. They come from the client (audio VAD + browser integrity events) and from the pose
stage, and they raise a risk FLOOR and fire alerts regardless of which risk engine is
active, so they work in both BASELINE and TEMPORAL mode.

Each signal is "active" if seen within ACTIVE_WINDOW_S (the client re-sends state events
periodically). Alerts use the same min-duration hysteresis as the risk engines.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..config import settings
from ..schemas import Alert, State

# signal -> (risk floor 0..100, alert level, human message)
_SIGNALS: dict[str, tuple[float, State, str]] = {
    "spoof": (88, State.VIOLATION, "Fake / spoofed face detected (anti-spoof)"),
    "second_voice": (85, State.VIOLATION, "Second voice heard (someone else talking)"),
    "devtools_open": (80, State.VIOLATION, "Developer tools opened"),
    "screen_share": (75, State.VIOLATION, "Screen sharing / capture detected"),
    "multi_monitor": (70, State.VIOLATION, "Second monitor connected"),
    "remote_desktop": (80, State.VIOLATION, "Remote-desktop / VM indicators"),
    "leaning_to_peek": (55, State.WARNING, "Leaning out of frame (peeking)"),
    "fullscreen_exit": (45, State.WARNING, "Left fullscreen / kiosk"),
    "no_blink": (50, State.WARNING, "No blink for a long time (possible photo)"),
    "clipboard": (40, State.WARNING, "Clipboard copy/paste"),
    "voice_active": (30, State.WARNING, "Talking detected (voice)"),
    "tab_hidden": (45, State.WARNING, "Tab hidden / switched away"),
}


@dataclass
class _Sig:
    last_seen_ms: float = -1e18
    first_active_ms: float | None = None
    alerting: bool = False


class IntegrityMonitor:
    ACTIVE_WINDOW_S = 3.0

    def __init__(self) -> None:
        self._sig: dict[str, _Sig] = {}

    def update(self, ts_ms: float, events: list[str], posture_flags: list[str]
               ) -> tuple[float, list[Alert]]:
        # Pose-derived peek signal enters the same channel.
        if "leaning_to_peek" in posture_flags:
            events = list(events) + ["leaning_to_peek"]
        for e in events:
            if e in _SIGNALS:
                self._sig.setdefault(e, _Sig()).last_seen_ms = ts_ms

        window = self.ACTIVE_WINDOW_S * 1000.0
        min_dur = settings.ALERT_MIN_DURATION_S * 1000.0
        floor = 0.0
        alerts: list[Alert] = []
        for name, (w, level, msg) in _SIGNALS.items():
            st = self._sig.get(name)
            active = st is not None and (ts_ms - st.last_seen_ms) <= window
            if active:
                floor = max(floor, w)
                if st.first_active_ms is None:
                    st.first_active_ms = ts_ms
                since = ts_ms - st.first_active_ms
                if since >= min_dur:
                    alerts.append(Alert(kind=name, state=level, message=msg, since_ms=since))
            elif st is not None:
                st.first_active_ms = None
        return floor, alerts
