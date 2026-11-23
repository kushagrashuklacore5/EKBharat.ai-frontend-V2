# Licensing notes (read before commercial deployment)

EKBharat.ai is a **commercial** product. Several models in the default stack carry
copyleft or research-only licences. This file tracks them and the swap-in alternatives.

| Component | Default model | Licence | Commercial implication |
|-----------|---------------|---------|------------------------|
| Person + pose | Ultralytics YOLO11-pose | **AGPL-3.0** | Network-copyleft. Serving it over a network can trigger source-disclosure of the whole app. |
| Objects | Ultralytics YOLO11s | **AGPL-3.0** | Same as above. |
| Face landmarks + iris | MediaPipe Face Landmarker | Apache-2.0 | OK for commercial use. |
| Face detection (SCRFD) | InsightFace | MIT (code) / model weights vary | Check individual model-zoo weights. |
| Head pose | 6DRepNet | MIT | OK. |
| Gaze | L2CS-Net | MIT | OK. |
| Emotion | HSEmotion | Apache-2.0 | OK. Feature only, never a standalone flag. |
| Identity | ArcFace (InsightFace buffalo_l) | research/non-commercial for some weights | **Verify weight licence before shipping.** |

## Ultralytics AGPL-3.0 — the important one

AGPL-3.0 requires that if you run modified AGPL software to provide a network service,
you must offer the complete corresponding source to users of that service. For a
closed-source commercial proctoring SaaS this is usually unacceptable.

**Options:**
1. **Buy an Ultralytics Enterprise Licence** — removes AGPL obligations. Recommended if
   you want to keep YOLO11 and stay closed-source. Contact Ultralytics sales.
2. **Swap to Apache-2.0 / permissive detectors:**
   - **RT-DETR** via Hugging Face `transformers` (`PekingU/rtdetr_*`) — Apache-2.0,
     strong object detection, no AGPL.
   - **YOLOX** (Apache-2.0) or **YOLO-NAS** (check Deci licence) for detection.
   - For pose: **RTMPose / RTMW** (MMPose, Apache-2.0) or **ViTPose** (Apache-2.0).
3. **Keep YOLO only for internal R&D / benchmarking**, ship a permissive model in prod.

The transport, pipeline, overlay and temporal model in this repo are all model-agnostic:
detectors live behind a small interface in `backend/app/pipeline/detectors/`, so replacing
the backbone is a localized change. See `backend/app/config.py` → `MODEL_BACKEND`.

## Action items before go-live
- [ ] Decide YOLO path (enterprise licence vs. RT-DETR swap).
- [ ] Confirm ArcFace weight licence for commercial use.
- [ ] Record SBOM / model cards with each shipped model (see `training/` model cards).
