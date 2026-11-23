"""Feature-vector + risk-scoring logic tests (no heavy models required)."""
import pytest


def test_feature_vector_dim_and_layout():
    from app.pipeline.features import build_feature_vector, FEATURE_DIM, GAZE_CLASSES
    v = build_feature_vector(gaze_class="left", person_count=1, face_count=1)
    assert v.shape[0] == FEATURE_DIM
    # gaze one-hot for "left" should be set.
    base = 3 + 2
    assert v[base + GAZE_CLASSES.index("left")] == 1.0
    assert v.dtype.name == "float32"


def test_feature_vector_is_deterministic():
    from app.pipeline.features import build_feature_vector
    import numpy as np
    a = build_feature_vector(yaw=10, gaze_class="center")
    b = build_feature_vector(yaw=10, gaze_class="center")
    assert np.array_equal(a, b)


def test_risk_min_duration_before_alert():
    """An alert must not fire until ALERT_MIN_DURATION_S has elapsed (hysteresis)."""
    from app.pipeline.risk import BaselineRiskScorer
    from app.config import settings

    scorer = BaselineRiskScorer()
    t = 0.0
    # Sustained second person present.
    _, alerts, _ = scorer.score(
        ts_ms=t, person_count=2, face_count=1, gaze_class="center",
        head_yaw=0.0, identity_score=None, movement_energy=0.0,
    )
    assert alerts == []  # not yet past min duration

    t = settings.ALERT_MIN_DURATION_S * 1000 + 1
    _, alerts, cls = scorer.score(
        ts_ms=t, person_count=2, face_count=1, gaze_class="center",
        head_yaw=0.0, identity_score=None, movement_energy=0.0,
    )
    kinds = {a.kind for a in alerts}
    assert "other_person_present" in kinds
    assert cls == "other_person_present"


def test_risk_clears_when_condition_gone():
    from app.pipeline.risk import BaselineRiskScorer
    from app.config import settings
    scorer = BaselineRiskScorer()
    scorer.score(ts_ms=0, person_count=2, face_count=1, gaze_class="center",
                 head_yaw=0, identity_score=None, movement_energy=0)
    scorer.score(ts_ms=settings.ALERT_MIN_DURATION_S * 1000 + 1, person_count=2,
                 face_count=1, gaze_class="center", head_yaw=0,
                 identity_score=None, movement_energy=0)
    _, alerts, _ = scorer.score(
        ts_ms=10_000, person_count=1, face_count=1, gaze_class="center",
        head_yaw=0, identity_score=None, movement_energy=0,
    )
    assert all(a.kind != "other_person_present" for a in alerts)


def test_risk_score_bounded():
    from app.pipeline.risk import BaselineRiskScorer
    scorer = BaselineRiskScorer()
    for i in range(20):
        risk, _, _ = scorer.score(
            ts_ms=i * 1000, person_count=2, face_count=0, gaze_class="off-screen",
            head_yaw=60, identity_score=0.1, movement_energy=1.0,
            object_labels=["cell phone"],
        )
    assert 0.0 <= risk <= 100.0


def test_motion_velocity_zero_on_first_frame():
    from app.pipeline.motion import MotionTracker
    import numpy as np
    mt = MotionTracker()
    kpts = np.zeros((17, 3))
    kpts[5] = [100, 100, 0.9]   # shoulders present
    kpts[6] = [160, 100, 0.9]
    m = mt.update(track_id=1, keypoints=kpts, ts=0.0, frame_h=480)
    assert m.kpt_velocity == 0.0
