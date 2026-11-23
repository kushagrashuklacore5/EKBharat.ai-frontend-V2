import { useState, ReactNode } from "react";

// DPDP (India) consent gate — redesigned onboarding, shown before the camera starts.
export function ConsentScreen({
  onAccept, mirrored, setMirrored,
}: {
  onAccept: () => void;
  mirrored: boolean;
  setMirrored: (v: boolean) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="c2">
      <div className="c2-head">
        <span className="c2-badge">Secure exam</span>
        <h2>Before you begin</h2>
        <p>
          This session is watched by an AI assistant that only <b>flags</b> events.
          A human proctor makes every final decision.
        </p>
      </div>

      <div className="c2-label">While the exam is active</div>
      <div className="c2-grid">
        <Item accent="blue" icon={Cam} title="Webcam"
          desc="Face, eyes, head & body movement, and objects — live." />
        <Item accent="violet" icon={Mic} title="Microphone"
          desc="Voice-activity only (is someone talking). Not stored." />
        <Item accent="green" icon={Id} title="Face match"
          desc="An encrypted template confirms it's you throughout." />
        <Item accent="amber" icon={Browser} title="Browser"
          desc="Tab/focus, fullscreen, copy-paste, 2nd monitor, devtools." />
      </div>

      <div className="c2-privacy">
        <Shield />
        <span>
          No continuous video — only <b>flagged snapshots</b> + numbers, encrypted and
          auto-deleted in 30 days. The exam runs in fullscreen (kiosk) mode.
        </span>
      </div>

      <div className="c2-footer">
        <label className="c2-switch">
          <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} />
          <span className="c2-track"><span className="c2-knob" /></span>
          Mirror my preview
        </label>

        <label className="c2-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="c2-box" />
          I understand and consent to monitoring for this exam.
        </label>

        <button className="c2-cta" disabled={!agreed} onClick={onAccept}>
          Enable camera &amp; start calibration <span className="c2-arrow">→</span>
        </button>
      </div>
    </div>
  );
}

function Item({ icon, title, desc, accent }:
  { icon: () => ReactNode; title: string; desc: string; accent: string }) {
  return (
    <div className="c2-item">
      <span className={`c2-ic ${accent}`}>{icon()}</span>
      <div>
        <div className="c2-it-title">{title}</div>
        <div className="c2-it-desc">{desc}</div>
      </div>
    </div>
  );
}

/* --- inline icons (stroke = currentColor) --- */
const svg = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Cam = () => svg(<><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></>);
const Mic = () => svg(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></>);
const Id = () => svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.2" /><path d="M5.5 16c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5M15 9h4M15 13h3" /></>);
const Browser = () => svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M9.5 6.5h.01" /></>);
const Shield = () => svg(<><path d="M12 2l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V5l8-3z" /><path d="M9 12l2 2 4-4" /></>);
