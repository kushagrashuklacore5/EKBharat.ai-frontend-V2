"""Loaders for REAL data -- recorded sessions and public datasets.

`load_recorded(dir)` is the production path: it reads the per-session feature/label files
produced by `extract_features.py` (which runs the frozen live pipeline over recorded
videos from labeling/record_tool). Returns the same dict shape as
`synthetic.build_dataset`, so train_temporal.py is agnostic to the source.

Public datasets (OEP / Gaze360 / 300W-LP) are documented hooks: OEP (MSU online-exam
proctoring) feeds the temporal model; Gaze360/MPIIGaze and 300W-LP/BIWI are for the
per-frame gaze/head-pose estimators (training those is a separate track).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np


def load_recorded(features_dir: str, window: int = 50, stride: int = 5) -> dict:
    """Load per-session .npz files: each has arrays `features (N,F)`, `labels (N,C)`,
    and scalar `person_id`. Produces split-by-person sliding windows."""
    from .synthetic import make_windows  # reuse the identical windowing
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))
    from app.pipeline.features import TEMPORAL_CLASSES

    files = sorted(Path(features_dir).glob("*.npz"))
    if not files:
        raise FileNotFoundError(
            f"No recorded feature files in {features_dir}. "
            "Record sessions with labeling/record_tool, then run extract_features.py."
        )
    allX, allY, pid = [], [], []
    for f in files:
        d = np.load(f)
        X, Y = make_windows(d["features"].astype(np.float32),
                            d["labels"].astype(np.float32), window, stride)
        allX.append(X); allY.append(Y)
        pid.append(np.full(len(X), int(d["person_id"])))
    return {"X": np.concatenate(allX), "Y": np.concatenate(allY),
            "person": np.concatenate(pid), "classes": TEMPORAL_CLASSES}


# --- Public dataset hooks (documented; wire when you download them) ---------
OEP_URL = "https://github.com/ (MSU Online Exam Proctoring dataset) -- request access"
GAZE360_URL = "http://gaze360.csail.mit.edu/"
W300LP_URL = "http://www.cbsr.ia.ac.cn/users/xiangyuzhu/projects/3DDFA/main.htm"


def load_oep(root: str) -> dict:  # pragma: no cover - requires the dataset on disk
    raise NotImplementedError(
        "OEP loader stub. Download OEP, extract per-frame features with extract_features.py "
        "using its action annotations as labels, then load via load_recorded()."
    )
