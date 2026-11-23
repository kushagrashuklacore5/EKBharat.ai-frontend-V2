// Pixel-accurate mapping from source-frame pixels to on-screen CSS pixels.
//
// The backend emits everything in SOURCE space (source_w x source_h, un-mirrored).
// On screen the video is shown in a display box (CSS px) with an object-fit rule, and
// the selfie preview is horizontally mirrored. This module computes a single transform
// that accounts for:
//   - source resolution vs. display box size
//   - object-fit: "cover" (crop) or "contain" (letterbox)
//   - mirrored selfie view (flip x)
// devicePixelRatio is handled separately by scaling the canvas context, so these
// functions work purely in CSS pixels.

export type ObjectFit = "cover" | "contain";

export interface MapParams {
  sourceW: number;
  sourceH: number;
  displayW: number; // CSS px
  displayH: number; // CSS px
  fit: ObjectFit;
  mirrored: boolean;
}

export interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayW: number;
  mirrored: boolean;
}

/** Compute the scale + offset that object-fit applies to the source content. */
export function computeTransform(p: MapParams): Transform {
  const scaleX = p.displayW / p.sourceW;
  const scaleY = p.displayH / p.sourceH;
  const scale = p.fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const renderedW = p.sourceW * scale;
  const renderedH = p.sourceH * scale;
  // Content is centered within the display box.
  const offsetX = (p.displayW - renderedW) / 2;
  const offsetY = (p.displayH - renderedH) / 2;
  return { scale, offsetX, offsetY, displayW: p.displayW, mirrored: p.mirrored };
}

/** Map a single source-space point to display (CSS px). */
export function mapPoint(x: number, y: number, t: Transform): [number, number] {
  let dx = x * t.scale + t.offsetX;
  const dy = y * t.scale + t.offsetY;
  if (t.mirrored) dx = t.displayW - dx; // flip horizontally so overlay matches the mirrored video
  return [dx, dy];
}

/** Map a source-space box; returns display box (x,y = top-left in CSS px). */
export function mapBox(
  box: { x: number; y: number; w: number; h: number },
  t: Transform
): { x: number; y: number; w: number; h: number } {
  const [x1, y1] = mapPoint(box.x, box.y, t);
  const [x2, y2] = mapPoint(box.x + box.w, box.y + box.h, t);
  // After a mirror, x1 and x2 swap order; normalize to top-left + positive w/h.
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return { x: left, y: top, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/** Map a direction vector (dx,dy). Mirroring flips the x component. */
export function mapVec(dx: number, dy: number, t: Transform): [number, number] {
  const sx = (t.mirrored ? -1 : 1) * dx * t.scale;
  const sy = dy * t.scale;
  return [sx, sy];
}
