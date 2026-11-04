import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * A living Transformer block drawn on one canvas:
 *   tokens → embeddings (+ positional encoding) → 4 self-attention heads →
 *   Add & Norm → feed-forward (expand → project) → Add & Norm → contextual outputs,
 * with residual connections arching over each sub-layer.
 *
 * Geometry lives in a (u, v) space: u runs along the data flow, v across it.
 * Wide containers map u → x; narrow ones map u → y, so the same architecture
 * reads top-to-bottom on phones. One timeline drives every stage, so tokens
 * enter, heads attend in sequence, the FFN fires and outputs resolve in order.
 */

const U = 1000
const V = 520
const N = 6 // tokens
const HEADS = 4
const CYCLE = 7.5 // seconds

const TOK_U = 50
const EMB_U0 = 120
const EMB_U1 = 196
const Q_U = 300
const K_U = 462
const NORM1_U = 580
const FFA_U = 662
const FFB_U = 770
const NORM2_U = 856
const OUT_U = 942

const tokV = (i: number) => 130 + i * 52
const headTop = (h: number) => 44 + h * 113
const headV = (h: number, i: number) => headTop(h) + 16 + i * 14
const ffaV = (j: number) => 86 + j * 31

/** deterministic attention weights per head — each head learns a different pattern */
const WEIGHTS: number[][][] = Array.from({ length: HEADS }, (_, h) =>
  Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      if (h === 0) return Math.exp(-Math.abs(i - j) * 1.1) // local context
      if (h === 1) return j === i - 1 || (i === 0 && j === 0) ? 1 : 0.08 // previous token
      if (h === 2) return j === 1 || j === 4 ? 0.9 : 0.1 // anchor tokens
      return j === N - 1 - i ? 1 : Math.abs(i - j) === N - 2 - Math.min(i, j) * 2 ? 0.25 : 0.06 // mirrored long-range
    }),
  ),
)

const STAGES = [
  { u: 118, t: 'Tokens → embeddings' },
  { u: (Q_U + K_U) / 2, t: 'Multi-head self-attention' },
  { u: NORM1_U, t: 'Add & Norm', minor: true },
  { u: (FFA_U + FFB_U) / 2, t: 'Feed forward' },
  { u: NORM2_U, t: 'Add & Norm', minor: true },
  { u: OUT_U, t: 'Output' },
]

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const win = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const bell = (p: number, a: number, b: number) => Math.sin(Math.PI * win(p, a, b))
const ease = (t: number) => t * t * (3 - 2 * t)

type Pt = [number, number]

export function TransformerCanvas() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const [vertical, setVertical] = useState(false)

  useEffect(() => {
    const cv = canvas.current
    const box = wrap.current
    if (!cv || !box) return
    const ctx0 = cv.getContext('2d')
    if (!ctx0) return
    const ctx: CanvasRenderingContext2D = ctx0

    let W = 0
    let H = 0
    let vert = false
    let dpr = 1
    const resize = () => {
      W = box.clientWidth
      vert = W < 560
      setVertical(vert)
      H = vert ? Math.round(((W * 0.75) * U) / V) * 0.95 : Math.round((W * V) / U)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      cv.style.height = `${H}px`
      draw(lastP, lastT)
    }
    // (u, v) → canvas px
    // phones: a left-hand column is kept free for the stage labels
    const LBL = 0.25
    const P = (u: number, v: number): Pt => (vert ? [W * LBL + (v / V) * W * (1 - LBL), (u / U) * H] : [(u / U) * W, (v / V) * H])
    const S = () => (vert ? Math.min((W * (1 - LBL)) / V, H / U) : Math.min(W / U, H / V)) // size scale

    // soft glow sprites, tinted per colour, drawn additively
    const sprite = (rgb: string) => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')!
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grd.addColorStop(0, `rgba(${rgb},1)`)
      grd.addColorStop(0.25, `rgba(${rgb},.55)`)
      grd.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = grd
      g.fillRect(0, 0, 64, 64)
      return c
    }
    const GLOW = { teal: sprite('92,195,190'), cyan: sprite('154,213,229'), gold: sprite('217,178,106'), white: sprite('234,241,244') }
    const glow = (s: HTMLCanvasElement, [x, y]: Pt, r: number, a: number) => {
      if (a <= 0.01) return
      ctx.globalAlpha = Math.min(1, a)
      ctx.drawImage(s, x - r, y - r, r * 2, r * 2)
      ctx.globalAlpha = 1
    }

    const line = (a: Pt, b: Pt, color: string, alpha: number, width = 1) => {
      if (alpha <= 0.004) return
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // cubic in (u, v) space, horizontal tangents along u
    const curve = (u0: number, v0: number, u1: number, v1: number) => {
      const m = (u1 - u0) * 0.5
      return [P(u0, v0), P(u0 + m, v0), P(u1 - m, v1), P(u1, v1)] as const
    }
    const strokeCurve = (c: readonly Pt[], color: string, alpha: number, width = 1) => {
      if (alpha <= 0.004) return
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(c[0][0], c[0][1])
      ctx.bezierCurveTo(c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1])
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    const onCurve = (c: readonly Pt[], t: number): Pt => {
      const m = 1 - t
      const a = m * m * m
      const b = 3 * m * m * t
      const d = 3 * m * t * t
      const e = t * t * t
      return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]]
    }
    const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const node = (p: Pt, r: number, on: number, ring = '#9ad5e5') => {
      ctx.fillStyle = on > 0.05 ? `rgba(29,106,128,${0.55 + on * 0.45})` : '#102a40'
      ctx.strokeStyle = ring
      ctx.globalAlpha = 0.45 + on * 0.55
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.globalAlpha = 1
      if (on > 0.25) {
        ctx.fillStyle = `rgba(234,241,244,${on})`
        ctx.beginPath()
        ctx.arc(p[0], p[1], r * 0.32, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const roundRect = (a: Pt, b: Pt, r: number, fill: string, stroke: string, alpha = 1) => {
      const x = Math.min(a[0], b[0])
      const y = Math.min(a[1], b[1])
      const w = Math.abs(b[0] - a[0])
      const h = Math.abs(b[1] - a[1])
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // precomputed attention curves for each head
    // (pixel positions depend on the current size, so they are built per frame)
    const headCurves = (h: number) =>
      Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => ({ c: curve(Q_U, headV(h, i), K_U, headV(h, j)), w: WEIGHTS[h][i][j] }))).flat()

    let lastP = 0.47
    let lastT = 0
    function draw(p: number, time: number) {
      lastP = p
      lastT = time
      if (!W || !H) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const s = S()
      const still = reduced

      // ── depth planes behind each stage (slight skew for layered depth)
      const plane = (u0: number, u1: number, v0: number, v1: number, a: number) => roundRect(P(u0, v0), P(u1, v1), 10 * s, `rgba(154,213,229,${0.035 * a})`, `rgba(154,213,229,${0.1 * a})`)
      plane(24, 210, 100, 420, 1)
      plane(284, 478, 34, 490, 1.15)
      plane(640, 792, 70, 450, 1)
      plane(918, 966, 100, 420, 1)

      // ── stage activations along the timeline
      const A = {
        tok: (i: number) => (still ? 0.6 : bell(p, 0.0 + i * 0.016, 0.17 + i * 0.016)),
        emb: still ? 0.5 : bell(p, 0.08, 0.3),
        head: (h: number) => (still ? 0.55 : bell(p, 0.24 + h * 0.065, 0.44 + h * 0.065)),
        merge: still ? 0.5 : bell(p, 0.5, 0.66),
        ffa: (j: number) => (still ? 0.45 : bell(p, 0.6 + j * 0.005, 0.76 + j * 0.005)),
        ffb: still ? 0.45 : bell(p, 0.68, 0.84),
        norm2: still ? 0.4 : bell(p, 0.78, 0.9),
        out: (i: number) => (still ? 0.65 : bell(p, 0.84 + i * 0.012, 0.995)),
      }

      // ── residual connections (saffron-gold, restrained)
      const res1 = [P(EMB_U1 + 8, 100), P(EMB_U1 + 90, 6), P(NORM1_U - 90, 6), P(NORM1_U, 100)] as const
      const res2 = [P(NORM1_U + 8, 100), P(NORM1_U + 80, 26), P(NORM2_U - 80, 26), P(NORM2_U, 100)] as const
      ctx.setLineDash([3 * s * 2, 5 * s * 2])
      strokeCurve(res1, '#d9b26a', 0.32, 1.1)
      strokeCurve(res2, '#d9b26a', 0.32, 1.1)
      ctx.setLineDash([])

      // ── tokens and their entry
      for (let i = 0; i < N; i++) {
        const a = A.tok(i)
        const c = P(TOK_U, tokV(i))
        if (!still) {
          const t = ease(win(p, 0.0 + i * 0.016, 0.1 + i * 0.016))
          if (t > 0 && t < 1) glow(GLOW.cyan, P(TOK_U - 60 + 60 * t, tokV(i)), 9 * s, 0.9)
        }
        roundRect(P(TOK_U - 18, tokV(i) - 13), P(TOK_U + 18, tokV(i) + 13), 5 * s, `rgba(16,42,64,1)`, `rgba(154,213,229,${0.35 + a * 0.6})`)
        // compact token vector: 4 bars
        for (let k = 0; k < 4; k++) {
          const h = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.9 + k * 1.3))
          const x0 = TOK_U - 11 + k * 6
          line(P(x0, tokV(i) + 7), P(x0, tokV(i) + 7 - 13 * h), a > 0.3 ? '#5cc3be' : '#9ad5e5', 0.5 + a * 0.5, 2.2 * s * 1.6)
        }
        glow(GLOW.teal, c, 26 * s, a * 0.35)
        // token → embedding
        line(P(TOK_U + 18, tokV(i)), P(EMB_U0 - 4, tokV(i)), '#9ad5e5', 0.18 + A.emb * 0.4)
      }

      // ── embeddings with sinusoidal positional encoding
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 8; k++) {
          const pe = 0.5 + 0.5 * Math.sin(i / Math.pow(3, k / 2) + (k % 2 ? Math.PI / 2 : 0)) // position signal
          const live = still ? 0 : 0.35 * A.emb * Math.abs(Math.sin(i * 1.7 + k * 0.9 + time * 2.4))
          const a = 0.18 + pe * 0.45 + live
          const u0 = EMB_U0 + k * 9.6
          roundRect(P(u0, tokV(i) - 7), P(u0 + 7.4, tokV(i) + 7), 1.5 * s, k % 3 === 0 ? `rgba(217,178,106,${a * 0.9})` : `rgba(92,195,190,${a})`, 'rgba(0,0,0,0)')
        }
      }

      // ── embeddings → every head's query nodes (fan-out)
      for (let h = 0; h < HEADS; h++) {
        for (let i = 0; i < N; i++) {
          const a = 0.08 + A.emb * 0.14 + A.head(h) * 0.2
          strokeCurve(curve(EMB_U1 + 2, tokV(i), Q_U - 6, headV(h, i)), '#9ad5e5', a, 0.8)
          if (!still) {
            const t = win(p, 0.16 + h * 0.03, 0.3 + h * 0.03)
            if (t > 0 && t < 1 && i % 2 === h % 2) glow(GLOW.cyan, onCurve(curve(EMB_U1 + 2, tokV(i), Q_U - 6, headV(h, i)), ease(t)), 6 * s, 0.85)
          }
        }
      }

      // ── multi-head self-attention: a woven lattice per head
      for (let h = 0; h < HEADS; h++) {
        const act = A.head(h)
        const top = headTop(h)
        roundRect(P(Q_U - 14, top + 4), P(K_U + 14, top + 98), 8 * s, `rgba(11,32,52,${0.35 + act * 0.25})`, `rgba(154,213,229,${0.12 + act * 0.35})`)
        const accent = h === 2 ? '#d9b26a' : '#5cc3be'
        const hc = headCurves(h)
        for (const { c, w } of hc) {
          strokeCurve(c, '#9ad5e5', 0.08 + w * 0.18, 0.8) // faint full lattice
          if (act > 0.02 && w > 0.2) strokeCurve(c, accent, act * w * 0.95, 0.8 + w * 1.7)
        }
        // signals ride the strongest attention links while the head is active
        if (!still && act > 0.05) {
          const t = ease(win(p, 0.26 + h * 0.065, 0.42 + h * 0.065))
          hc.forEach(({ c, w }, n) => {
            if (w > 0.55 && n % 2 === 0) glow(h === 2 ? GLOW.gold : GLOW.white, onCurve(c, t), 7 * s, act)
          })
        }
        for (let i = 0; i < N; i++) {
          node(P(Q_U, headV(h, i)), 4.2 * s * 1.3, act * (0.4 + 0.6 * Math.abs(Math.sin(i + h))))
          node(P(K_U, headV(h, i)), 4.2 * s * 1.3, act * WEIGHTS[h][N - 1 - i].reduce((m, x) => Math.max(m, x), 0))
        }
        // head label
        ctx.fillStyle = `rgba(142,168,184,${0.6 + act * 0.4})`
        ctx.font = `${Math.max(9, 10.5 * s * 1.25)}px "IBM Plex Mono", monospace`
        ctx.textAlign = 'left'
        const lp = P(Q_U - 8, top + 12)
        if (!vert) ctx.fillText(`H${h + 1}`, lp[0], lp[1] - 2)
      }

      // ── heads concatenate into Add & Norm
      const normBar = (u: number, a: number) => {
        roundRect(P(u - 5, 104), P(u + 5, 416), 4 * s, `rgba(217,178,106,${0.15 + a * 0.4})`, `rgba(217,178,106,${0.45 + a * 0.5})`)
        for (let k = 0; k < 9; k++) line(P(u - 5, 120 + k * 35), P(u + 5, 120 + k * 35), '#d9b26a', 0.35 + a * 0.4)
        glow(GLOW.gold, P(u, 260), 70 * s, a * 0.45)
      }
      for (let h = 0; h < HEADS; h++)
        for (let i = 0; i < N; i++) strokeCurve(curve(K_U + 6, headV(h, i), NORM1_U - 6, tokV(i)), '#5cc3be', 0.07 + A.merge * 0.25, 0.8)
      normBar(NORM1_U, A.merge)
      if (!still) {
        const t = ease(win(p, 0.36, 0.62))
        if (t > 0 && t < 1) glow(GLOW.gold, onCurve(res1, t), 9 * s, 0.95)
        const t2 = ease(win(p, 0.62, 0.84))
        if (t2 > 0 && t2 < 1) glow(GLOW.gold, onCurve(res2, t2), 9 * s, 0.95)
      }

      // ── feed-forward: expand (12) → project (6), dense but ordered
      for (let i = 0; i < N; i++)
        for (let j = 0; j < 12; j++) {
          const a = 0.075 + A.ffa(j) * 0.22 * (1 - Math.abs(i * 2 - j) / 12)
          line(P(NORM1_U + 6, tokV(i)), P(FFA_U, ffaV(j)), '#9ad5e5', a, 0.7)
        }
      for (let j = 0; j < 12; j++)
        for (let i = 0; i < N; i++) {
          const a = 0.075 + A.ffb * 0.24 * (1 - Math.abs(i * 2 - j) / 12)
          line(P(FFA_U, ffaV(j)), P(FFB_U, tokV(i)), '#9ad5e5', a, 0.7)
        }
      if (!still) {
        const t = ease(win(p, 0.6, 0.72))
        const t2 = ease(win(p, 0.69, 0.81))
        for (let i = 0; i < N; i++) {
          if (t > 0 && t < 1) glow(GLOW.teal, lerpPt(P(NORM1_U + 6, tokV(i)), P(FFA_U, ffaV(i * 2 + 1)), t), 6 * s, 0.9)
          if (t2 > 0 && t2 < 1) glow(GLOW.teal, lerpPt(P(FFA_U, ffaV(i * 2)), P(FFB_U, tokV(i)), t2), 6 * s, 0.9)
        }
      }
      for (let j = 0; j < 12; j++) node(P(FFA_U, ffaV(j)), 4.4 * s * 1.3, A.ffa(j))
      for (let i = 0; i < N; i++) node(P(FFB_U, tokV(i)), 5.4 * s * 1.3, A.ffb)

      // ── second Add & Norm and contextual outputs
      for (let i = 0; i < N; i++) line(P(FFB_U + 6, tokV(i)), P(NORM2_U - 6, tokV(i)), '#5cc3be', 0.08 + A.norm2 * 0.4, 0.9)
      normBar(NORM2_U, A.norm2)
      for (let i = 0; i < N; i++) {
        const a = A.out(i)
        line(P(NORM2_U + 6, tokV(i)), P(OUT_U - 20, tokV(i)), '#5cc3be', 0.1 + a * 0.6, 1)
        roundRect(P(OUT_U - 20, tokV(i) - 13), P(OUT_U + 20, tokV(i) + 13), 5 * s, `rgba(${a > 0.3 ? '29,106,128' : '16,42,64'},1)`, `rgba(154,213,229,${0.35 + a * 0.6})`)
        for (let k = 0; k < 4; k++) {
          const hgt = 0.3 + 0.7 * Math.abs(Math.cos(i * 1.3 + k * 1.7))
          const x0 = OUT_U - 12 + k * 7
          line(P(x0, tokV(i) + 7), P(x0, tokV(i) + 7 - 13 * hgt), a > 0.3 ? '#eaf1f4' : '#5cc3be', 0.45 + a * 0.55, 2.4 * s * 1.6)
        }
        glow(GLOW.teal, P(OUT_U, tokV(i)), 30 * s, a * 0.5)
      }
    }

    let raf = 0
    let visible = false
    let t0 = performance.now()
    const loop = (now: number) => {
      const time = (now - t0) / 1000
      draw((time % CYCLE) / CYCLE, time)
      if (visible) raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible && !reduced) {
        t0 = performance.now() - lastT * 1000
        raf = requestAnimationFrame(loop)
      } else draw(lastP, lastT)
    })
    const ro = new ResizeObserver(resize)
    ro.observe(box)
    io.observe(cv)
    resize()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [reduced])

  return (
    <div ref={wrap} className="relative w-full">
      <canvas ref={canvas} className="block w-full" role="img" aria-label="Animated illustration of a Transformer block: tokens become embeddings, pass through four self-attention heads and a feed-forward layer with residual connections, and come out as contextual representations." />
      {/* stage labels in HTML so they stay readable at any size */}
      <ol aria-hidden="true" className={vertical ? 'pointer-events-none absolute inset-y-0 left-0 w-[23%]' : 'pointer-events-none mt-2 h-5 w-full sm:relative'}>
        {STAGES.map((st) => (
          <li
            key={`${st.t}-${st.u}`}
            className={`absolute whitespace-nowrap font-mono text-[10px] leading-tight tracking-[0.06em] sm:text-[10.5px] ${st.minor ? 'text-sandstone' : 'text-muted'} ${st.minor && !vertical ? 'hidden lg:block' : ''}`}
            style={vertical ? { top: `${(st.u / U) * 100}%`, left: 0, transform: 'translateY(-50%)', whiteSpace: 'normal', width: '100%' } : { left: `${(st.u / U) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {st.t}
          </li>
        ))}
      </ol>
    </div>
  )
}
