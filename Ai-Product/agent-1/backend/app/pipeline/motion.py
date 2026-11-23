"""Body-motion metrics from pose keypoints.

Phase 1 computes keypoint velocity (px/s, normalized by shoulder width), a 0..1
movement-energy score, and basic posture flags (leaning, turning, standing, hands
below desk / out of frame, hand-to-ear / hand-to-mouth). Optical flow and richer
posture modelling arrive in Phase 2; the per-frame outputs here already feed the
feature vector.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# COCO keypoint indices
NOSE = 0
L_EAR, R_EAR = 3, 4
L_SHO, R_SHO = 5, 6
L_ELB, R_ELB = 7, 8
L_WRI, R_WRI = 9, 10
L_HIP, R_HIP = 11, 12

KP_CONF_MIN = 0.3
DESK_LINE_FRAC = 0.85            # wrists below this fraction of frame height => below desk


@dataclass
class MotionMetrics:
    kpt_velocity: float = 0.0        # normalized px/s
    movement_energy: float = 0.0     # 0..1
    posture_flags: list[str] = field(default_factory=list)
    hand_zone_flags: list[str] = field(default_factory=list)  # hand_to_ear/mouth, hands_below_desk
    flow_energy: float = 0.0         # optional optical-flow global motion (0..1)


@dataclass
class _TrackState:
    last_pts: np.ndarray             # (17,3)
    last_ts: float


class MotionTracker:
    """Keeps per-track keypoint history to derive velocity and posture."""

    def __init__(self, energy_norm: float = 3.0) -> None:
        # energy_norm: velocity (in shoulder-widths/sec) that maps to energy 1.0
        self.energy_norm = energy_norm
        self._state: dict[int, _TrackState] = {}

    @staticmethod
    def _valid(pt: np.ndarray) -> bool:
        return pt[2] >= KP_CONF_MIN

    def _shoulder_width(self, pts: np.ndarray) -> float:
        if self._valid(pts[L_SHO]) and self._valid(pts[R_SHO]):
            w = float(np.linalg.norm(pts[L_SHO, :2] - pts[R_SHO, :2]))
            return max(w, 1.0)
        return 100.0  # fallback scale

    def update(self, track_id: int, keypoints: np.ndarray, ts: float,
               frame_h: int) -> MotionMetrics:
        """keypoints: (17,3) array of x,y,conf in source pixels."""
        m = MotionMetrics()
        sw = self._shoulder_width(keypoints)

        prev = self._state.get(track_id)
        if prev is not None and ts > prev.last_ts:
            dt = ts - prev.last_ts
            valid = (keypoints[:, 2] >= KP_CONF_MIN) & (prev.last_pts[:, 2] >= KP_CONF_MIN)
            if valid.any():
                disp = np.linalg.norm(
                    keypoints[valid, :2] - prev.last_pts[valid, :2], axis=1
                )
                vel_px_s = float(disp.mean() / dt)
                m.kpt_velocity = vel_px_s / sw               # shoulder-widths / s
                m.movement_energy = float(np.clip(m.kpt_velocity / self.energy_norm, 0.0, 1.0))

        self._state[track_id] = _TrackState(keypoints.copy(), ts)
        m.posture_flags = self._posture(keypoints, frame_h, sw)
        m.hand_zone_flags = self._hand_zones(keypoints, frame_h, sw)
        return m

    def _hand_zones(self, pts: np.ndarray, frame_h: int, sw: float) -> list[str]:
        """Explicit hand-zone flags feeding features.HAND_ZONE_FLAGS."""
        flags: list[str] = []
        v = self._valid
        ears = [pts[i, :2] for i in (L_EAR, R_EAR) if v(pts[i])]
        for wri in (L_WRI, R_WRI):
            if not v(pts[wri]):
                continue
            wp = pts[wri, :2]
            # hand to ear (earpiece)
            if ears and min(float(np.linalg.norm(wp - e)) for e in ears) < 0.5 * sw:
                if "hand_to_ear" not in flags:
                    flags.append("hand_to_ear")
            # hand to mouth (nose as face anchor)
            if v(pts[NOSE]) and float(np.linalg.norm(wp - pts[NOSE, :2])) < 0.55 * sw:
                if "hand_to_mouth" not in flags:
                    flags.append("hand_to_mouth")
        # hands below desk: both wrists hidden or below the desk line
        below = 0
        for wri in (L_WRI, R_WRI):
            if not v(pts[wri]) or pts[wri, 1] > frame_h * DESK_LINE_FRAC:
                below += 1
        if below == 2:
            flags.append("hands_below_desk")
        return flags

    def _posture(self, pts: np.ndarray, frame_h: int, sw: float) -> list[str]:
        flags: list[str] = []
        v = self._valid

        # Torso turn / lean from shoulder & hip geometry.
        if v(pts[L_SHO]) and v(pts[R_SHO]):
            shoulder_dx = pts[R_SHO, 0] - pts[L_SHO, 0]
            # Narrow shoulder span relative to expected => torso turned.
            if abs(shoulder_dx) < 0.55 * sw:
                flags.append("torso_turned")
            mid_sho = (pts[L_SHO, :2] + pts[R_SHO, :2]) / 2
            if v(pts[NOSE]):
                lean = (pts[NOSE, 0] - mid_sho[0]) / sw
                if lean > 0.5:
                    flags.append("leaning_right")
                elif lean < -0.5:
                    flags.append("leaning_left")
                # Strong lean + turned torso = leaning out of frame to peek at notes/another screen.
                if abs(lean) > 0.7 and "torso_turned" in flags:
                    flags.append("leaning_to_peek")

        # Standing up: hips above mid-frame (person moved up/closer dramatically).
        if v(pts[L_HIP]) and v(pts[R_HIP]):
            hip_y = (pts[L_HIP, 1] + pts[R_HIP, 1]) / 2
            if hip_y < frame_h * 0.35:
                flags.append("standing_up")

        # Hands not visible / below desk (wrists low-confidence or below frame bottom).
        hands_hidden = 0
        for wri in (L_WRI, R_WRI):
            if not v(pts[wri]) or pts[wri, 1] > frame_h * 0.95:
                hands_hidden += 1
        if hands_hidden == 2:
            flags.append("hands_not_visible")
        elif hands_hidden == 1:
            flags.append("one_hand_hidden")

        # Hand-to-ear (earpiece) / hand-to-mouth proxies using nose as face anchor.
        if v(pts[NOSE]):
            face = pts[NOSE, :2]
            for wri, side in ((L_WRI, "left"), (R_WRI, "right")):
                if v(pts[wri]):
                    d = float(np.linalg.norm(pts[wri, :2] - face)) / sw
                    if d < 0.8:
                        flags.append(f"hand_near_face_{side}")
        return flags

    def forget(self, active_ids: set[int]) -> None:
        for tid in list(self._state):
            if tid not in active_ids:
                self._state.pop(tid, None)


class FlowEnergy:
    """Global optical-flow motion energy (Farneback) on a downscaled grayscale frame.

    Optional and config-gated (USE_OPTICAL_FLOW) because dense flow is costly on CPU.
    Returns a 0..1 scalar = mean flow magnitude normalized, a scene-level movement cue
    that complements per-person keypoint velocity (e.g. someone moving off-camera).
    """

    def __init__(self, down: int = 4, norm: float = 6.0) -> None:
        self.down = down
        self.norm = norm
        self._prev = None

    def update(self, frame_bgr) -> float:
        import cv2
        small = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(small, (small.shape[1] // self.down, small.shape[0] // self.down))
        if self._prev is None:
            self._prev = small
            return 0.0
        flow = cv2.calcOpticalFlowFarneback(
            self._prev, small, None, 0.5, 2, 15, 2, 5, 1.2, 0
        )
        self._prev = small
        mag = (flow[..., 0] ** 2 + flow[..., 1] ** 2) ** 0.5
        return float(min(mag.mean() / self.norm, 1.0))
