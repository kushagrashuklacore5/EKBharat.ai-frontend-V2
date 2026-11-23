// Microphone voice-activity detection (VAD) + "second voice" logic.
//
// Energy-based VAD on the mic stream (Web Audio). To tell the student talking from
// SOMEONE ELSE talking, we correlate voice activity with the student's mouth motion
// (MAR, fed in from the proctoring results): voice + mouth moving => "voice_active"
// (the student talks), voice + mouth still => "second_voice" (another person).
//
// Emits throttled event strings the backend IntegrityMonitor understands.

export class AudioMonitor {
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private buf?: Float32Array;
  private timer = 0;
  private rmsHist: number[] = [];
  private marHist: number[] = [];
  private noiseFloor = 0.015;
  private calibN = 0;
  private lastEmit = 0;

  constructor(
    private stream: MediaStream,
    private onEvent: (e: string) => void
  ) {}

  start() {
    const track = this.stream.getAudioTracks()[0];
    if (!track) return; // no mic -> VAD disabled silently
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    src.connect(this.analyser);
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  /** Feed the latest mouth-aspect-ratio from proctoring results. */
  feedMar(mar: number | null | undefined) {
    this.marHist.push(mar ?? 0);
    if (this.marHist.length > 12) this.marHist.shift(); // ~1.2s at the result rate
  }

  private rms(): number {
    if (!this.analyser || !this.buf) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    return Math.sqrt(s / this.buf.length);
  }

  private tick() {
    const r = this.rms();
    // auto-calibrate the noise floor over the first ~2s of (assumed quiet) audio
    if (this.calibN < 20) {
      this.noiseFloor = (this.noiseFloor * this.calibN + r) / (this.calibN + 1);
      this.calibN++;
      return;
    }
    this.rmsHist.push(r);
    if (this.rmsHist.length > 10) this.rmsHist.shift(); // ~1s window

    const thresh = Math.max(this.noiseFloor * 3, 0.02);
    const voiceFrac = this.rmsHist.filter((x) => x > thresh).length / this.rmsHist.length;
    const voiceActive = voiceFrac > 0.35;

    // mouth motion = variance of recent MAR
    const m = this.marHist;
    const mean = m.reduce((a, b) => a + b, 0) / Math.max(m.length, 1);
    const varMar = m.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(m.length, 1);
    const mouthMoving = varMar > 0.0008 || mean > 0.35;

    const now = performance.now();
    if (voiceActive && now - this.lastEmit > 900) {
      this.lastEmit = now;
      this.onEvent(mouthMoving ? "voice_active" : "second_voice");
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    this.ctx?.close().catch(() => {});
  }
}
