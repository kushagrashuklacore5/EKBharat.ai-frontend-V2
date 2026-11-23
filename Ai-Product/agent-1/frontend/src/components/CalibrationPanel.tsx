import { useCallback, useEffect, useRef, useState } from "react";

// 9-point gaze calibration grid (normalized positions within the stage).
const GAZE_DOTS: [number, number][] = [
  [0.1, 0.1], [0.5, 0.1], [0.9, 0.1],
  [0.1, 0.5], [0.5, 0.5], [0.9, 0.5],
  [0.1, 0.9], [0.5, 0.9], [0.9, 0.9],
];

export interface CalSummary {
  enrolled: boolean;
  gaze_ready: boolean;
  env_passed: boolean;
  liveness_passed: boolean;
  complete: boolean;
}

export interface CalMessage {
  type: string;
  summary?: CalSummary;
  captured?: number;
  need?: number;
  enrolled?: boolean;
  ok?: boolean;
  issues?: string[];
  brightness?: number;
  face_count?: number;
  samples?: number;
  gaze_ready?: boolean;
  blinks?: number;
  need_blinks?: number;
  turned_left?: boolean;
  turned_right?: boolean;
}

type Step = "environment" | "enroll" | "liveness" | "gaze" | "done";

const ISSUE_TEXT: Record<string, string> = {
  too_dark: "Too dark — add light",
  too_bright_or_backlit: "Too bright / backlit — reduce backlight",
  no_face: "No face detected — center yourself",
  multiple_faces: "More than one face in view",
  face_too_small_or_far: "Move closer to the camera",
};

export function CalibrationPanel({
  send, cal, onComplete,
}: {
  send: (type: string, extra?: Record<string, unknown>) => void;
  cal: CalMessage | null;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("environment");
  const [gazeIdx, setGazeIdx] = useState(0);
  const enrollTimer = useRef<number | null>(null);
  const envTimer = useRef<number | null>(null);
  const gazeTimer = useRef<number | null>(null);
  const liveTimer = useRef<number | null>(null);

  const summary = cal?.summary;

  // --- environment: poll until it passes ---
  useEffect(() => {
    if (step !== "environment") return;
    envTimer.current = window.setInterval(() => send("calibrate_env"), 1000);
    send("calibrate_env");
    return () => { if (envTimer.current) clearInterval(envTimer.current); };
  }, [step, send]);

  useEffect(() => {
    if (step === "environment" && summary?.env_passed) {
      if (envTimer.current) clearInterval(envTimer.current);
      setStep("enroll");
    }
  }, [step, summary?.env_passed]);

  // --- enrolment: capture frames until enrolled ---
  const startEnroll = useCallback(() => {
    enrollTimer.current = window.setInterval(() => send("calibrate_enroll"), 400);
  }, [send]);

  useEffect(() => {
    if (step === "enroll" && summary?.enrolled) {
      if (enrollTimer.current) clearInterval(enrollTimer.current);
      setStep("liveness");
    }
  }, [step, summary?.enrolled]);

  // --- liveness: blink + head-turn challenge (anti-spoof) ---
  useEffect(() => {
    if (step !== "liveness") return;
    liveTimer.current = window.setInterval(() => send("calibrate_liveness"), 350);
    return () => { if (liveTimer.current) clearInterval(liveTimer.current); };
  }, [step, send]);

  useEffect(() => {
    if (step === "liveness" && summary?.liveness_passed) {
      if (liveTimer.current) clearInterval(liveTimer.current);
      setStep("gaze");
    }
  }, [step, summary?.liveness_passed]);

  // --- gaze: show each dot ~1.3s then sample ---
  useEffect(() => {
    if (step !== "gaze") return;
    if (gazeIdx >= GAZE_DOTS.length) { setStep("done"); return; }
    const [tx, ty] = GAZE_DOTS[gazeIdx];
    gazeTimer.current = window.setTimeout(() => {
      send("calibrate_gaze", { target_x: tx, target_y: ty });
      setGazeIdx((i) => i + 1);
    }, 1300);
    return () => { if (gazeTimer.current) clearTimeout(gazeTimer.current); };
  }, [step, gazeIdx, send]);

  useEffect(() => () => {
    [enrollTimer, envTimer, gazeTimer, liveTimer].forEach((t) => t.current && clearInterval(t.current));
  }, []);

  return (
    <div className="calib-overlay">
      {step === "gaze" && gazeIdx < GAZE_DOTS.length && (
        <div className="gaze-dot" style={{
          left: `${GAZE_DOTS[gazeIdx][0] * 100}%`,
          top: `${GAZE_DOTS[gazeIdx][1] * 100}%`,
        }} />
      )}

      <div className="calib-card">
        <div className="calib-steps">
          <Dot on={step !== "environment" || !!summary?.env_passed} label="Environment" active={step === "environment"} />
          <Dot on={!!summary?.enrolled} label="Face enrol" active={step === "enroll"} />
          <Dot on={!!summary?.liveness_passed} label="Liveness" active={step === "liveness"} />
          <Dot on={!!summary?.gaze_ready} label="Gaze" active={step === "gaze"} />
        </div>

        {step === "environment" && (
          <div className="calib-body">
            <h3>Environment check</h3>
            <p className="muted">brightness {cal?.brightness ?? "–"} · faces {cal?.face_count ?? "–"}</p>
            {cal?.issues?.length ? (
              <ul className="issues">
                {cal.issues.map((i) => (
                  <li key={i}>{ISSUE_TEXT[i] ?? (i.startsWith("prohibited_object") ? "Remove: " + i.split(":")[1] : i)}</li>
                ))}
              </ul>
            ) : <p className="ok">Looks good…</p>}
          </div>
        )}

        {step === "enroll" && (
          <div className="calib-body">
            <h3>Face enrolment</h3>
            <p className="muted">Look straight at the camera.</p>
            <p>{cal?.captured ?? 0} / {cal?.need ?? 5} frames</p>
            {!enrollTimer.current && <button className="primary" onClick={startEnroll}>Capture</button>}
          </div>
        )}

        {step === "liveness" && (
          <div className="calib-body">
            <h3>Liveness check</h3>
            <p className="muted">Prove you're really here (defeats photos/videos):</p>
            <p>👁️ Blink <b>{cal?.blinks ?? 0}</b> / {cal?.need_blinks ?? 2}
              &nbsp;·&nbsp; ↩️ Turn left {cal?.turned_left ? "✓" : "–"}
              &nbsp;·&nbsp; ↪️ Turn right {cal?.turned_right ? "✓" : "–"}</p>
            <p className="muted">Blink a couple of times, then slowly turn your head left and right.</p>
          </div>
        )}

        {step === "gaze" && (
          <div className="calib-body">
            <h3>Gaze calibration</h3>
            <p className="muted">Follow the blue dot with your eyes. {gazeIdx}/{GAZE_DOTS.length}</p>
          </div>
        )}

        {step === "done" && (
          <div className="calib-body">
            <h3>Calibration complete</h3>
            <p className="muted">
              Enrolled {summary?.enrolled ? "yes" : "no"} · Gaze {summary?.gaze_ready ? "yes" : "skipped"} · Environment ok
            </p>
            <button className="primary" disabled={!summary?.complete} onClick={onComplete}>
              Begin exam
            </button>
            {!summary?.complete && <p className="muted">Waiting for enrolment + environment…</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ on, active, label }: { on: boolean; active: boolean; label: string }) {
  return (
    <span className={`cstep ${on ? "on" : ""} ${active ? "active" : ""}`}>
      <span className="cbadge" />{label}
    </span>
  );
}
