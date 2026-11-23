import { useCallback, useEffect, useRef, useState } from "react";
import { computeTransform } from "../lib/geometry";
import { drawOverlay } from "../lib/overlay";
import { ProctorSocket, WsStatus } from "../lib/ws";
import { sampleAtRenderTime, Stamped } from "../lib/interpolate";
import { FrameResult, OverlayToggles } from "../lib/types";
import { CalibrationPanel, CalMessage } from "./CalibrationPanel";
import { ConsentScreen } from "./ConsentScreen";
import { AudioMonitor } from "../lib/audio";
import { startIntegrity, IntegrityHandle } from "../lib/integrity";

type Phase = "consent" | "calibrating" | "live" | "ended";

const DEMO_SECONDS = 5 * 60;   // the whole proctoring demo runs for 5 minutes

const SOURCE_W = 640;
const SOURCE_H = 480;
const TARGET_FPS = 12;              // 8-15; keep in sync with backend TARGET_FPS
const JPEG_QUALITY = 0.7;
const RENDER_DELAY_MS = 1000 / TARGET_FPS; // render ~one result-interval in the past
const WS_URL =
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/proctor";

const DEFAULT_TOGGLES: OverlayToggles = {
  skeleton: true, faceMesh: false, gazeArrows: true,
  headAxis: true, hud: true, objectBoxes: true, eyeBoxes: true,
};

export function LiveProctorView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const socketRef = useRef<ProctorSocket | null>(null);
  const audioRef = useRef<AudioMonitor | null>(null);
  const integrityRef = useRef<IntegrityHandle | null>(null);
  const bufferRef = useRef<Stamped[]>([]);
  const frameIdRef = useRef(0);
  const rafRef = useRef(0);
  const captureTimerRef = useRef<number | null>(null);
  const demoTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<WsStatus>("closed");
  const [running, setRunning] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const [debug, setDebug] = useState(false);
  const [phase, setPhase] = useState<Phase>("consent");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [cal, setCal] = useState<CalMessage | null>(null);
  const [caps, setCaps] = useState<Record<string, unknown>>({});
  const [toggles, setToggles] = useState<OverlayToggles>(DEFAULT_TOGGLES);
  const togglesRef = useRef(toggles);
  togglesRef.current = toggles;
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;

  const onResult = useCallback((r: FrameResult) => {
    const stamped: Stamped = { ...r, clientRecvMs: performance.now() };
    const buf = bufferRef.current;
    buf.push(stamped);
    if (buf.length > 6) buf.shift();
    audioRef.current?.feedMar(r.hud.mar);   // correlate voice with mouth motion
  }, []);

  // --- render loop (runs always; draws whatever is in the buffer) ---
  useEffect(() => {
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) return;
      // Resize backing store to match CSS size * DPR for crisp lines.
      const needW = Math.round(cssW * dpr);
      const needH = Math.round(cssH * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW; canvas.height = needH;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px

      const result = sampleAtRenderTime(bufferRef.current, RENDER_DELAY_MS);
      if (!result) { ctx.clearRect(0, 0, cssW, cssH); return; }

      const t = computeTransform({
        sourceW: result.source_w || SOURCE_W,
        sourceH: result.source_h || SOURCE_H,
        displayW: cssW, displayH: cssH,
        fit: "cover",              // the <video> uses object-fit: cover (width/height 100%)
        mirrored: mirroredRef.current,
      });
      drawOverlay(ctx, result, t, togglesRef.current, cssW, cssH);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // --- capture + send loop ---
  const startCapture = useCallback(() => {
    const cap = captureRef.current;
    cap.width = SOURCE_W; cap.height = SOURCE_H;
    const cctx = cap.getContext("2d", { alpha: false })!;

    const tick = async () => {
      const video = videoRef.current;
      const sock = socketRef.current;
      if (!video || !sock || !sock.canSend() || video.readyState < 2) return;
      // Draw the RAW (un-mirrored) video frame into the capture canvas.
      cctx.drawImage(video, 0, 0, SOURCE_W, SOURCE_H);
      const blob: Blob | null = await new Promise((res) =>
        cap.toBlob((b) => res(b), "image/jpeg", JPEG_QUALITY)
      );
      if (!blob) return;
      const ab = await blob.arrayBuffer();
      const ts = performance.timeOrigin + performance.now();
      sock.sendFrame(frameIdRef.current++, ts, ab);
    };
    captureTimerRef.current = window.setInterval(tick, 1000 / TARGET_FPS);
  }, []);

  // Stop camera, mic, socket and all timers (shared by manual stop and demo end).
  const shutdownMedia = useCallback(() => {
    if (captureTimerRef.current) { clearInterval(captureTimerRef.current); captureTimerRef.current = null; }
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
    audioRef.current?.stop(); audioRef.current = null;
    integrityRef.current?.stop(); integrityRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;   // turn the camera light off
    }
    bufferRef.current = [];
    setRunning(false);
  }, []);

  const stop = useCallback(() => {
    shutdownMedia();
    setPhase("consent");
    setCal(null);
    setTimeLeft(null);
  }, [shutdownMedia]);

  // Called when the 5-minute timer reaches zero: shut the camera and show the end popup.
  const endDemo = useCallback(() => {
    shutdownMedia();
    setTimeLeft(0);
    setPhase("ended");
  }, [shutdownMedia]);

  const startDemoTimer = useCallback(() => {
    const deadline = performance.now() + DEMO_SECONDS * 1000;
    setTimeLeft(DEMO_SECONDS);
    demoTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        if (demoTimerRef.current) clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
        endDemo();
      }
    }, 250);
  }, [endDemo]);

  const start = useCallback(async () => {
    try {
      // Request mic for voice-activity detection; fall back to video-only if denied.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: SOURCE_W, height: SOURCE_H, facingMode: "user" }, audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: SOURCE_W, height: SOURCE_H, facingMode: "user" }, audio: false,
        });
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const sessionId = `sess-${Date.now()}`;
      const sock = new ProctorSocket({
        url: WS_URL, sessionId, mirrored, debug,
        onResult, onStatus: setStatus,
        onReady: (capabilities) => {
          setCaps(capabilities);
          startCapture();
          setRunning(true);
          setPhase("calibrating");
          startDemoTimer();                 // 5-minute demo countdown
          // Audio VAD (second-voice / talking) + browser integrity monitors.
          audioRef.current = new AudioMonitor(stream, (e) => socketRef.current?.sendBrowserEvent(e));
          audioRef.current.start();
          integrityRef.current = startIntegrity((e, d) => socketRef.current?.sendBrowserEvent(e, d));
        },
        onCalibration: (msg) => setCal(msg as CalMessage),
      });
      socketRef.current = sock;
      sock.connect();
    } catch (err) {
      alert("Camera/WebSocket error: " + (err as Error).message);
    }
  }, [mirrored, debug, onResult, startCapture, startDemoTimer]);

  const sendCal = useCallback((type: string, extra?: Record<string, unknown>) => {
    socketRef.current?.sendCalibration(type, extra);
  }, []);

  // --- browser integrity events ---
  useEffect(() => {
    const send = (ev: string, detail?: string) => socketRef.current?.sendBrowserEvent(ev, detail);
    const onVis = () => send(document.hidden ? "tab_hidden" : "tab_visible");
    const onBlur = () => send("blur");
    const onFocus = () => send("focus");
    const onFs = () => { if (!document.fullscreenElement) send("fullscreen_exit"); };
    const onCopy = () => send("copy");
    const onPaste = () => send("paste");
    const onCtx = () => send("contextmenu");
    const onResize = () => send("resize", `${window.innerWidth}x${window.innerHeight}`);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onCtx);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => () => stop(), [stop]);

  const Toggle = ({ k, label }: { k: keyof OverlayToggles; label: string }) => (
    <label>
      <input type="checkbox" checked={toggles[k]}
        onChange={(e) => setToggles((t) => ({ ...t, [k]: e.target.checked }))} />
      {label}
    </label>
  );

  const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const showStage = phase === "calibrating" || phase === "live";

  return (
    <div>
      {/* 5-minute demo countdown, pinned at the top */}
      {timeLeft !== null && showStage && (
        <div className={`demo-timer ${timeLeft <= 30 ? "danger" : timeLeft <= 60 ? "warn" : ""}`}>
          <span className="dt-dot" /> Demo ends in <b>{mmss(timeLeft)}</b>
        </div>
      )}

      {/* The stage is always mounted (so videoRef exists before start()); it is just
          hidden behind the consent card until the camera is enabled. */}
      {phase === "consent" && (
        <ConsentScreen onAccept={start} mirrored={mirrored} setMirrored={setMirrored} />
      )}

      {phase === "ended" && (
        <div className="demo-ended">
          <div className="demo-ended-card">
            <div className="de-icon">⏱</div>
            <h2>Your demo has been ended</h2>
            <p className="muted">The 5-minute AI proctoring demo is over and the camera has been switched off.</p>
            <button className="primary" onClick={stop}>Start again</button>
          </div>
        </div>
      )}

      <div className="stage" style={{ display: showStage ? "block" : "none" }}>
        <video ref={videoRef} className={mirrored ? "mirrored" : ""}
          muted playsInline style={{ objectFit: "cover" }} />
        <canvas ref={canvasRef} />
        {phase === "calibrating" && (
          <CalibrationPanel send={sendCal} cal={cal} onComplete={() => setPhase("live")} />
        )}
      </div>

      {showStage && (<>
      <div className="controls">
        <button onClick={stop}>Stop / restart</button>
        <button onClick={() => setDebug((d) => !d)} disabled={running}>
          Debug JPEG: {debug ? "on" : "off"}
        </button>
        <span className="status">
          <span className={`dot ${status === "open" ? "ok" : "off"}`} />
          {status}{phase === "live" ? " · proctoring" : " · calibrating"}
        </span>
      </div>

      <div className="caps">
        {Object.entries(caps).map(([k, v]) => (
          <span key={k} className={`cap ${v && v !== false ? "on" : "off"}`}>
            {k}: {String(v)}
          </span>
        ))}
      </div>

      <div className="toggles">
        <Toggle k="skeleton" label="Skeleton" />
        <Toggle k="faceMesh" label="Face mesh" />
        <Toggle k="gazeArrows" label="Gaze arrows" />
        <Toggle k="headAxis" label="Head axis" />
        <Toggle k="eyeBoxes" label="Eyes/iris" />
        <Toggle k="objectBoxes" label="Objects" />
        <Toggle k="hud" label="HUD" />
      </div>
      </>)}
    </div>
  );
}
