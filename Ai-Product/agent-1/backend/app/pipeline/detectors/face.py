"""Face association / tracking.

MediaPipe Face Mesh gives us face landmarks but not stable track IDs. For Phase 1 we
assign IDs with a small greedy IoU tracker. In Phase 2 this is replaced by SCRFD
detection + ByteTrack for robustness when faces leave/re-enter the frame, and a
dedicated face-detection confidence (here we report a mesh-presence proxy).
"""
from __future__ import annotations

from dataclasses import dataclass, field


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax2, ay2, bx2, by2 = ax + aw, ay + ah, bx + bw, by + bh
    ix1, iy1 = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = aw * ah + bw * bh - inter
    return inter / union if union > 1e-6 else 0.0


@dataclass
class _Track:
    track_id: int
    box: tuple[float, float, float, float]
    misses: int = 0


class FaceTracker:
    """Greedy IoU tracker producing stable integer IDs for face boxes."""

    def __init__(self, iou_thresh: float = 0.3, max_misses: int = 15) -> None:
        self.iou_thresh = iou_thresh
        self.max_misses = max_misses
        self._tracks: list[_Track] = []
        self._next_id = 1

    def update(self, boxes: list[tuple[float, float, float, float]]) -> list[int]:
        """Return a track ID per input box (same order)."""
        assigned: list[int] = [-1] * len(boxes)
        used_tracks: set[int] = set()

        # Greedy match by best IoU.
        pairs = []
        for bi, box in enumerate(boxes):
            for ti, tr in enumerate(self._tracks):
                pairs.append((_iou(box, tr.box), bi, ti))
        pairs.sort(reverse=True)

        matched_boxes: set[int] = set()
        for iou, bi, ti in pairs:
            if iou < self.iou_thresh:
                break
            if bi in matched_boxes or ti in used_tracks:
                continue
            matched_boxes.add(bi)
            used_tracks.add(ti)
            self._tracks[ti].box = boxes[bi]
            self._tracks[ti].misses = 0
            assigned[bi] = self._tracks[ti].track_id

        # New tracks for unmatched boxes.
        for bi, box in enumerate(boxes):
            if assigned[bi] == -1:
                tr = _Track(track_id=self._next_id, box=box)
                self._next_id += 1
                self._tracks.append(tr)
                used_tracks.add(len(self._tracks) - 1)
                assigned[bi] = tr.track_id

        # Age unmatched tracks and prune.
        for ti, tr in enumerate(self._tracks):
            if ti not in used_tracks:
                tr.misses += 1
        self._tracks = [t for t in self._tracks if t.misses <= self.max_misses]
        return assigned
