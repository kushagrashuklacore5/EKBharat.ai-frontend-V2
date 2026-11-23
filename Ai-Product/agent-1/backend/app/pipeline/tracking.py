"""ByteTrack-style multi-object tracker (IoU association + track buffer).

A compact, Kalman-free ByteTrack variant: two-stage association (high-score detections
first, then low-score to recover occluded tracks), with a track buffer that keeps lost
tracks alive for a few frames so IDs survive brief misses. Used for detectors that lack
built-in tracking (SCRFD faces). The object detector uses Ultralytics' native ByteTrack
directly.

Faithful to ByteTrack's core idea (BYTE association over all detection scores) while
staying dependency-light; swap in a Kalman-filtered version if motion prediction is
needed later.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


def _iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """a: (N,4) b:(M,4) in xyxy. Returns (N,M) IoU."""
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)), dtype=np.float32)
    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    w = np.clip(x2 - x1, 0, None)
    h = np.clip(y2 - y1, 0, None)
    inter = w * h
    union = area_a[:, None] + area_b[None, :] - inter
    return np.where(union > 0, inter / union, 0.0).astype(np.float32)


@dataclass
class Track:
    track_id: int
    xyxy: np.ndarray
    score: float
    age: int = 0
    time_since_update: int = 0
    hits: int = 1


class ByteTracker:
    def __init__(self, high_thresh: float = 0.5, low_thresh: float = 0.1,
                 match_iou: float = 0.3, buffer: int = 30) -> None:
        self.high_thresh = high_thresh
        self.low_thresh = low_thresh
        self.match_iou = match_iou
        self.buffer = buffer
        self.tracks: list[Track] = []
        self._next_id = 1

    def _associate(self, tracks: list[Track], dets: np.ndarray, scores: np.ndarray
                   ) -> tuple[list[tuple[int, int]], list[int], list[int]]:
        if not tracks or len(dets) == 0:
            return [], list(range(len(tracks))), list(range(len(dets)))
        t_boxes = np.array([t.xyxy for t in tracks], dtype=np.float32)
        iou = _iou_matrix(t_boxes, dets)
        matches, used_t, used_d = [], set(), set()
        # Greedy highest-IoU assignment.
        pairs = sorted(
            ((iou[i, j], i, j) for i in range(len(tracks)) for j in range(len(dets))),
            reverse=True,
        )
        for val, i, j in pairs:
            if val < self.match_iou:
                break
            if i in used_t or j in used_d:
                continue
            used_t.add(i); used_d.add(j)
            matches.append((i, j))
        un_t = [i for i in range(len(tracks)) if i not in used_t]
        un_d = [j for j in range(len(dets)) if j not in used_d]
        return matches, un_t, un_d

    def update(self, boxes_xyxy: list[tuple[float, float, float, float]],
               scores: list[float]) -> list[int]:
        """Return a track ID per input box (same order)."""
        dets = np.array(boxes_xyxy, dtype=np.float32).reshape(-1, 4)
        scs = np.array(scores, dtype=np.float32).reshape(-1)
        assigned = [-1] * len(dets)

        high = [i for i in range(len(dets)) if scs[i] >= self.high_thresh]
        low = [i for i in range(len(dets)) if self.low_thresh <= scs[i] < self.high_thresh]

        for t in self.tracks:
            t.time_since_update += 1
            t.age += 1

        # Stage 1: high-score detections vs all tracks.
        m1, un_t1, un_d1 = self._associate(self.tracks, dets[high] if high else np.empty((0, 4)),
                                           scs[high] if high else np.empty((0,)))
        for ti, di in m1:
            self._update_track(self.tracks[ti], dets[high[di]], scs[high[di]])
            assigned[high[di]] = self.tracks[ti].track_id

        # Stage 2: remaining tracks vs low-score detections (recover occluded).
        rem_tracks = [self.tracks[i] for i in un_t1]
        m2, un_t2, un_d2 = self._associate(rem_tracks, dets[low] if low else np.empty((0, 4)),
                                           scs[low] if low else np.empty((0,)))
        for ti, di in m2:
            self._update_track(rem_tracks[ti], dets[low[di]], scs[low[di]])
            assigned[low[di]] = rem_tracks[ti].track_id

        # New tracks for unmatched high-score detections.
        for di in un_d1:
            idx = high[di]
            t = Track(track_id=self._next_id, xyxy=dets[idx].copy(), score=float(scs[idx]))
            self._next_id += 1
            self.tracks.append(t)
            assigned[idx] = t.track_id

        # Drop stale tracks.
        self.tracks = [t for t in self.tracks if t.time_since_update <= self.buffer]
        return assigned

    @staticmethod
    def _update_track(t: Track, box: np.ndarray, score: float) -> None:
        t.xyxy = box.copy()
        t.score = float(score)
        t.time_since_update = 0
        t.hits += 1
