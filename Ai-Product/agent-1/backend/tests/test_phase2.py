"""Phase 2 logic tests that avoid the heavy models (ByteTrack, calibration, alignment,
feature/risk wiring, SCRFD decode math)."""
import numpy as np
import pytest


# --- ByteTracker -----------------------------------------------------------
def test_bytetracker_stable_and_new_ids():
    from app.pipeline.tracking import ByteTracker
    tr = ByteTracker(high_thresh=0.5, match_iou=0.3)
    a = tr.update([(100, 100, 150, 150)], [0.9])[0]
    b = tr.update([(104, 102, 154, 152)], [0.9])[0]   # moved slightly -> same id
    assert a == b
    ids = tr.update([(104, 102, 154, 152), (400, 400, 450, 450)], [0.9, 0.9])
    assert ids[0] == a and ids[1] != a


def test_bytetracker_recovers_with_low_score():
    from app.pipeline.tracking import ByteTracker
    tr = ByteTracker(high_thresh=0.5, low_thresh=0.1, match_iou=0.3)
    first = tr.update([(100, 100, 150, 150)], [0.9])[0]
    # low-score detection at same place should keep the id (stage-2 association)
    same = tr.update([(101, 101, 151, 151)], [0.2])[0]
    assert same == first


# --- Gaze calibration ------------------------------------------------------
def test_gaze_calibration_fit_predict():
    from app.pipeline.estimators.gaze_l2cs import GazeCalibration
    cal = GazeCalibration()
    # synthetic linear map: screen_x = (yaw+30)/60, screen_y = (pitch+20)/40
    samples = []
    for yaw in (-30, 0, 30):
        for pitch in (-20, 0, 20):
            sx = (yaw + 30) / 60.0
            sy = (pitch + 20) / 40.0
            samples.append((yaw, pitch, sx, sy))
    assert cal.fit(samples)
    assert cal.ready
    px, py = cal.predict(0, 0)
    assert px == pytest.approx(0.5, abs=0.05)
    assert py == pytest.approx(0.5, abs=0.05)


def test_gaze_calibration_not_ready_without_enough():
    from app.pipeline.estimators.gaze_l2cs import GazeCalibration
    cal = GazeCalibration()
    assert not cal.fit([(0, 0, 0.5, 0.5)])
    assert cal.predict(0, 0) is None


# --- Calibration manager ---------------------------------------------------
def test_enrolment_averages_embeddings():
    from app.pipeline.calibration import CalibrationManager, LatestState
    from app.config import settings
    cm = CalibrationManager()
    e = np.ones(512, dtype=np.float32) / np.sqrt(512)
    r = {}
    for _ in range(settings.IDENTITY_ENROLL_FRAMES):
        r = cm.enroll_frame(LatestState(embedding=e))
    assert r["enrolled"] is True
    assert cm.is_enrolled
    assert cm.enrolled_embedding is not None
    assert np.linalg.norm(cm.enrolled_embedding) == pytest.approx(1.0, abs=1e-5)


def test_liveness_challenge_passes_on_blinks_and_turns():
    from app.pipeline.calibration import CalibrationManager, LatestState
    cm = CalibrationManager()
    # two blinks: ear dips below threshold then recovers
    for ear in (0.25, 0.10, 0.25, 0.25, 0.10, 0.25):
        cm.update_liveness(LatestState(ear=ear, head_yaw=0))
    assert not cm.liveness_passed            # turns not done yet
    cm.update_liveness(LatestState(ear=0.25, head_yaw=-25))   # left
    r = cm.update_liveness(LatestState(ear=0.25, head_yaw=25))  # right
    assert r["blinks"] == 2
    assert cm.liveness_passed


def test_integrity_spoof_and_no_blink():
    from app.pipeline.integrity import IntegrityMonitor
    m = IntegrityMonitor()
    for ts in (0, 1000, 2000):
        floor, alerts = m.update(ts, ["spoof"], [])
    assert floor == 88
    assert any(a.kind == "spoof" and a.state.value == "violation" for a in alerts)


def test_environment_check_flags_issues():
    from app.pipeline.calibration import CalibrationManager, LatestState
    cm = CalibrationManager()
    # dark + two faces + object
    ec = cm.environment_check(LatestState(brightness=10, face_count=2,
                                          face_frac=0.2, object_labels=["cell phone"]))
    assert not ec.ok
    assert "too_dark" in ec.issues
    assert "multiple_faces" in ec.issues
    assert any(i.startswith("prohibited_object") for i in ec.issues)
    # good conditions
    ec2 = cm.environment_check(LatestState(brightness=120, face_count=1, face_frac=0.2))
    assert ec2.ok


# --- Face alignment --------------------------------------------------------
def test_five_points_ordering_and_norm_crop():
    from app.pipeline.estimators.face_align import five_points_from_mediapipe, norm_crop
    pts = np.zeros((478, 3))
    # left eye corners (33,133), right eye (362,263), nose(1), mouth(61,291)
    pts[33] = [100, 100, 0]; pts[133] = [120, 100, 0]
    pts[362] = [180, 100, 0]; pts[263] = [200, 100, 0]
    pts[1] = [150, 130, 0]
    pts[61] = [110, 160, 0]; pts[291] = [190, 160, 0]
    five = five_points_from_mediapipe(pts)
    assert five.shape == (5, 2)
    assert five[0][0] < five[1][0]   # left eye left of right eye
    assert five[3][0] < five[4][0]   # left mouth left of right mouth
    img = (np.random.rand(240, 320, 3) * 255).astype("uint8")
    crop = norm_crop(img, five, 112)
    assert crop.shape == (112, 112, 3)


# --- Feature vector with Phase 2 inputs ------------------------------------
def test_features_objects_and_emotion_and_browser():
    from app.pipeline.features import (build_feature_vector, FEATURE_DIM, OBJECT_CLASSES,
                                       EMOTION_CLASSES, BROWSER_EVENTS)
    v = build_feature_vector(
        object_presence={"cell phone": 0.9},
        emotion_probs={"neutral": 0.8},
        hand_zone_flags=["hand_to_ear"],
        browser_events=["tab_hidden"],
    )
    assert v.shape[0] == FEATURE_DIM
    # non-zero somewhere in object + emotion + browser regions
    assert v.sum() > 0


# --- Risk with Phase 2 signals ---------------------------------------------
def test_risk_phone_and_hand_and_identity():
    from app.pipeline.risk import BaselineRiskScorer
    from app.config import settings
    s = BaselineRiskScorer()
    t = settings.ALERT_MIN_DURATION_S * 1000 + 1
    # sustain a phone + earpiece + identity mismatch
    for ts in (0, t, t + 1000):
        risk, alerts, cls = s.score(
            ts_ms=ts, person_count=1, face_count=1, gaze_class="center", head_yaw=0,
            identity_score=0.1, movement_energy=0.0,
            object_labels=["cell phone"], hand_zone_flags=["hand_to_ear"],
        )
    kinds = {a.kind for a in alerts}
    assert "prohibited_object" in kinds
    assert "identity_mismatch" in kinds
    assert "suspicious_hand_movement" in kinds
    assert 0 <= risk <= 100


# --- SCRFD decode math -----------------------------------------------------
def test_distance2bbox():
    from app.pipeline.detectors.face_scrfd import _distance2bbox
    pts = np.array([[50.0, 50.0]])
    dist = np.array([[10.0, 20.0, 30.0, 40.0]])   # l,t,r,b
    box = _distance2bbox(pts, dist)[0]
    assert list(box) == [40.0, 30.0, 80.0, 90.0]
