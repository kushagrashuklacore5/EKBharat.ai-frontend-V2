# EKBharat AI Proctoring System

Production-grade, real-time AI exam proctoring. Watches each student's webcam live,
detects and tracks eye / head / body movement, faces, people and prohibited objects,
draws colour-coded overlays and raises cheating alerts using ML models (not if/else rules).

> **Status: Phase 2 complete** — on top of Phase 1, adds real ML estimators: SCRFD face
> detection + ArcFace identity, 6DRepNet head pose, L2CS/geometric gaze with on-screen
> calibration, HSEmotion affect, YOLO11s objects with ByteTrack, optical-flow + hand-zone
> motion, browser-event features, start-of-exam calibration (consent + enrolment + gaze
> dots + environment check), baseline risk scoring and flagged snapshots. See [Phases](#phases).

---

## Architecture (one glance)

```
browser (getUserMedia 640x480)
  │  JPEG frames @ 8–15 fps over WebSocket (frame_id + ts)
  ▼
FastAPI / Uvicorn  ──►  Pipeline (per frame, latest-only, no queue)
  │                       ├─ frame_decoder      JPEG -> BGR ndarray
  │                       ├─ detectors/person_pose  YOLO11-pose (17 kpts)
  │                       ├─ detectors/face         face box + conf
  │                       ├─ detectors/landmarks     MediaPipe 478 pts + iris
  │                       ├─ estimators/head_pose    yaw/pitch/roll
  │                       ├─ estimators/gaze          iris-vector gaze
  │                       ├─ motion                   keypoint velocity, energy
  │                       ├─ features                 per-frame feature vector
  │                       └─ risk (BASELINE)          0–100 risk + class
  ▼
JSON result per frame_id  ──►  browser canvas overlay (lib/overlay.ts)
                                 interpolated, mirror-aware, DPR-correct
```

## Quick start (CPU, single student — this machine has no GPU)

### Backend
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate     Linux/Mac:  source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_models.py          # downloads YOLO11n-pose weights
cp .env.example .env                        # tweak thresholds / fps / model paths
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```
Open the frontend, grant camera permission, and you should see the live overlay.

### Verify without a webcam
```bash
cd backend
pytest -q                                   # geometry + pipeline tests
python scripts/benchmark.py --synthetic     # per-stage FPS/latency on a synthetic frame
```

## Config
Every threshold, fps, model path and toggle lives in `backend/app/config.py` (pydantic-settings)
and can be overridden in `backend/.env`. Nothing proctoring-related is hard-coded.

## Model stack (Phase 2)
| Role | Model | Runtime | Download |
|------|-------|---------|----------|
| Person + pose | YOLO11n-pose | Ultralytics | `download_models.py` |
| Objects | YOLO11s + ByteTrack | Ultralytics | `download_models.py --all` |
| Face detect + 5pt | SCRFD (buffalo_l det_10g) | ONNX Runtime | `download_models.py --all` |
| Dense landmarks + iris | MediaPipe FaceMesh (478) | mediapipe | bundled |
| Head pose | **6DRepNet** (torch/ONNX) → solvePnP fallback | torch / ORT | `pip install sixdrepnet` or `export_onnx.py` |
| Gaze | **L2CS-Net** (ONNX) → iris-geometry fallback | ORT | `export_onnx.py --l2cs` |
| Emotion | HSEmotion (EfficientNet/AffectNet) | ONNX Runtime | auto (hsemotion-onnx) |
| Identity | ArcFace (buffalo_l w600k_r50) | ONNX Runtime | `download_models.py --all` |

Estimators auto-select their best available backend and fall back gracefully, so the
stream never crashes on a missing weight. The active backend per stage is reported in the
`ready` handshake (shown as capability chips in the UI) and logged at startup.

## Phases
1. **Phase 1 (done):** scaffold, WS transport, pose + face + landmarks live, overlays + HUD.
2. **Phase 2 (done):** 6DRepNet head pose, L2CS gaze + calibration, HSEmotion, ArcFace
   identity, SCRFD, objects (YOLO11s) + ByteTrack, motion/hand-zones, browser events,
   calibration flow, baseline risk, flagged snapshots, consent gate.
3. **Phase 3:** recording/labelling tools, dataset loaders, YOLO fine-tune, temporal Transformer.
4. **Phase 4:** proctor dashboard, reports, Postgres persistence, retention job.
5. **Phase 5:** Docker (CPU + GPU), benchmark report, deployment guide.

## Licensing
See [LICENSES.md](LICENSES.md). Ultralytics YOLO is **AGPL-3.0**; this matters because
EKBharat is commercial. Apache-2.0 alternatives (RT-DETR) and the enterprise-licence route
are documented there.

## Privacy (India DPDP Act)
Consent screen before camera start; no full-video storage by default; flagged snapshots +
features only, with configurable retention; face embeddings encrypted at rest; every final
decision made by a human proctor. Enforced from Phase 2 onward.
