"""Central configuration for the proctoring backend.

Every threshold, model path, fps target and feature toggle lives here (or in a `.env`
file next to it). Nothing proctoring-related should be hard-coded elsewhere in the
codebase -- import `settings` and read it.

Uses pydantic-settings so values can be overridden by environment variables or `.env`.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo-relative anchors ------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent          # .../backend
APP_DIR = BACKEND_DIR / "app"
MODELS_DIR = APP_DIR / "models"


class Settings(BaseSettings):
    """Runtime settings. Override any field via env var (same name) or `.env`."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=(),          # allow fields that start with "model_"
    )

    # --- Server ---------------------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])
    LOG_LEVEL: str = "INFO"

    # --- Video / transport ---------------------------------------------
    FRAME_WIDTH: int = 640
    FRAME_HEIGHT: int = 480
    TARGET_FPS: int = 12                  # client capture/send target (8-15)
    JPEG_QUALITY: float = 0.7
    DROP_STALE_FRAMES: bool = True        # process only the newest frame per socket
    RETURN_DEBUG_JPEG: bool = False       # server-side annotated JPEG when debug=true

    # --- Inference backend ---------------------------------------------
    # "onnx" uses onnxruntime; providers chosen by DEVICE.
    DEVICE: str = "cpu"                   # "cpu" | "cuda"
    MODEL_BACKEND: str = "ultralytics"    # "ultralytics" | "rtdetr" (Phase 2+)
    ORT_PROVIDERS_CUDA: list[str] = Field(default=["CUDAExecutionProvider", "CPUExecutionProvider"])
    ORT_PROVIDERS_CPU: list[str] = Field(default=["CPUExecutionProvider"])
    ORT_INTRA_THREADS: int = 0            # 0 = ORT default (physical cores); don't over-subscribe
    TORCH_NUM_THREADS: int = 0            # 0 = torch default

    # --- Model paths / selection ---------------------------------------
    POSE_MODEL: str = "yolo11n-pose.pt"   # tiny model for CPU; use yolo11s-pose on GPU
    POSE_CONF: float = 0.35
    POSE_IOU: float = 0.5
    POSE_MAX_PERSONS: int = 5
    POSE_IMGSZ: int = 384                  # YOLO inference size; lower = much faster on CPU (640 default)

    FACE_MESH_MAX_FACES: int = 2
    FACE_MESH_MIN_DET_CONF: float = 0.5
    FACE_MESH_MIN_TRACK_CONF: float = 0.5

    # Per-detector stride: run heavy stages every Nth frame, reuse last result between.
    STRIDE_POSE: int = 1
    STRIDE_FACE: int = 1
    STRIDE_LANDMARKS: int = 1
    STRIDE_OBJECTS: int = 2               # Phase 2
    STRIDE_EMOTION: int = 5               # Phase 2
    STRIDE_IDENTITY: int = 5              # Phase 2
    STRIDE_FACE_DETECT: int = 2           # SCRFD every Nth frame (reuse boxes between)
    STRIDE_HEAD: int = 2                  # 6DRepNet head pose every Nth frame (reuse angles)

    # --- Geometry / thresholds (eyes, mouth, gaze) ---------------------
    EAR_CLOSED_THRESH: float = 0.18       # eye aspect ratio below => eye closed
    MAR_TALKING_THRESH: float = 0.35      # mouth aspect ratio above => mouth open
    GAZE_CENTER_TOL_DEG: float = 16.0     # within +/- this yaw/pitch => "center" (screen-reading band)
    GAZE_OFFSCREEN_DEG: float = 35.0      # beyond this => "off-screen"
    HEADPOSE_AWAY_YAW_DEG: float = 32.0   # |yaw| above => head clearly turned away
    HEADPOSE_AWAY_PITCH_DEG: float = 30.0 # |pitch| above => head clearly down/up (notes/lap)

    # --- Smoothing (overlay jitter) ------------------------------------
    USE_ONE_EURO: bool = True
    ONE_EURO_MIN_CUTOFF: float = 1.0
    ONE_EURO_BETA: float = 0.007
    EMA_ALPHA: float = 0.4                # fallback EMA if One-Euro disabled

    # --- Baseline risk (Phase 1/2 before temporal model exists) --------
    RISK_EMA_ALPHA: float = 0.3
    RISK_WARN_THRESH: float = 40.0
    RISK_ALERT_THRESH: float = 65.0
    ALERT_MIN_DURATION_S: float = 1.5     # sustain before an alert fires (hysteresis)
    LOOKING_AWAY_WARN_S: float = 0.8
    LOOKING_AWAY_ALERT_S: float = 2.0

    # --- Phase 2: objects (YOLO11s) ------------------------------------
    OBJECT_MODEL: str = "yolo11s.pt"      # COCO pretrained; fine-tuned in Phase 3
    OBJECT_CONF: float = 0.35
    OBJECT_IOU: float = 0.5
    OBJECT_MAX_DET: int = 20
    OBJECT_IMGSZ: int = 384                # YOLO inference size for objects

    # --- Phase 2: face detection (SCRFD / buffalo_l) -------------------
    USE_SCRFD: bool = True                 # SCRFD det_10g.onnx; else fall back to mesh box
    SCRFD_MODEL: str = "buffalo_l/det_10g.onnx"
    SCRFD_CONF: float = 0.5
    SCRFD_INPUT: int = 384                # 640 (accuracy) .. 320 (CPU speed); 384 is a good balance

    # --- Phase 2: identity (ArcFace / buffalo_l) -----------------------
    ARCFACE_MODEL: str = "buffalo_l/w600k_r50.onnx"
    IDENTITY_MATCH_THRESH: float = 0.35    # cosine similarity below => mismatch flag
    IDENTITY_ENROLL_FRAMES: int = 5

    # --- Phase 2: head pose (6DRepNet) ---------------------------------
    HEADPOSE_MODEL: str = "sixdrepnet.onnx"   # export via scripts/export_onnx.py
    USE_6DREPNET: bool = True                  # falls back to solvePnP if weights absent

    # --- Phase 2: gaze (L2CS-Net) --------------------------------------
    GAZE_MODEL: str = "l2cs.onnx"              # export via scripts/export_onnx.py
    USE_L2CS: bool = True                      # falls back to iris-geometry if absent

    # --- Phase 2: emotion (HSEmotion) ----------------------------------
    EMOTION_MODEL: str = "enet_b0_8_best_afew"  # hsemotion-onnx auto-downloads

    # --- Phase 2: motion -----------------------------------------------
    USE_OPTICAL_FLOW: bool = False         # dense Farneback flow (costly on CPU)

    # --- Phase 2: snapshots / storage ----------------------------------
    SNAPSHOT_DIR: str = "../data/snapshots"
    SNAPSHOT_ON_VIOLATION: bool = True
    SNAPSHOT_MIN_INTERVAL_S: float = 3.0   # debounce repeated snapshots per kind

    # --- Phase 2: calibration ------------------------------------------
    CALIB_MIN_BRIGHTNESS: float = 60.0     # mean luma; warn if below
    CALIB_MAX_BRIGHTNESS: float = 220.0    # warn if washed out / backlit
    CALIB_MIN_FACE_FRAC: float = 0.08      # face box area / frame area, minimum

    # --- Phase 2+: liveness / anti-spoof -------------------------------
    LIVENESS_NEED_BLINKS: int = 2          # blinks required in the active challenge
    LIVENESS_TURN_YAW_DEG: float = 20.0    # head yaw magnitude that counts as a left/right turn
    LIVENESS_REQUIRED: bool = True         # block exam start until liveness passes
    LIVENESS_NO_BLINK_S: float = 35.0      # face present this long with no blink => possible photo
    SPOOF_MODEL: str = "minifasnet.onnx"   # optional passive CNN; activates if present
    SPOOF_REAL_THRESH: float = 0.5         # live-probability below => spoof flag

    # --- Temporal model (Phase 3) --------------------------------------
    TEMPORAL_MODEL_PATH: str = "temporal_model.onnx"  # hot-swapped when present
    TEMPORAL_WINDOW_S: float = 5.0
    TEMPORAL_FPS: int = 10
    TEMPORAL_STRIDE_S: float = 1.0
    TEMPORAL_TEMPERATURE: float = 1.5     # temperature scaling for calibrated probs
    TEMPORAL_CLASS_THRESH: float = 0.5    # per-class prob above => that behaviour is active

    @property
    def models_dir(self) -> Path:
        return MODELS_DIR

    @property
    def ort_providers(self) -> list[str]:
        return self.ORT_PROVIDERS_CUDA if self.DEVICE == "cuda" else self.ORT_PROVIDERS_CPU

    def model_path(self, filename: str) -> Path:
        """Absolute path to a weight file under app/models/."""
        return MODELS_DIR / filename


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton. Import this everywhere instead of constructing Settings()."""
    return Settings()


settings = get_settings()
