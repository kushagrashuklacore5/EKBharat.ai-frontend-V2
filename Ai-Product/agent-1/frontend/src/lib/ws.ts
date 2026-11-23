// WebSocket transport for the proctoring stream.
//
// Sends frames as BINARY messages: a 16-byte little-endian header
//   frame_id (uint32) | ts_client_ms (float64) | flags (uint32)
// followed by raw JPEG bytes. This matches backend/app/main.py's binary path and avoids
// base64 overhead. The transport is deliberately small so it can be swapped for WebRTC
// (aiortc) later without touching the overlay/render code.

import type { FrameResult } from "./types";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export interface ProctorSocketOpts {
  url: string;
  sessionId: string;
  studentId?: string;
  mirrored: boolean;
  debug?: boolean;
  onResult: (r: FrameResult) => void;
  onStatus?: (s: WsStatus) => void;
  onReady?: (capabilities: Record<string, unknown>) => void;
  onCalibration?: (msg: any) => void;
}

const HEADER_BYTES = 16;

export class ProctorSocket {
  private ws?: WebSocket;
  private opts: ProctorSocketOpts;
  private ready = false;

  constructor(opts: ProctorSocketOpts) {
    this.opts = opts;
  }

  connect(): void {
    this.opts.onStatus?.("connecting");
    const ws = new WebSocket(this.opts.url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          session_id: this.opts.sessionId,
          student_id: this.opts.studentId,
          mirrored: this.opts.mirrored,
          debug: !!this.opts.debug,
        })
      );
      this.opts.onStatus?.("open");
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        this.ready = true;
        this.opts.onReady?.(msg.capabilities ?? {});
      } else if (msg.type === "result") {
        this.opts.onResult(msg as FrameResult);
      } else if (typeof msg.type === "string" && msg.type.endsWith("_result")) {
        this.opts.onCalibration?.(msg);
      }
    };

    ws.onerror = () => this.opts.onStatus?.("error");
    ws.onclose = () => {
      this.ready = false;
      this.opts.onStatus?.("closed");
    };
  }

  get isReady(): boolean {
    return this.ready && this.ws?.readyState === WebSocket.OPEN;
  }

  /** True only when the socket buffer is empty enough to accept a new frame. */
  canSend(maxBuffered = 1 << 20): boolean {
    return this.isReady && (this.ws?.bufferedAmount ?? Infinity) < maxBuffered;
  }

  sendFrame(frameId: number, tsClientMs: number, jpeg: ArrayBuffer): void {
    if (!this.isReady || !this.ws) return;
    const buf = new ArrayBuffer(HEADER_BYTES + jpeg.byteLength);
    const dv = new DataView(buf);
    dv.setUint32(0, frameId >>> 0, true);
    dv.setFloat64(4, tsClientMs, true);
    dv.setUint32(12, 0, true);
    new Uint8Array(buf, HEADER_BYTES).set(new Uint8Array(jpeg));
    this.ws.send(buf);
  }

  sendCalibration(type: string, extra?: Record<string, unknown>): void {
    if (!this.isReady || !this.ws) return;
    this.ws.send(JSON.stringify({ type, ...extra }));
  }

  sendBrowserEvent(event: string, detail?: string): void {
    if (!this.isReady || !this.ws) return;
    this.ws.send(
      JSON.stringify({
        type: "browser_event",
        ts_client_ms: performance.timeOrigin + performance.now(),
        event,
        detail,
      })
    );
  }

  close(): void {
    this.ws?.close();
  }
}
