// All canvas drawing for the live overlay. Pure functions over a 2D context + the
// latest FrameResult + a precomputed source->display Transform. Colours follow the spec:
//   green #22c55e normal · amber #f59e0b warning · red #ef4444 violation · blue #3b82f6 neutral

import { mapBox, mapPoint, mapVec, Transform } from "./geometry";
import {
  FaceResult, FrameResult, OverlayToggles, PersonResult, STATE_COLORS,
} from "./types";

// COCO 17-keypoint skeleton edges (mirror of backend COCO_SKELETON).
const SKELETON: [number, number][] = [
  [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 6], [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [0, 1], [0, 2], [1, 3], [2, 4], [0, 5], [0, 6],
];
const KP_CONF_MIN = 0.5; // higher threshold avoids spurious limbs when the body is turned/partly out of frame

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
}

/** Corner-bracket (not full rectangle) box with a 2px border. */
function cornerBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string
): void {
  const len = Math.max(10, Math.min(w, h) * 0.22);
  const r = 6; // rounded corner radius
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + len); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + len, y);
  // top-right
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + len);
  // bottom-right
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + w - len, y + h);
  // bottom-left
  ctx.moveTo(x + len, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + h - len);
  ctx.stroke();
}

/** Label pill above a box. */
function labelPill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string, color: string
): void {
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  const padX = 7;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 18;
  const py = y - h - 4 < 0 ? y + 4 : y - h - 4;
  ctx.fillStyle = color;
  roundRect(ctx, x, py, w, h, 5);
  ctx.fill();
  ctx.fillStyle = "#0b0f14";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, py + h / 2 + 0.5);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const head = 7;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath(); ctx.fill();
}

function drawPerson(ctx: CanvasRenderingContext2D, p: PersonResult, t: Transform, tog: OverlayToggles): void {
  const color = STATE_COLORS[p.state];
  const b = mapBox(p.box, t);
  cornerBox(ctx, b.x, b.y, b.w, b.h, color);
  labelPill(ctx, b.x, b.y, `person #${p.track_id}  ${(p.confidence * 100).toFixed(0)}%`, color);

  if (tog.skeleton && p.keypoints.length >= 17) {
    // limbs
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    for (const [a, c] of SKELETON) {
      const ka = p.keypoints[a], kc = p.keypoints[c];
      if ((ka?.v ?? 0) < KP_CONF_MIN || (kc?.v ?? 0) < KP_CONF_MIN) continue;
      const [ax, ay] = mapPoint(ka.x, ka.y, t);
      const [cx, cy] = mapPoint(kc.x, kc.y, t);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
    }
    // joints
    ctx.fillStyle = "#e6edf3";
    for (const k of p.keypoints) {
      if ((k.v ?? 0) < KP_CONF_MIN) continue;
      const [kx, ky] = mapPoint(k.x, k.y, t);
      ctx.beginPath(); ctx.arc(kx, ky, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawFace(ctx: CanvasRenderingContext2D, f: FaceResult, t: Transform, tog: OverlayToggles): void {
  const color = STATE_COLORS[f.state];
  const b = mapBox(f.box, t);
  cornerBox(ctx, b.x, b.y, b.w, b.h, color);
  const gaze = f.gaze_class ? ` ${f.gaze_class}` : "";
  labelPill(ctx, b.x, b.y, `face #${f.track_id}${gaze}`, color);

  // Dense mesh (downsampled points already).
  if (tog.faceMesh && f.landmarks.length) {
    ctx.fillStyle = "rgba(230,237,243,0.45)";
    for (const p of f.landmarks) {
      const [x, y] = mapPoint(p.x, p.y, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Eye + mouth boxes.
  if (tog.eyeBoxes) {
    for (const eye of [f.left_eye, f.right_eye]) {
      if (!eye) continue;
      const eb = mapBox(eye.box, t);
      ctx.strokeStyle = "rgba(59,130,246,0.9)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(eb.x, eb.y, eb.w, eb.h);
      if (eye.iris_center) {
        const [ix, iy] = mapPoint(eye.iris_center.x, eye.iris_center.y, t);
        ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ix, iy, Math.max(3, eb.h * 0.18), 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (f.mouth_box) {
      const mb = mapBox(f.mouth_box, t);
      ctx.strokeStyle = "rgba(59,130,246,0.9)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(mb.x, mb.y, mb.w, mb.h);
    }
  }

  // Gaze arrows.
  if (tog.gazeArrows) {
    for (const g of [f.gaze_left, f.gaze_right]) {
      if (!g) continue;
      const [ox, oy] = mapPoint(g.origin[0], g.origin[1], t);
      const [vx, vy] = mapVec(g.dir[0], g.dir[1], t);
      arrow(ctx, ox, oy, ox + vx, oy + vy, "#22c55e");
    }
  }

  // Head-pose 3D axis (red X, green Y, blue Z) from nose tip.
  if (tog.headAxis && f.head_axis) {
    const [ox, oy] = mapPoint(f.head_axis.origin[0], f.head_axis.origin[1], t);
    const axes: [number[], string][] = [
      [f.head_axis.x, "#ef4444"],
      [f.head_axis.y, "#22c55e"],
      [f.head_axis.z, "#3b82f6"],
    ];
    for (const [pt, col] of axes) {
      const [ex, ey] = mapPoint(pt[0], pt[1], t);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
}

function drawHud(ctx: CanvasRenderingContext2D, r: FrameResult): void {
  const h = r.hud;
  const lines = [
    `FPS ${h.fps.toFixed(1)}   lat ${h.latency_ms.toFixed(0)}ms   [${h.mode}]`,
    `yaw ${fmt(h.yaw)}  pitch ${fmt(h.pitch)}  roll ${fmt(h.roll)}`,
    `gaze ${h.gaze_class ?? "-"}   EAR ${fmt(h.ear)}  MAR ${fmt(h.mar)}`,
    `move ${h.movement_energy.toFixed(2)}   emo ${h.top_emotion ?? "-"}   id ${fmt(h.identity_score)}`,
    `class ${h.temporal_class}`,
  ];
  const pad = 8, lh = 16;
  const w = 230, boxH = pad * 2 + lh * lines.length + 26;
  ctx.fillStyle = "rgba(11,15,20,0.72)";
  roundRect(ctx, 10, 10, w, boxH, 8); ctx.fill();

  // Risk bar.
  const risk = r.hud.risk_score;
  const riskColor = risk >= 65 ? "#ef4444" : risk >= 40 ? "#f59e0b" : "#22c55e";
  ctx.fillStyle = "#1e2732"; roundRect(ctx, 18, 18, w - 16, 14, 7); ctx.fill();
  ctx.fillStyle = riskColor; roundRect(ctx, 18, 18, (w - 16) * (risk / 100), 14, 7); ctx.fill();
  ctx.fillStyle = "#e6edf3"; ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle"; ctx.fillText(`RISK ${risk.toFixed(0)}`, 24, 25);

  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(ln, 18, 38 + i * lh);
  });
}

function fmt(v?: number | null): string {
  return v === null || v === undefined ? "-" : v.toFixed(1);
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  result: FrameResult,
  t: Transform,
  tog: OverlayToggles,
  displayW: number,
  displayH: number
): void {
  clearCanvas(ctx, displayW, displayH);
  for (const p of result.persons) drawPerson(ctx, p, t, tog);
  for (const f of result.faces) drawFace(ctx, f, t, tog);
  if (tog.objectBoxes) {
    for (const o of result.objects) {
      const b = mapBox(o.box, t);
      const color = STATE_COLORS[o.state];
      cornerBox(ctx, b.x, b.y, b.w, b.h, color);
      labelPill(ctx, b.x, b.y, `${o.label} #${o.track_id} ${(o.confidence * 100).toFixed(0)}%`, color);
    }
  }
  // Calibrated on-screen gaze point (normalized stage coords, not mirrored).
  if (tog.gazeArrows) {
    for (const f of result.faces) {
      if (!f.gaze_point) continue;
      const gx = f.gaze_point[0] * displayW;
      const gy = f.gaze_point[1] * displayH;
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(gx, gy, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx - 14, gy); ctx.lineTo(gx + 14, gy);
      ctx.moveTo(gx, gy - 14); ctx.lineTo(gx, gy + 14); ctx.stroke();
    }
  }
  if (tog.hud) drawHud(ctx, result);
  drawAlerts(ctx, result, displayW);
}

/** Active-alert pills stacked at the top-right (always shown). */
function drawAlerts(ctx: CanvasRenderingContext2D, result: FrameResult, displayW: number): void {
  if (!result.alerts?.length) return;
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  let y = 10;
  // de-duplicate by kind, most severe first
  const seen = new Set<string>();
  const ordered = [...result.alerts].sort((a, b) =>
    (b.state === "violation" ? 1 : 0) - (a.state === "violation" ? 1 : 0));
  for (const al of ordered) {
    if (seen.has(al.kind)) continue;
    seen.add(al.kind);
    const color = STATE_COLORS[al.state];
    const text = al.message || al.kind;
    const w = ctx.measureText(text).width + 18;
    const x = displayW - w - 10;
    ctx.fillStyle = "rgba(11,15,20,0.82)";
    roundRect(ctx, x, y, w, 22, 6); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 9, y + 11, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e6edf3"; ctx.textBaseline = "middle";
    ctx.fillText(text, x + 16, y + 12);
    y += 26;
  }
}
