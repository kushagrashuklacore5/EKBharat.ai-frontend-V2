"""Flagged-snapshot storage.

On every red (violation) event, save a JPEG with the overlay boxes burned in, plus a
small JSON sidecar of the alert context. Debounced per alert-kind so a sustained
violation does not write hundreds of files. Full-video is never stored (DPDP): only these
flagged stills + the feature stream.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class SnapshotRecord:
    path: str
    ts_ms: float
    kinds: list[str]
    risk: float


class SnapshotSaver:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.dir = (Path(settings.SNAPSHOT_DIR) / session_id).resolve()
        self.dir.mkdir(parents=True, exist_ok=True)
        self._last_saved: dict[str, float] = {}
        self.records: list[SnapshotRecord] = []
        logger.info("Snapshots for %s -> %s", session_id, self.dir)

    def maybe_save(self, annotated_bgr: np.ndarray, kinds: list[str], risk: float,
                   ts_ms: float) -> SnapshotRecord | None:
        if not settings.SNAPSHOT_ON_VIOLATION or not kinds:
            return None
        # Debounce: save only if at least one kind is new or past the min interval.
        now = ts_ms
        interval = settings.SNAPSHOT_MIN_INTERVAL_S * 1000.0
        fire = any(now - self._last_saved.get(k, -1e18) >= interval for k in kinds)
        if not fire:
            return None
        for k in kinds:
            self._last_saved[k] = now

        fname = f"{int(now)}_{'_'.join(kinds)[:40]}.jpg"
        fpath = self.dir / fname
        cv2.imwrite(str(fpath), annotated_bgr,
                    [int(cv2.IMWRITE_JPEG_QUALITY), int(settings.JPEG_QUALITY * 100)])
        rec = SnapshotRecord(path=str(fpath), ts_ms=now, kinds=list(kinds), risk=risk)
        (self.dir / (fname + ".json")).write_text(json.dumps(asdict(rec)), encoding="utf-8")
        self.records.append(rec)
        logger.info("Saved snapshot %s (kinds=%s risk=%.0f)", fname, kinds, risk)
        return rec
