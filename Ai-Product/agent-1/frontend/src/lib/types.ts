// Mirrors backend/app/schemas.py. All coordinates are in SOURCE-FRAME pixels
// (source_w x source_h, un-mirrored). The client maps them to display space.

export type DrawState = "normal" | "warning" | "violation" | "neutral";

export interface Box { x: number; y: number; w: number; h: number; }
export interface Pt { x: number; y: number; z?: number; v?: number | null; }

export interface PersonResult {
  track_id: number;
  box: Box;
  confidence: number;
  keypoints: Pt[];
  state: DrawState;
  movement_energy: number;
  kpt_velocity: number;
  posture_flags: string[];
}

export interface EyeResult {
  box: Box;
  iris_center?: Pt | null;
  ear?: number | null;
}

export interface Axis { origin: number[]; x?: number[]; y?: number[]; z?: number[]; dir?: number[]; }

export interface FaceResult {
  track_id: number;
  box: Box;
  confidence: number;
  state: DrawState;
  landmarks: Pt[];
  left_eye?: EyeResult | null;
  right_eye?: EyeResult | null;
  mouth_box?: Box | null;
  mar?: number | null;
  yaw?: number | null;
  pitch?: number | null;
  roll?: number | null;
  head_axis?: { origin: number[]; x: number[]; y: number[]; z: number[] } | null;
  gaze_class?: string | null;
  gaze_left?: { origin: number[]; dir: number[] } | null;
  gaze_right?: { origin: number[]; dir: number[] } | null;
  gaze_point?: number[] | null;
  emotions?: { label: string; prob: number }[] | null;
  identity_score?: number | null;
}

export interface ObjectResult {
  track_id: number; label: string; box: Box; confidence: number; state: DrawState;
}

export interface Hud {
  fps: number; latency_ms: number;
  yaw?: number | null; pitch?: number | null; roll?: number | null;
  gaze_class?: string | null; ear?: number | null; mar?: number | null;
  movement_energy: number; top_emotion?: string | null; identity_score?: number | null;
  risk_score: number; temporal_class: string; mode: string;
}

export interface Alert { kind: string; state: DrawState; message: string; since_ms: number; }

export interface FrameResult {
  type: "result";
  frame_id: number;
  ts_client_ms: number;
  ts_server_ms: number;
  source_w: number;
  source_h: number;
  persons: PersonResult[];
  faces: FaceResult[];
  objects: ObjectResult[];
  hud: Hud;
  alerts: Alert[];
  debug_jpeg_b64?: string | null;
}

export interface OverlayToggles {
  skeleton: boolean;
  faceMesh: boolean;
  gazeArrows: boolean;
  headAxis: boolean;
  hud: boolean;
  objectBoxes: boolean;
  eyeBoxes: boolean;
}

export const STATE_COLORS: Record<DrawState, string> = {
  normal: "#22c55e",
  warning: "#f59e0b",
  violation: "#ef4444",
  neutral: "#3b82f6",
};
