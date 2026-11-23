"""Feature-grounded synthetic data for bootstrapping the temporal cheating model.

Each synthetic *person* has small individual biases (neutral head pose, eye openness,
camera height) so the model cannot cheat by memorising absolute values. Sessions are
sequences of labelled behaviour segments with smooth transitions and realistic noise.
Crucially, every frame is produced by `app.pipeline.features.build_feature_vector`, so the
vectors are identical in layout/scale to what the live pipeline emits -- no train/serve
skew. This bootstraps temporal structure (e.g. talking = MAR oscillation over ~1s,
screen-switching = browser events + gaze shifts) that single-frame rules cannot capture.

This is a BOOTSTRAP, not production truth: replace/augment with real recordings
(datasets/real.py) for genuine accuracy.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))
from app.pipeline.features import (  # noqa: E402
    TEMPORAL_CLASSES, build_feature_vector,
)

CLS = {c: i for i, c in enumerate(TEMPORAL_CLASSES)}
BEHAVIOURS = [c for c in TEMPORAL_CLASSES if c != "normal"]


@dataclass
class PersonProfile:
    rng: np.random.Generator
    yaw_bias: float = 0.0
    pitch_bias: float = 0.0       # e.g. webcam below eye level -> negative pitch
    ear_base: float = 0.25
    id_base: float = 0.8          # enrolled-self similarity baseline

    @classmethod
    def random(cls, rng: np.random.Generator) -> "PersonProfile":
        return cls(
            rng=rng,
            yaw_bias=float(rng.normal(0, 4)),
            pitch_bias=float(rng.normal(-8, 4)),     # most webcams sit low
            ear_base=float(rng.uniform(0.20, 0.30)),
            id_base=float(rng.uniform(0.7, 0.9)),
        )


def _label(name: str) -> np.ndarray:
    y = np.zeros(len(TEMPORAL_CLASSES), dtype=np.float32)
    y[CLS[name]] = 1.0
    if name != "normal":
        # a suspicious frame is, by definition, not "normal"
        y[CLS["normal"]] = 0.0
    else:
        y[CLS["normal"]] = 1.0
    return y


def _segment(name: str, n: int, p: PersonProfile) -> tuple[np.ndarray, np.ndarray]:
    """Return (features (n,F), labels (n,C)) for a behaviour segment."""
    r = p.rng
    feats, labels = [], []
    phase = r.uniform(0, 2 * np.pi)
    for t in range(n):
        kw = dict(                     # neutral defaults; overridden per behaviour
            yaw=p.yaw_bias + r.normal(0, 3),
            pitch=p.pitch_bias + r.normal(0, 3),
            roll=r.normal(0, 3),
            gaze_yaw=p.yaw_bias + r.normal(0, 4),
            gaze_pitch=p.pitch_bias + r.normal(0, 4),
            gaze_class="center",
            ear=p.ear_base + r.normal(0, 0.02),
            mar=0.05 + abs(r.normal(0, 0.02)),
            face_count=1, person_count=1,
            movement_energy=abs(r.normal(0, 0.05)),
            kpt_velocity=abs(r.normal(0, 0.05)),
            identity_score=np.clip(p.id_base + r.normal(0, 0.05), 0, 1),
            emotion_probs={"neutral": 0.7},
        )
        if name == "normal":
            pass
        elif name == "looking_away":
            if r.random() < 0.5:                       # turned away -> no face
                kw.update(face_count=0, gaze_class=None, ear=0.0, mar=0.0,
                          yaw=0.0, pitch=0.0)
            else:                                      # strong head/gaze deviation
                side = r.choice([-1, 1])
                kw.update(yaw=side * r.uniform(35, 60), gaze_yaw=side * r.uniform(40, 70),
                          gaze_class="off-screen")
        elif name == "talking":
            kw.update(mar=0.12 + 0.18 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 6 + phase)))
        elif name == "phone_use":
            kw.update(gaze_pitch=p.pitch_bias + r.uniform(20, 40), gaze_class="down",
                      pitch=p.pitch_bias - r.uniform(10, 25),
                      object_presence={"cell phone": float(np.clip(r.normal(0.8, 0.1), 0.4, 0.99))})
        elif name == "reading_material":
            obj = r.choice(["book", "paper"])
            kw.update(gaze_pitch=p.pitch_bias + r.uniform(15, 35), gaze_class="down",
                      object_presence={obj: float(np.clip(r.normal(0.75, 0.1), 0.4, 0.99))})
        elif name == "other_person_present":
            kw.update(person_count=2, face_count=int(r.choice([1, 2])))
        elif name == "person_absent":
            kw.update(person_count=0, face_count=0, gaze_class=None, ear=0.0, mar=0.0,
                      yaw=0.0, pitch=0.0, identity_score=1.0)
        elif name == "identity_mismatch":
            kw.update(identity_score=float(np.clip(r.normal(0.15, 0.08), 0, 0.35)))
        elif name == "suspicious_hand_movement":
            kw.update(hand_zone_flags=[str(r.choice(["hand_to_ear", "hand_to_mouth"]))])
        elif name == "screen_switching":
            ev = ["tab_hidden"] if (t % 7 == 0) else (["tab_visible"] if (t % 7 == 1) else [])
            kw.update(browser_events=ev, gaze_class=str(r.choice(["left", "right", "center"])),
                      gaze_yaw=r.uniform(-30, 30))
        feats.append(build_feature_vector(**kw))
        labels.append(_label(name))
    return np.asarray(feats, dtype=np.float32), np.asarray(labels, dtype=np.float32)


def generate_session(person_id: int, rng: np.random.Generator, fps: int = 10,
                     n_segments: int = 14, seg_seconds: tuple[int, int] = (4, 12)
                     ) -> tuple[np.ndarray, np.ndarray]:
    """One session for a synthetic person: mostly-normal with interspersed behaviours."""
    p = PersonProfile.random(rng)
    feats, labels = [], []
    for _ in range(n_segments):
        # ~55% normal, else a random behaviour (class imbalance like a real exam)
        name = "normal" if rng.random() < 0.55 else str(rng.choice(BEHAVIOURS))
        n = int(rng.integers(seg_seconds[0] * fps, seg_seconds[1] * fps))
        f, l = _segment(name, n, p)
        feats.append(f); labels.append(l)
    return np.concatenate(feats), np.concatenate(labels)


def make_windows(seq_feats: np.ndarray, seq_labels: np.ndarray, window: int,
                 stride: int) -> tuple[np.ndarray, np.ndarray]:
    """Sliding windows; each window's label = its LAST frame (the 'current' state)."""
    X, Y = [], []
    for s in range(0, len(seq_feats) - window + 1, stride):
        X.append(seq_feats[s:s + window])
        Y.append(seq_labels[s + window - 1])
    if not X:
        return np.empty((0, window, seq_feats.shape[1]), np.float32), \
               np.empty((0, seq_labels.shape[1]), np.float32)
    return np.asarray(X, np.float32), np.asarray(Y, np.float32)


def build_dataset(num_persons: int = 40, fps: int = 10, window: int = 50, stride: int = 5,
                  seed: int = 0) -> dict:
    """Return windows + labels + per-window person ids (for split-by-person)."""
    master = np.random.default_rng(seed)
    allX, allY, pid = [], [], []
    for person in range(num_persons):
        rng = np.random.default_rng(master.integers(1 << 30))
        f, l = generate_session(person, rng, fps=fps)
        X, Y = make_windows(f, l, window, stride)
        allX.append(X); allY.append(Y); pid.append(np.full(len(X), person))
    return {
        "X": np.concatenate(allX), "Y": np.concatenate(allY),
        "person": np.concatenate(pid), "classes": TEMPORAL_CLASSES,
    }
