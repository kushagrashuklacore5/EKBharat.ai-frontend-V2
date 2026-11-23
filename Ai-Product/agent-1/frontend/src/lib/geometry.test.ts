import { describe, it, expect } from "vitest";
import { computeTransform, mapPoint, mapBox, mapVec } from "./geometry";

const base = { sourceW: 640, sourceH: 480, fit: "contain" as const, mirrored: false };

describe("computeTransform", () => {
  it("contain letterboxes when display is wider than source AR", () => {
    // display 800x480 (AR 5:3) vs source 4:3 -> fit by height, horizontal bars
    const t = computeTransform({ ...base, displayW: 800, displayH: 480 });
    expect(t.scale).toBeCloseTo(1.0); // 480/480
    expect(t.offsetX).toBeCloseTo((800 - 640) / 2);
    expect(t.offsetY).toBeCloseTo(0);
  });

  it("cover crops to fill", () => {
    const t = computeTransform({ ...base, displayW: 800, displayH: 480, fit: "cover" });
    // scale = max(800/640, 480/480) = max(1.25,1.0)=1.25
    expect(t.scale).toBeCloseTo(1.25);
    expect(t.offsetY).toBeCloseTo((480 - 480 * 1.25) / 2); // negative (cropped)
  });
});

describe("mapPoint", () => {
  it("maps origin with letterbox offset", () => {
    const t = computeTransform({ ...base, displayW: 800, displayH: 480 });
    const [x, y] = mapPoint(0, 0, t);
    expect(x).toBeCloseTo(80);
    expect(y).toBeCloseTo(0);
  });

  it("mirrors x when mirrored", () => {
    const t = computeTransform({ ...base, displayW: 640, displayH: 480, mirrored: true });
    // center stays center
    const [cx] = mapPoint(320, 240, t);
    expect(cx).toBeCloseTo(320);
    // left edge of source maps to right edge of display
    const [lx] = mapPoint(0, 0, t);
    expect(lx).toBeCloseTo(640);
  });
});

describe("mapBox", () => {
  it("normalizes to top-left with positive size under mirror", () => {
    const t = computeTransform({ ...base, displayW: 640, displayH: 480, mirrored: true });
    const b = mapBox({ x: 10, y: 20, w: 100, h: 50 }, t);
    expect(b.w).toBeCloseTo(100);
    expect(b.h).toBeCloseTo(50);
    expect(b.x).toBeGreaterThanOrEqual(0);
    // mirrored: original right edge (110) -> display 530, left edge(10)->630; left=530
    expect(b.x).toBeCloseTo(530);
  });
});

describe("mapVec", () => {
  it("flips x under mirror, keeps y", () => {
    const t = computeTransform({ ...base, displayW: 640, displayH: 480, mirrored: true });
    const [vx, vy] = mapVec(10, 5, t);
    expect(vx).toBeCloseTo(-10);
    expect(vy).toBeCloseTo(5);
  });
});
