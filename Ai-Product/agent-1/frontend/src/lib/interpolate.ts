// Timestamp-based interpolation between consecutive FrameResults.
//
// Results arrive at the processed rate (e.g. 8-15 fps) but we render at display refresh
// (e.g. 60 fps). To keep boxes smooth we keep a small buffer, render slightly in the
// past (one result interval), and linearly interpolate the geometry between the two
// results that bracket the render time. Matching is by track_id; unmatched tracks fall
// back to the newest result.

import { Box, FaceResult, FrameResult, PersonResult, Pt } from "./types";

export interface Stamped extends FrameResult {
  clientRecvMs: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpBox(a: Box, b: Box, t: number): Box {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: a.z, v: b.v ?? a.v };
}

function lerpArr(a?: number[], b?: number[], t = 0): number[] | undefined {
  if (!a || !b || a.length !== b.length) return b ?? a;
  return a.map((v, i) => lerp(v, b[i], t));
}

function lerpPerson(a: PersonResult, b: PersonResult, t: number): PersonResult {
  const kp = b.keypoints.map((kb, i) =>
    a.keypoints[i] ? lerpPt(a.keypoints[i], kb, t) : kb
  );
  return { ...b, box: lerpBox(a.box, b.box, t), keypoints: kp };
}

function lerpFace(a: FaceResult, b: FaceResult, t: number): FaceResult {
  const out: FaceResult = { ...b, box: lerpBox(a.box, b.box, t) };
  if (a.left_eye && b.left_eye) {
    out.left_eye = {
      ...b.left_eye,
      box: lerpBox(a.left_eye.box, b.left_eye.box, t),
      iris_center: a.left_eye.iris_center && b.left_eye.iris_center
        ? lerpPt(a.left_eye.iris_center, b.left_eye.iris_center, t) : b.left_eye.iris_center,
    };
  }
  if (a.right_eye && b.right_eye) {
    out.right_eye = {
      ...b.right_eye,
      box: lerpBox(a.right_eye.box, b.right_eye.box, t),
      iris_center: a.right_eye.iris_center && b.right_eye.iris_center
        ? lerpPt(a.right_eye.iris_center, b.right_eye.iris_center, t) : b.right_eye.iris_center,
    };
  }
  if (a.mouth_box && b.mouth_box) out.mouth_box = lerpBox(a.mouth_box, b.mouth_box, t);
  if (a.head_axis && b.head_axis) {
    out.head_axis = {
      origin: lerpArr(a.head_axis.origin, b.head_axis.origin, t)!,
      x: lerpArr(a.head_axis.x, b.head_axis.x, t)!,
      y: lerpArr(a.head_axis.y, b.head_axis.y, t)!,
      z: lerpArr(a.head_axis.z, b.head_axis.z, t)!,
    };
  }
  if (a.gaze_left && b.gaze_left) {
    out.gaze_left = { origin: lerpArr(a.gaze_left.origin, b.gaze_left.origin, t)!, dir: lerpArr(a.gaze_left.dir, b.gaze_left.dir, t)! };
  }
  if (a.gaze_right && b.gaze_right) {
    out.gaze_right = { origin: lerpArr(a.gaze_right.origin, b.gaze_right.origin, t)!, dir: lerpArr(a.gaze_right.dir, b.gaze_right.dir, t)! };
  }
  return out;
}

function byId<T extends { track_id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((i) => [i.track_id, i]));
}

/** Interpolate the geometry of two bracketing results at factor t in [0,1]. */
export function interpolate(a: Stamped, b: Stamped, t: number): FrameResult {
  const ta = Math.max(0, Math.min(1, t));
  const aP = byId(a.persons), aF = byId(a.faces);
  const persons = b.persons.map((bp) => {
    const ap = aP.get(bp.track_id);
    return ap ? lerpPerson(ap, bp, ta) : bp;
  });
  const faces = b.faces.map((bf) => {
    const af = aF.get(bf.track_id);
    return af ? lerpFace(af, bf, ta) : bf;
  });
  return { ...b, persons, faces };
}

/** Pick a render-time sample from a buffer, rendering ~`delayMs` in the past. */
export function sampleAtRenderTime(buf: Stamped[], delayMs: number): FrameResult | null {
  if (buf.length === 0) return null;
  if (buf.length === 1) return buf[0];
  const renderTime = performance.now() - delayMs;
  // Find the pair that brackets renderTime by client receive time.
  for (let i = buf.length - 1; i > 0; i--) {
    const b = buf[i], a = buf[i - 1];
    if (a.clientRecvMs <= renderTime && renderTime <= b.clientRecvMs) {
      const span = b.clientRecvMs - a.clientRecvMs || 1;
      return interpolate(a, b, (renderTime - a.clientRecvMs) / span);
    }
  }
  // renderTime newer than newest (or older than oldest) -> clamp to newest.
  return buf[buf.length - 1];
}
