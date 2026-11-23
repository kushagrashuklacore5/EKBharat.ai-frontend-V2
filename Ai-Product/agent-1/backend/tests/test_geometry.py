"""Geometry + maths unit tests: EAR/MAR, head-pose, gaze, smoothing, boxes.

These run without ultralytics/mediapipe (only numpy/opencv), so they're fast and CI-safe.
"""
import math

import numpy as np
import pytest


# --- EAR / MAR --------------------------------------------------------------
def test_ear_open_vs_closed():
    from app.pipeline.detectors.landmarks import _ear, LEFT_EYE_EAR

    # Build a fake 478x3 point array; only the EAR indices matter.
    pts = np.zeros((478, 3))
    # EAR order: [corner_a, top1, top2, corner_b, bot2, bot1]
    # Open eye: width 40, height ~16  => EAR ~0.4
    idx = LEFT_EYE_EAR
    pts[idx[0]] = [0, 10, 0]      # left corner
    pts[idx[3]] = [40, 10, 0]     # right corner
    pts[idx[1]] = [13, 2, 0]      # top1
    pts[idx[2]] = [27, 2, 0]      # top2
    pts[idx[4]] = [27, 18, 0]     # bot2
    pts[idx[5]] = [13, 18, 0]     # bot1
    open_ear = _ear(pts, idx)
    assert open_ear > 0.3

    # Closed eye: tiny vertical gap
    pts[idx[1]] = [13, 9.5, 0]
    pts[idx[2]] = [27, 9.5, 0]
    pts[idx[4]] = [27, 10.5, 0]
    pts[idx[5]] = [13, 10.5, 0]
    closed_ear = _ear(pts, idx)
    assert closed_ear < 0.1
    assert closed_ear < open_ear


def test_mar_open_mouth():
    from app.pipeline.detectors.landmarks import (
        _mar, MOUTH_TOP, MOUTH_BOTTOM, MOUTH_LEFT_CORNER, MOUTH_RIGHT_CORNER,
    )
    pts = np.zeros((478, 3))
    pts[MOUTH_LEFT_CORNER] = [0, 50, 0]
    pts[MOUTH_RIGHT_CORNER] = [50, 50, 0]
    pts[MOUTH_TOP] = [25, 40, 0]
    pts[MOUTH_BOTTOM] = [25, 60, 0]
    mar = _mar(pts)
    assert mar == pytest.approx(20.0 / 50.0, rel=1e-3)   # 0.4


# --- Head pose maths --------------------------------------------------------
def test_rotation_to_euler_identity():
    from app.pipeline.estimators.head_pose import _rotation_to_euler
    yaw, pitch, roll = _rotation_to_euler(np.eye(3))
    assert abs(yaw) < 1e-6 and abs(pitch) < 1e-6 and abs(roll) < 1e-6


def test_rotation_to_euler_known_yaw():
    from app.pipeline.estimators.head_pose import _rotation_to_euler
    # Rotate 30 deg about Y (yaw).
    a = math.radians(30)
    ry = np.array([[math.cos(a), 0, math.sin(a)],
                   [0, 1, 0],
                   [-math.sin(a), 0, math.cos(a)]])
    yaw, pitch, roll = _rotation_to_euler(ry)
    assert yaw == pytest.approx(30.0, abs=1e-3)
    assert abs(pitch) < 1e-6 and abs(roll) < 1e-6


def test_head_pose_frontal_face_is_near_zero():
    """A symmetric frontal landmark set should yield near-zero yaw/roll."""
    from app.pipeline.detectors.landmarks import PNP_LANDMARKS
    from app.pipeline.estimators.head_pose import estimate

    w, h = 640, 480
    pts = np.zeros((478, 3))
    cx, cy = w / 2, h / 2
    # nose tip, chin, l-eye-out, r-eye-out, l-mouth, r-mouth (symmetric about cx)
    coords = {
        PNP_LANDMARKS[0]: (cx, cy),            # nose
        PNP_LANDMARKS[1]: (cx, cy + 80),       # chin
        PNP_LANDMARKS[2]: (cx - 55, cy - 40),  # left eye outer
        PNP_LANDMARKS[3]: (cx + 55, cy - 40),  # right eye outer
        PNP_LANDMARKS[4]: (cx - 35, cy + 40),  # left mouth
        PNP_LANDMARKS[5]: (cx + 35, cy + 40),  # right mouth
    }
    for i, (x, y) in coords.items():
        pts[i] = [x, y, 0]
    hp = estimate(pts, w, h)
    assert hp is not None
    assert abs(hp.yaw) < 12
    assert abs(hp.roll) < 12


# --- Gaze classification ----------------------------------------------------
@pytest.mark.parametrize("yaw,pitch,expected", [
    (0, 0, "center"),
    (20, 0, "right"),
    (-20, 0, "left"),
    (0, 20, "down"),
    (0, -20, "up"),
    (50, 0, "off-screen"),
])
def test_gaze_classify(yaw, pitch, expected):
    from app.pipeline.estimators.gaze import _classify
    assert _classify(yaw, pitch) == expected


# --- One-Euro smoothing -----------------------------------------------------
def test_one_euro_tracks_constant_signal():
    from app.pipeline.smoothing import OneEuroFilter
    f = OneEuroFilter()
    t = 0.0
    out = None
    for _ in range(30):
        out = f(np.array([100.0, 200.0]), t)
        t += 1 / 30
    assert out[0] == pytest.approx(100.0, abs=1.0)
    assert out[1] == pytest.approx(200.0, abs=1.0)


def test_one_euro_reduces_jitter():
    from app.pipeline.smoothing import OneEuroFilter
    f = OneEuroFilter(min_cutoff=0.5, beta=0.0)
    rng = np.random.default_rng(0)
    t = 0.0
    errs = []
    for _ in range(100):
        noisy = 100.0 + rng.normal(0, 5)
        out = f(np.array([noisy]), t)
        errs.append(abs(out[0] - 100.0))
        t += 1 / 30
    # Average deviation should be well under the raw noise std (5).
    assert np.mean(errs[20:]) < 4.0


# --- Face IoU tracker -------------------------------------------------------
def test_face_tracker_stable_ids():
    from app.pipeline.detectors.face import FaceTracker
    tr = FaceTracker()
    b1 = [(100, 100, 50, 50)]
    id_a = tr.update(b1)[0]
    # Slight movement -> same id
    id_b = tr.update([(104, 102, 50, 50)])[0]
    assert id_a == id_b
    # A far-away new box -> new id
    ids = tr.update([(104, 102, 50, 50), (400, 400, 50, 50)])
    assert ids[0] == id_a
    assert ids[1] != id_a
