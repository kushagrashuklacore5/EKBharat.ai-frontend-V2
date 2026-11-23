"""Per-frame feature-vector builder.

Assembles the fixed-length numeric vector consumed by the temporal model (Phase 3) and
by the baseline risk scorer (Phase 1/2). Keeping the schema here -- with an explicit,
versioned ordering -- means `extract_features.py` (offline) and the live pipeline emit
*identical* vectors, which is essential to avoid train/serve skew.

Vector layout (v1), length = FEATURE_DIM:
  [ yaw, pitch, roll,
    gaze_yaw, gaze_pitch, gaze_onehot(6),
    ear, mar,
    face_count, person_count,
    movement_energy, kpt_velocity,
    posture_flags(8),
    hand_zone_flags(3),
    object_presence(10),           # zeros until Phase 2 objects
    emotion_probs(8),              # zeros until Phase 2
    identity_score,
    browser_event_flags(10) ]
"""
from __future__ import annotations

import numpy as np

GAZE_CLASSES = ["center", "left", "right", "up", "down", "off-screen"]
POSTURE_FLAGS = [
    "leaning_left", "leaning_right", "torso_turned", "standing_up",
    "hands_not_visible", "one_hand_hidden",
    "hand_near_face_left", "hand_near_face_right",
]
HAND_ZONE_FLAGS = ["hand_to_ear", "hand_to_mouth", "hands_below_desk"]
OBJECT_CLASSES = [
    "cell phone", "book", "laptop", "tablet", "earphones", "smartwatch",
    "paper", "calculator", "second_monitor", "another_person",
]
EMOTION_CLASSES = [
    "neutral", "happy", "sad", "surprise", "fear", "disgust", "anger", "contempt",
]
BROWSER_EVENTS = [
    "tab_hidden", "tab_visible", "blur", "focus", "fullscreen_exit",
    "copy", "paste", "contextmenu", "devtools_open", "resize",
]

# Temporal cheating-model output classes (multi-label). "normal" is label 0 and is high
# when no suspicious label is active. Shared by the live inference path and the trainer so
# there is never a class-ordering mismatch.
TEMPORAL_CLASSES = [
    "normal", "looking_away", "talking", "phone_use", "reading_material",
    "other_person_present", "person_absent", "identity_mismatch",
    "suspicious_hand_movement", "screen_switching",
]
NUM_TEMPORAL_CLASSES = len(TEMPORAL_CLASSES)

FEATURE_VERSION = 1
FEATURE_DIM = (
    3                       # yaw, pitch, roll
    + 2                     # gaze_yaw, gaze_pitch
    + len(GAZE_CLASSES)     # gaze one-hot (6)
    + 2                     # ear, mar
    + 2                     # face_count, person_count
    + 2                     # movement_energy, kpt_velocity
    + len(POSTURE_FLAGS)    # 8
    + len(HAND_ZONE_FLAGS)  # 3
    + len(OBJECT_CLASSES)   # 10
    + len(EMOTION_CLASSES)  # 8
    + 1                     # identity_score
    + len(BROWSER_EVENTS)   # 10
)


def _onehot(value: str | None, classes: list[str]) -> list[float]:
    v = [0.0] * len(classes)
    if value in classes:
        v[classes.index(value)] = 1.0
    return v


def build_feature_vector(
    *,
    yaw: float = 0.0, pitch: float = 0.0, roll: float = 0.0,
    gaze_yaw: float = 0.0, gaze_pitch: float = 0.0, gaze_class: str | None = None,
    ear: float = 0.0, mar: float = 0.0,
    face_count: int = 0, person_count: int = 0,
    movement_energy: float = 0.0, kpt_velocity: float = 0.0,
    posture_flags: list[str] | None = None,
    hand_zone_flags: list[str] | None = None,
    object_presence: dict[str, float] | None = None,
    emotion_probs: dict[str, float] | None = None,
    identity_score: float = 1.0,
    browser_events: list[str] | None = None,
) -> np.ndarray:
    """Return a FEATURE_DIM float32 vector in the canonical v1 layout."""
    posture_flags = posture_flags or []
    hand_zone_flags = hand_zone_flags or []
    object_presence = object_presence or {}
    emotion_probs = emotion_probs or {}
    browser_events = browser_events or []

    parts: list[float] = [
        yaw / 90.0, pitch / 90.0, roll / 90.0,
        gaze_yaw / 90.0, gaze_pitch / 90.0,
    ]
    parts += _onehot(gaze_class, GAZE_CLASSES)
    parts += [ear, mar, float(face_count), float(person_count),
              movement_energy, kpt_velocity]
    parts += [1.0 if f in posture_flags else 0.0 for f in POSTURE_FLAGS]
    parts += [1.0 if f in hand_zone_flags else 0.0 for f in HAND_ZONE_FLAGS]
    parts += [float(object_presence.get(c, 0.0)) for c in OBJECT_CLASSES]
    parts += [float(emotion_probs.get(c, 0.0)) for c in EMOTION_CLASSES]
    parts += [identity_score]
    parts += [1.0 if e in browser_events else 0.0 for e in BROWSER_EVENTS]

    vec = np.asarray(parts, dtype=np.float32)
    assert vec.shape[0] == FEATURE_DIM, (vec.shape[0], FEATURE_DIM)
    return vec
