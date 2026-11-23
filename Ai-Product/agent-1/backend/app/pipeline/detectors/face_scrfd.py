"""SCRFD face detector (InsightFace buffalo_l det_10g.onnx) on ONNX Runtime.

Provides real face detection boxes + confidence + 5 landmarks, replacing the MediaPipe
mesh-box proxy / fake confidence used in Phase 1. The pipeline still uses MediaPipe for
the 478 dense landmarks (iris, EAR/MAR), associating each mesh to the overlapping SCRFD
box to attach a genuine detection confidence and to count faces robustly (e.g. a second
person at the frame edge).

Decode follows the standard SCRFD anchor scheme (strides 8/16/32, 2 anchors/cell,
distance2bbox), matching the reference InsightFace implementation.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from ..._compat import lazy_import_onnxruntime
from ...config import settings

logger = logging.getLogger(__name__)

_STRIDES = (8, 16, 32)
_NUM_ANCHORS = 2


@dataclass
class FaceDetection:
    box_xywh: tuple[float, float, float, float]
    confidence: float
    landmarks5: np.ndarray            # (5,2) in source pixels


def _distance2bbox(points: np.ndarray, distance: np.ndarray) -> np.ndarray:
    x1 = points[:, 0] - distance[:, 0]
    y1 = points[:, 1] - distance[:, 1]
    x2 = points[:, 0] + distance[:, 2]
    y2 = points[:, 1] + distance[:, 3]
    return np.stack([x1, y1, x2, y2], axis=-1)


def _distance2kps(points: np.ndarray, distance: np.ndarray) -> np.ndarray:
    preds = []
    for i in range(0, distance.shape[1], 2):
        preds.append(points[:, 0] + distance[:, i])
        preds.append(points[:, 1] + distance[:, i + 1])
    return np.stack(preds, axis=-1)


def _nms(dets: np.ndarray, thresh: float) -> list[int]:
    x1, y1, x2, y2, scores = dets[:, 0], dets[:, 1], dets[:, 2], dets[:, 3], dets[:, 4]
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[np.where(ovr <= thresh)[0] + 1]
    return keep


class SCRFDDetector:
    def __init__(self) -> None:
        from ..._compat import make_ort_session
        path = settings.model_path(settings.SCRFD_MODEL)
        if not path.exists():
            raise FileNotFoundError(
                f"SCRFD model not found at {path}. Run scripts/download_models.py --all"
            )
        self.sess = make_ort_session(str(path), settings.ort_providers)
        self.input_name = self.sess.get_inputs()[0].name
        self.output_names = [o.name for o in self.sess.get_outputs()]
        self.input_size = settings.SCRFD_INPUT
        self._center_cache: dict[tuple[int, int, int], np.ndarray] = {}
        logger.info("Loaded SCRFD %s (in=%d, outs=%d)",
                    settings.SCRFD_MODEL, self.input_size, len(self.output_names))

    def _anchor_centers(self, h: int, w: int, stride: int) -> np.ndarray:
        key = (h, w, stride)
        if key in self._center_cache:
            return self._center_cache[key]
        ys, xs = np.mgrid[:h, :w]
        centers = np.stack([xs, ys], axis=-1).astype(np.float32) * stride
        centers = centers.reshape(-1, 2)
        if _NUM_ANCHORS > 1:
            centers = np.repeat(centers, _NUM_ANCHORS, axis=0)
        if len(self._center_cache) < 100:
            self._center_cache[key] = centers
        return centers

    def detect(self, frame_bgr: np.ndarray) -> list[FaceDetection]:
        h0, w0 = frame_bgr.shape[:2]
        sz = self.input_size
        scale = min(sz / w0, sz / h0)
        nw, nh = int(round(w0 * scale)), int(round(h0 * scale))
        resized = cv2.resize(frame_bgr, (nw, nh))
        canvas = np.zeros((sz, sz, 3), dtype=np.uint8)
        canvas[:nh, :nw] = resized

        blob = cv2.dnn.blobFromImage(
            canvas, 1.0 / 128.0, (sz, sz), (127.5, 127.5, 127.5), swapRB=True
        )
        outs = self.sess.run(self.output_names, {self.input_name: blob})

        fmc = len(_STRIDES)
        scores_list, bboxes_list, kps_list = [], [], []
        for idx, stride in enumerate(_STRIDES):
            scores = outs[idx]
            bbox_preds = outs[idx + fmc] * stride
            kps_preds = outs[idx + fmc * 2] * stride
            h = sz // stride
            w = sz // stride
            centers = self._anchor_centers(h, w, stride)
            pos = np.where(scores.ravel() >= settings.SCRFD_CONF)[0]
            if pos.size == 0:
                continue
            bboxes = _distance2bbox(centers, bbox_preds)
            kpss = _distance2kps(centers, kps_preds)
            scores_list.append(scores.ravel()[pos])
            bboxes_list.append(bboxes[pos])
            kps_list.append(kpss[pos])

        if not scores_list:
            return []
        scores = np.concatenate(scores_list)
        bboxes = np.concatenate(bboxes_list) / scale          # back to source px
        kpss = np.concatenate(kps_list) / scale
        pre = np.hstack([bboxes, scores[:, None]]).astype(np.float32)
        keep = _nms(pre, 0.4)

        out: list[FaceDetection] = []
        for i in keep:
            x1, y1, x2, y2 = bboxes[i]
            out.append(FaceDetection(
                box_xywh=(float(x1), float(y1), float(x2 - x1), float(y2 - y1)),
                confidence=float(scores[i]),
                landmarks5=kpss[i].reshape(5, 2),
            ))
        return out
