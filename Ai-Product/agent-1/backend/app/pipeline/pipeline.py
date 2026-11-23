"""Per-session proctoring pipeline orchestration (Phase 2).

One `ProctorPipeline` instance per connected student. Runs the per-frame stages with
configurable per-detector strides, applies smoothing, builds the feature vector + risk
score, writes flagged snapshots, and exposes the latest state for calibration.

Stages (each guarded so a missing model degrades gracefully, never crashes the stream):
  pose (YOLO11) · face mesh (MediaPipe 478) · face detect (SCRFD) · head pose (6DRepNet)
  · gaze (L2CS) · emotion (HSEmotion) · identity (ArcFace) · objects (YOLO11s/ByteTrack)
  · motion/hand-zones · features · baseline risk · snapshots
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from ..config import settings
from ..schemas import (
    Alert, Box, EyeResult, FaceResult, FrameResult, Hud, ObjectResult, PersonResult,
    Point, State,
)
from .calibration import CalibrationManager, LatestState
from .detectors.face import FaceTracker
from .detectors.landmarks import FaceLandmarkDetector, FaceLandmarks
from .detectors.person_pose import COCO_SKELETON, PersonPoseDetector
from .estimators import gaze as gaze_geom
from .estimators import head_pose as head_pose_geom
from .estimators.face_align import five_points_from_mediapipe, norm_crop
from .features import build_feature_vector
from .frame_decoder import encode_jpeg_b64
from .integrity import IntegrityMonitor
from .motion import FlowEnergy, MotionTracker
from .risk import BaselineRiskScorer, TemporalRiskScorer
from .temporal_model import TemporalInference
from .smoothing import EMAFilter, OneEuroFilter
from .snapshots import SnapshotSaver
from .tracking import ByteTracker

logger = logging.getLogger(__name__)

_BGR = {
    State.NORMAL: (34, 197, 94), State.WARNING: (11, 158, 245),
    State.VIOLATION: (68, 68, 239), State.NEUTRAL: (246, 130, 59),
}
# Posture/hand flags that warrant a visible WARNING (others are informational only).
_WARN_POSTURE = {"standing_up", "torso_turned", "leaning_left", "leaning_right"}
_WARN_HANDS = {"hand_to_ear", "hand_to_mouth"}


def _tune_cpu_threads() -> None:
    """Optionally pin torch thread count (0 = library default, which is usually best)."""
    if settings.TORCH_NUM_THREADS > 0:
        try:
            import torch
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except Exception:
            pass


def _iou_xywh(a, b) -> float:
    ax, ay, aw, ah = a; bx, by, bw, bh = b
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    iw, ih = max(0.0, x2 - x1), max(0.0, y2 - y1)
    inter = iw * ih
    u = aw * ah + bw * bh - inter
    return inter / u if u > 1e-6 else 0.0


@dataclass
class _Smoothers:
    face_box: dict = field(default_factory=dict)
    person_box: dict = field(default_factory=dict)

    def make(self):
        return (OneEuroFilter(settings.ONE_EURO_MIN_CUTOFF, settings.ONE_EURO_BETA)
                if settings.USE_ONE_EURO else EMAFilter(settings.EMA_ALPHA))


class ProctorPipeline:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        _tune_cpu_threads()
        self.pose = PersonPoseDetector()
        self.landmarks = FaceLandmarkDetector()
        self.face_tracker = FaceTracker()
        self.face_bytetrack = ByteTracker(high_thresh=settings.SCRFD_CONF, buffer=30)
        self.motion = MotionTracker()
        self.flow = FlowEnergy() if settings.USE_OPTICAL_FLOW else None
        self.risk = BaselineRiskScorer()
        self.temporal = TemporalInference()        # hot-swaps in if temporal_model.onnx exists
        self.temporal_risk = TemporalRiskScorer()
        self.integrity = IntegrityMonitor()        # hard rules on top of either risk mode
        self.smoothers = _Smoothers()
        self.calibration = CalibrationManager()
        self.snapshots = SnapshotSaver(session_id)
        self.latest_state = LatestState()

        # Optional heavy stages -- guarded.
        self.objects = self._init("objects", lambda: __import__(
            "app.pipeline.detectors.objects", fromlist=["ObjectDetector"]).ObjectDetector())
        self.scrfd = self._init("scrfd", self._make_scrfd) if settings.USE_SCRFD else None
        self.head = self._init("head_pose", self._make_head)
        self.gaze = self._init("gaze", self._make_gaze)
        self.emotion = self._init("emotion", self._make_emotion)
        self.identity = self._init("identity", self._make_identity)

        self._frame_idx = 0
        self._last = {"persons": [], "faces": [], "objects": []}
        self._cache = {"emotion": {}, "identity": {}, "head": {}, "scrfd": None}
        self._t_last = time.monotonic()
        self._fps_ema = 0.0
        self._last_blink_ms: float | None = None
        self._live_eye_closed = False
        self.spoof = self._init("spoof", self._make_spoof)
        self.capabilities = {
            "objects": self.objects is not None, "scrfd": self.scrfd is not None,
            "head_pose": getattr(self.head, "backend_name", "geometric"),
            "gaze": getattr(self.gaze, "backend_name", "geometric"),
            "emotion": self.emotion is not None, "identity": self.identity is not None,
            "temporal": "onnx" if self.temporal.available else "baseline",
            "antispoof": ("cnn" if self.spoof is not None else "challenge"),
        }
        logger.info("Pipeline %s capabilities: %s", session_id, self.capabilities)

    # -- guarded initializers --------------------------------------------
    @staticmethod
    def _init(name, factory):
        try:
            return factory()
        except Exception as exc:
            logger.warning("Stage '%s' disabled: %s", name, exc)
            return None

    @staticmethod
    def _make_scrfd():
        from .detectors.face_scrfd import SCRFDDetector
        return SCRFDDetector()

    @staticmethod
    def _make_head():
        from .estimators.head_pose_6drepnet import HeadPoseEstimator
        return HeadPoseEstimator()

    @staticmethod
    def _make_gaze():
        from .estimators.gaze_l2cs import GazeEstimator
        return GazeEstimator()

    @staticmethod
    def _make_emotion():
        from .estimators.emotion import EmotionEstimator
        return EmotionEstimator()

    @staticmethod
    def _make_identity():
        from .estimators.identity import IdentityEstimator
        return IdentityEstimator()

    @staticmethod
    def _make_spoof():
        from .estimators.antispoof import AntiSpoofEstimator
        return AntiSpoofEstimator()

    def _passive_liveness(self, ts_ms, ear, face_count, frame_bgr, face_box):
        """Return extra integrity events from passive liveness (no-blink, CNN spoof)."""
        events: list[str] = []
        if face_count >= 1 and ear is not None:
            closed = ear < settings.EAR_CLOSED_THRESH
            if closed and not self._live_eye_closed:
                self._live_eye_closed = True
            elif not closed and self._live_eye_closed:
                self._live_eye_closed = False
                self._last_blink_ms = ts_ms
            if self._last_blink_ms is None:
                self._last_blink_ms = ts_ms
            if ts_ms - self._last_blink_ms > settings.LIVENESS_NO_BLINK_S * 1000:
                events.append("no_blink")
        # Optional passive CNN anti-spoof (strided with identity).
        if self.spoof is not None and face_box is not None and \
                self._frame_idx % max(settings.STRIDE_IDENTITY, 1) == 0:
            try:
                live_p = self.spoof.score(frame_bgr, face_box)
                if live_p is not None and live_p < settings.SPOOF_REAL_THRESH:
                    events.append("spoof")
            except Exception as exc:
                logger.debug("anti-spoof failed: %s", exc)
        return events

    # -- smoothing -------------------------------------------------------
    def _smooth(self, store, tid, box, t):
        f = store.get(tid)
        if f is None:
            f = self.smoothers.make(); store[tid] = f
        arr = np.asarray(box, dtype=np.float64)
        out = f(arr, t) if settings.USE_ONE_EURO else f(arr)
        return tuple(float(v) for v in np.asarray(out).ravel())

    # -- main ------------------------------------------------------------
    def process(self, frame_bgr, frame_id, ts_client_ms, debug=False, browser_events=None):
        t0 = time.monotonic()
        self._frame_idx += 1
        i = self._frame_idx
        h, w = frame_bgr.shape[:2]
        browser_events = browser_events or []

        run_pose = i % max(settings.STRIDE_POSE, 1) == 0
        run_lm = i % max(settings.STRIDE_LANDMARKS, 1) == 0
        run_obj = self.objects and i % max(settings.STRIDE_OBJECTS, 1) == 0
        run_emo = self.emotion and i % max(settings.STRIDE_EMOTION, 1) == 0
        run_id = self.identity and i % max(settings.STRIDE_IDENTITY, 1) == 0

        # --- Persons + pose ---
        persons, agg_energy, person_posture, person_hands = self._do_persons(
            frame_bgr, run_pose, h)
        person_count = len(persons)

        # --- Objects ---
        objects, object_labels = self._do_objects(frame_bgr, run_obj)

        # --- Faces (mesh + SCRFD + estimators) ---
        faces, primary_signals = self._do_faces(
            frame_bgr, run_lm, run_emo, run_id, w, h)
        face_count = primary_signals["face_count"]

        # --- Optical flow (optional) ---
        flow_e = self.flow.update(frame_bgr) if self.flow else 0.0
        agg_energy = max(agg_energy, flow_e)

        # --- Feature vector (train/serve parity) ---
        emo_probs = primary_signals.get("emotion_probs") or {}
        _feat = build_feature_vector(
            yaw=primary_signals.get("yaw") or 0.0,
            pitch=primary_signals.get("pitch") or 0.0,
            roll=primary_signals.get("roll") or 0.0,
            gaze_yaw=primary_signals.get("gaze_yaw") or 0.0,
            gaze_pitch=primary_signals.get("gaze_pitch") or 0.0,
            gaze_class=primary_signals.get("gaze_class"),
            ear=primary_signals.get("ear") or 0.0,
            mar=primary_signals.get("mar") or 0.0,
            face_count=face_count, person_count=person_count,
            movement_energy=agg_energy,
            kpt_velocity=persons[0].kpt_velocity if persons else 0.0,
            posture_flags=person_posture,
            hand_zone_flags=person_hands,
            object_presence={o.label: o.confidence for o in objects},
            emotion_probs=emo_probs,
            identity_score=primary_signals.get("identity_score") if
            primary_signals.get("identity_score") is not None else 1.0,
            browser_events=browser_events,
        )  # consumed by the temporal model
        self.last_feature = _feat          # exposed for offline feature extraction

        # --- Risk: temporal model when available (hot-swap), else BASELINE rules ---
        probs = self.temporal.update(_feat)
        if self.temporal.available and probs is not None:
            risk, alerts, temporal_class = self.temporal_risk.score(ts_client_ms, probs)
            risk_mode = self.temporal_risk.MODE
        else:
            risk, alerts, temporal_class = self.risk.score(
                ts_ms=ts_client_ms, person_count=person_count, face_count=face_count,
                gaze_class=primary_signals.get("gaze_class"),
                head_yaw=primary_signals.get("yaw"),
                head_pitch=primary_signals.get("pitch"),
                identity_score=primary_signals.get("identity_score"),
                movement_energy=agg_energy,
                object_labels=object_labels,
                hand_zone_flags=person_hands,
            )
            risk_mode = self.risk.MODE

        # --- Passive liveness (no-blink + optional CNN anti-spoof) ---
        primary_face = max(faces, key=lambda f: f.box.w * f.box.h, default=None)
        pf_box = ((primary_face.box.x, primary_face.box.y, primary_face.box.w,
                   primary_face.box.h) if primary_face else None)
        live_events = self._passive_liveness(
            ts_client_ms, primary_signals.get("ear"), face_count, frame_bgr, pf_box)

        # --- Hard integrity rules (audio/browser/pose/liveness), applied in BOTH modes ---
        integ_floor, integ_alerts = self.integrity.update(
            ts_client_ms, browser_events + live_events, person_posture)
        if integ_floor > risk:
            risk = integ_floor
        alerts = alerts + integ_alerts

        self._apply_alert_states(faces, persons, objects, alerts)

        # --- Update latest state for calibration ---
        self._update_latest(frame_bgr, primary_signals, person_count, face_count, object_labels)

        # --- Timing / HUD ---
        now = time.monotonic()
        dt = now - self._t_last; self._t_last = now
        inst = 1.0 / dt if dt > 0 else 0.0
        self._fps_ema = 0.8 * self._fps_ema + 0.2 * inst if self._fps_ema else inst

        hud = Hud(
            fps=round(self._fps_ema, 1), latency_ms=round((now - t0) * 1000, 1),
            yaw=primary_signals.get("yaw"), pitch=primary_signals.get("pitch"),
            roll=primary_signals.get("roll"), gaze_class=primary_signals.get("gaze_class"),
            ear=primary_signals.get("ear"), mar=primary_signals.get("mar"),
            movement_energy=round(agg_energy, 3),
            top_emotion=primary_signals.get("top_emotion"),
            identity_score=primary_signals.get("identity_score"),
            risk_score=risk, temporal_class=temporal_class, mode=risk_mode,
        )

        result = FrameResult(
            frame_id=frame_id, ts_client_ms=ts_client_ms, ts_server_ms=now * 1000.0,
            source_w=w, source_h=h, persons=persons, faces=faces, objects=objects,
            hud=hud, alerts=alerts,
        )

        # --- Snapshots on violation + debug jpeg ---
        violation_kinds = [a.kind for a in alerts if a.state == State.VIOLATION]
        if violation_kinds or debug or settings.RETURN_DEBUG_JPEG:
            annotated = self._annotate(frame_bgr.copy(), persons, faces, objects)
            if violation_kinds:
                self.snapshots.maybe_save(annotated, violation_kinds, risk, ts_client_ms)
            if debug or settings.RETURN_DEBUG_JPEG:
                result.debug_jpeg_b64 = encode_jpeg_b64(annotated, int(settings.JPEG_QUALITY * 100))
        return result

    # -- persons ---------------------------------------------------------
    def _do_persons(self, frame_bgr, run_pose, h):
        if not run_pose:
            p = self._last["persons"]
            posture = p[0].posture_flags if p else []
            return p, 0.0, posture, []
        dets = self.pose.detect(frame_bgr)
        persons, active, agg = [], set(), 0.0
        posture_all, hands_all = [], []
        t = time.monotonic()
        for d in dets:
            active.add(d.track_id)
            kpts = (np.array([[k.x, k.y, k.conf] for k in d.keypoints])
                    if d.keypoints else np.zeros((17, 3)))
            mm = self.motion.update(d.track_id, kpts, t, h)
            agg = max(agg, mm.movement_energy)
            box = self._smooth(self.smoothers.person_box, d.track_id, d.box_xywh, t)
            # Warn only on clearly suspicious posture/hands. Hands hidden below a desk or
            # resting on the keyboard is normal for a seated exam and must NOT warn.
            suspicious = (set(mm.posture_flags) & _WARN_POSTURE) or \
                         (set(mm.hand_zone_flags) & _WARN_HANDS)
            state = State.WARNING if suspicious else State.NORMAL
            persons.append(PersonResult(
                track_id=d.track_id, box=Box(x=box[0], y=box[1], w=box[2], h=box[3]),
                confidence=d.confidence,
                keypoints=[Point(x=k.x, y=k.y, v=k.conf) for k in d.keypoints],
                state=state, movement_energy=round(mm.movement_energy, 3),
                kpt_velocity=round(mm.kpt_velocity, 3),
                posture_flags=mm.posture_flags + mm.hand_zone_flags,
            ))
            posture_all += mm.posture_flags
            hands_all += mm.hand_zone_flags
        self.motion.forget(active)
        self._last["persons"] = persons
        return persons, agg, posture_all, hands_all

    # -- objects ---------------------------------------------------------
    def _do_objects(self, frame_bgr, run_obj):
        if not run_obj:
            objs = self._last["objects"]
            return objs, [o.label for o in objs if o.state == State.VIOLATION]
        dets = self.objects.detect(frame_bgr)
        objs: list[ObjectResult] = []
        labels: list[str] = []
        for d in dets:
            state = State.VIOLATION if d.is_violation else State.NEUTRAL
            objs.append(ObjectResult(
                track_id=d.track_id, label=d.label,
                box=Box(x=d.box_xywh[0], y=d.box_xywh[1], w=d.box_xywh[2], h=d.box_xywh[3]),
                confidence=round(d.confidence, 3), state=state,
            ))
            labels.append(d.label)
        self._last["objects"] = objs
        return objs, labels

    # -- faces -----------------------------------------------------------
    def _do_faces(self, frame_bgr, run_lm, run_emo, run_id, w, h):
        signals = {"face_count": 0}
        if not run_lm:
            faces = self._last["faces"]
            signals["face_count"] = len(faces)
            return faces, signals

        meshes = self.landmarks.detect(frame_bgr)

        # SCRFD detections (authoritative boxes + confidence + count), strided + reused.
        scrfd_dets = []
        if self.scrfd is not None:
            run_scrfd = self._frame_idx % max(settings.STRIDE_FACE_DETECT, 1) == 0
            if run_scrfd or self._cache.get("scrfd") is None:
                try:
                    scrfd_dets = self.scrfd.detect(frame_bgr)
                    self._cache["scrfd"] = scrfd_dets
                except Exception as exc:
                    logger.debug("SCRFD detect failed: %s", exc)
            else:
                scrfd_dets = self._cache.get("scrfd") or []
        if scrfd_dets:
            ids = self.face_bytetrack.update(
                [(d.box_xywh[0], d.box_xywh[1], d.box_xywh[0] + d.box_xywh[2],
                  d.box_xywh[1] + d.box_xywh[3]) for d in scrfd_dets],
                [d.confidence for d in scrfd_dets],
            )
            face_count = len(scrfd_dets)
        else:
            ids, face_count = [], len(meshes)

        # Fallback tracker for meshes when no SCRFD.
        mesh_ids = self.face_tracker.update([m.box_xywh for m in meshes]) if not scrfd_dets else None

        faces: list[FaceResult] = []
        extras: list[dict] = []
        t = time.monotonic()
        for mi, fl in enumerate(meshes):
            # Associate mesh -> SCRFD det for id + confidence.
            tid, conf, five = None, 0.99, None
            if scrfd_dets:
                best, bj = 0.2, -1
                for j, d in enumerate(scrfd_dets):
                    v = _iou_xywh(fl.box_xywh, d.box_xywh)
                    if v > best:
                        best, bj = v, j
                if bj >= 0:
                    tid, conf, five = ids[bj], scrfd_dets[bj].confidence, scrfd_dets[bj].landmarks5
            if tid is None:
                tid = mesh_ids[mi] if mesh_ids is not None else (1000 + mi)
            face, ex = self._build_face(frame_bgr, fl, tid, conf, five, w, h, t, run_emo, run_id)
            faces.append(face)
            extras.append(ex)

        # Pick primary (largest) and fill signals from it.
        signals["face_count"] = face_count
        if faces:
            pi = max(range(len(faces)), key=lambda k: faces[k].box.w * faces[k].box.h)
            primary, ex = faces[pi], extras[pi]
            signals.update({
                "yaw": primary.yaw, "pitch": primary.pitch, "roll": primary.roll,
                "gaze_class": primary.gaze_class,
                "gaze_yaw": ex["gaze_yaw"], "gaze_pitch": ex["gaze_pitch"],
                "ear": round(((primary.left_eye.ear or 0) + (primary.right_eye.ear or 0)) / 2, 3)
                if primary.left_eye and primary.right_eye else None,
                "mar": primary.mar,
                "identity_score": primary.identity_score,
                "embedding": ex["embedding"],
                "emotion_probs": ex["emotion_probs"],
                "top_emotion": primary.emotions[0]["label"] if primary.emotions else None,
                "face_frac": (primary.box.w * primary.box.h) / float(w * h),
            })
        self._last["faces"] = faces
        return faces, signals

    def _build_face(self, frame_bgr, fl: FaceLandmarks, tid, conf, five, w, h, t,
                    run_emo, run_id):
        box = self._smooth(self.smoothers.face_box, tid, fl.box_xywh, t)

        # Head pose (6DRepNet or geometric), strided: re-run every STRIDE_HEAD frames,
        # otherwise reuse the cached angles but re-anchor the drawn axis to the live nose.
        nose = (float(fl.points[1, 0]), float(fl.points[1, 1]))
        run_head = self._frame_idx % max(settings.STRIDE_HEAD, 1) == 0
        cached = self._cache["head"].get(tid)
        if run_head or cached is None:
            if self.head is not None:
                hp = self.head.estimate(frame_bgr, fl.points, fl.box_xywh, w, h)
            else:
                hp = head_pose_geom.estimate(fl.points, w, h)
            if hp is not None:
                self._cache["head"][tid] = (hp.yaw, hp.pitch, hp.roll)
        else:
            y, p, r = cached
            hp = head_pose_geom.axis_from_euler(y, p, r, nose)

        # Gaze (L2CS or geometric).
        hy = hp.yaw if hp else 0.0
        hpp = hp.pitch if hp else 0.0
        if self.gaze is not None:
            gz = self.gaze.estimate(frame_bgr, fl.points, fl.box_xywh, hy, hpp)
        else:
            gz = gaze_geom.estimate(fl.points, hy, hpp)

        mesh = [Point(x=float(p[0]), y=float(p[1]), z=float(p[2])) for p in fl.points[::4]]
        face = FaceResult(
            track_id=int(tid),
            box=Box(x=box[0], y=box[1], w=box[2], h=box[3]),
            confidence=float(conf), state=State.NORMAL, landmarks=mesh,
            left_eye=EyeResult(box=Box(x=fl.left_eye_box[0], y=fl.left_eye_box[1],
                                       w=fl.left_eye_box[2], h=fl.left_eye_box[3]),
                               iris_center=Point(x=fl.left_iris[0], y=fl.left_iris[1]),
                               ear=round(fl.ear_left, 3)),
            right_eye=EyeResult(box=Box(x=fl.right_eye_box[0], y=fl.right_eye_box[1],
                                        w=fl.right_eye_box[2], h=fl.right_eye_box[3]),
                                iris_center=Point(x=fl.right_iris[0], y=fl.right_iris[1]),
                                ear=round(fl.ear_right, 3)),
            mouth_box=Box(x=fl.mouth_box[0], y=fl.mouth_box[1],
                          w=fl.mouth_box[2], h=fl.mouth_box[3]),
            mar=round(fl.mar, 3),
        )
        if hp:
            face.yaw, face.pitch, face.roll = round(hp.yaw, 1), round(hp.pitch, 1), round(hp.roll, 1)
            face.head_axis = {"origin": list(hp.origin), "x": list(hp.x_axis),
                              "y": list(hp.y_axis), "z": list(hp.z_axis)}
        face.gaze_class = gz.gaze_class
        face.gaze_left = {"origin": list(gz.left_origin), "dir": list(gz.left_dir)}
        face.gaze_right = {"origin": list(gz.right_origin), "dir": list(gz.right_dir)}
        # calibrated on-screen gaze point
        if self.calibration.gaze.ready:
            pt = self.calibration.gaze.predict(gz.yaw, gz.pitch)
            if pt:
                face.gaze_point = [round(pt[0], 4), round(pt[1], 4)]
        # extra signals (not serialized) for the primary-face summary
        extras = {"gaze_yaw": gz.yaw, "gaze_pitch": gz.pitch,
                  "embedding": None, "emotion_probs": None}

        # 5-point for alignment (SCRFD if available else MediaPipe)
        five_pts = five if five is not None else five_points_from_mediapipe(fl.points)

        # Emotion (strided, cached by track id).
        if run_emo and self.emotion is not None:
            crop = self._crop(frame_bgr, fl.box_xywh)
            if crop is not None:
                er = self.emotion.estimate(crop)
                if er:
                    self._cache["emotion"][tid] = er
        er = self._cache["emotion"].get(tid)
        if er:
            face.emotions = [{"label": l, "prob": round(p, 3)} for l, p in er.top3]
            extras["emotion_probs"] = er.probs

        # Identity (strided, cached by track id).
        if run_id and self.identity is not None:
            aligned = norm_crop(frame_bgr, np.asarray(five_pts, dtype=np.float32), self.identity.size)
            if aligned is not None:
                res = self.identity.compare(aligned, self.calibration.enrolled_embedding)
                self._cache["identity"][tid] = res
        idr = self._cache["identity"].get(tid)
        if idr:
            extras["embedding"] = idr.embedding
            if idr.similarity is not None:
                face.identity_score = round(idr.similarity, 3)

        # State: warning if clearly looking away.
        if gz.gaze_class == "off-screen" or (face.yaw is not None
                                             and abs(face.yaw) > settings.HEADPOSE_AWAY_YAW_DEG):
            face.state = State.WARNING
        return face, extras

    # -- helpers ---------------------------------------------------------
    @staticmethod
    def _crop(frame_bgr, box, pad=0.2):
        h, w = frame_bgr.shape[:2]
        x, y, bw, bh = box
        x0, y0 = max(0, int(x - bw * pad)), max(0, int(y - bh * pad))
        x1, y1 = min(w, int(x + bw * (1 + pad))), min(h, int(y + bh * (1 + pad)))
        if x1 <= x0 or y1 <= y0:
            return None
        return frame_bgr[y0:y1, x0:x1]

    def _update_latest(self, frame_bgr, s, person_count, face_count, object_labels):
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        self.latest_state = LatestState(
            embedding=s.get("embedding"),
            gaze_yaw=s.get("gaze_yaw"), gaze_pitch=s.get("gaze_pitch"),
            head_yaw=s.get("yaw"), head_pitch=s.get("pitch"), ear=s.get("ear"),
            brightness=float(gray.mean()),
            face_count=face_count, person_count=person_count,
            face_frac=s.get("face_frac", 0.0), object_labels=object_labels,
        )

    def _apply_alert_states(self, faces, persons, objects, alerts):
        kinds = {a.kind for a in alerts}
        if {"looking_away", "identity_mismatch"} & kinds:
            for f in faces:
                f.state = State.VIOLATION
        if {"other_person_present", "person_absent"} & kinds:
            for p in persons:
                p.state = State.VIOLATION
        if "prohibited_object" in kinds:
            for o in objects:
                if o.state == State.NEUTRAL and o.label in {
                        "cell phone", "book", "paper", "tablet", "earphones"}:
                    o.state = State.VIOLATION

    def _annotate(self, img, persons, faces, objects):
        for p in persons:
            c = _BGR[p.state]
            x, y, ww, hh = map(int, (p.box.x, p.box.y, p.box.w, p.box.h))
            cv2.rectangle(img, (x, y), (x + ww, y + hh), c, 2)
            for a, b in COCO_SKELETON:
                if a < len(p.keypoints) and b < len(p.keypoints) and \
                   (p.keypoints[a].v or 0) > 0.3 and (p.keypoints[b].v or 0) > 0.3:
                    cv2.line(img, (int(p.keypoints[a].x), int(p.keypoints[a].y)),
                             (int(p.keypoints[b].x), int(p.keypoints[b].y)), c, 2)
        for f in faces:
            c = _BGR[f.state]
            x, y, ww, hh = map(int, (f.box.x, f.box.y, f.box.w, f.box.h))
            cv2.rectangle(img, (x, y), (x + ww, y + hh), c, 2)
            if f.head_axis:
                o = tuple(map(int, f.head_axis["origin"]))
                cv2.line(img, o, tuple(map(int, f.head_axis["x"])), (0, 0, 255), 2)
                cv2.line(img, o, tuple(map(int, f.head_axis["y"])), (0, 255, 0), 2)
                cv2.line(img, o, tuple(map(int, f.head_axis["z"])), (255, 0, 0), 2)
        for o in objects:
            c = _BGR[o.state]
            x, y, ww, hh = map(int, (o.box.x, o.box.y, o.box.w, o.box.h))
            cv2.rectangle(img, (x, y), (x + ww, y + hh), c, 2)
            cv2.putText(img, o.label, (x, max(0, y - 6)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.5, c, 1, cv2.LINE_AA)
        return img

    def close(self):
        self.landmarks.close()
