import * as THREE from 'three'
import { applyTilt, canvasTex, createStage, labelTex, radialTex } from './stage3d'

/**
 * AI Workflow Studio as a physical installation: a floating dark canvas
 * slab carrying function-specific 3D nodes linked by connector tubes.
 *
 *   Trigger   — champagne puck with a bolt
 *   Agent     — teal module with an orbiting halo
 *   Knowledge — stacked index discs
 *   Database  — cylinder stack
 *   LLM       — ice hexagonal prism with glowing core
 *   Condition — amber diamond
 *   Approval  — coral shield block with a gate ring
 *   Action    — wedge "send" block
 *
 * An execution run steps through the graph (node rings light, pulses flow).
 * Scroll: canvas → connectors → nodes separate in layers, the run path
 * highlights, then everything settles back.
 */
export function createWorkflowScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const S = createStage(canvas, { reducedMotion: opts.reducedMotion, dist: [19, 21.5], target: [0.35, 0.5, 0], dolly: 0.28 })
  const { root, track, rbox, phys } = S

  // ── materials ─────────────────────────────────────
  const boardMat = phys({ map: track(boardTexture()), color: '#ffffff', metalness: 0.35, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3 })
  const boardSide = phys({ color: '#0b2034', metalness: 0.5, roughness: 0.35 })
  const plinthMat = phys({ color: '#e9f0f2', roughness: 0.32, clearcoat: 0.8 })
  const darkMetal = phys({ color: '#15334c', metalness: 0.75, roughness: 0.28, clearcoat: 1 })
  const tubeMat = phys({ color: '#6f8ea3', metalness: 0.8, roughness: 0.3 })
  const tubeHot = phys({ color: '#5cc3be', emissive: '#5cc3be', emissiveIntensity: 0, metalness: 0.4, roughness: 0.3 })
  const champ = phys({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  const teal = phys({ color: '#38a6a2', metalness: 0.35, roughness: 0.25, clearcoat: 1 })
  const ice = phys({ color: '#9ad5e5', metalness: 0.1, roughness: 0.08, transmission: 0.55, thickness: 0.6, transparent: true, opacity: 0.92, clearcoat: 1 })
  const navyBlue = phys({ color: '#2c64a0', metalness: 0.4, roughness: 0.3, clearcoat: 1 })
  const amber = phys({ color: '#e2a86b', metalness: 0.5, roughness: 0.25, clearcoat: 1 })
  const coral = phys({ color: '#c97a5d', metalness: 0.3, roughness: 0.3, clearcoat: 1 })
  const white = phys({ color: '#f4f8f9', roughness: 0.3, clearcoat: 1 })
  const glow = (c: string) => phys({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.3 })

  // ── layers that separate on scroll ────────────────────
  const L = { board: new THREE.Group(), links: new THREE.Group(), nodes: new THREE.Group(), ui: new THREE.Group() }
  Object.values(L).forEach((g) => root.add(g))

  // floating canvas slab
  const BW = 8.4
  const BD = 4.6
  const board = new THREE.Mesh(rbox(BW, 0.16, BD, 0.08, 4), [boardSide, boardSide, boardMat, boardSide, boardSide, boardSide])
  L.board.add(board)
  const edge = new THREE.Mesh(rbox(BW + 0.06, 0.03, BD + 0.06, 0.04), champ)
  edge.position.y = -0.09
  L.board.add(edge)
  // under-glow + contact shadow
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(10, 6)), track(new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(11,32,52,0.45)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.1
  root.add(shadow)

  // ── nodes ─────────────────────────────────────────
  type N = { id: string; label: string; sub: string; x: number; z: number; color: string; build: (g: THREE.Group) => void }
  const NODES: N[] = [
    { id: 't', label: 'Trigger', sub: 'Webhook', x: -3.4, z: 0.1, color: '#d5b68a', build: buildTrigger },
    { id: 'a', label: 'Agent', sub: 'Intent detection', x: -1.95, z: 0.1, color: '#38a6a2', build: buildAgent },
    { id: 'k', label: 'Knowledge', sub: 'RAG retrieval', x: -0.45, z: -1.15, color: '#2c64a0', build: buildKnowledge },
    { id: 'd', label: 'Database', sub: 'Order history', x: -0.45, z: 1.3, color: '#4b8a5c', build: buildDatabase },
    { id: 'l', label: 'LLM', sub: 'Routed model', x: 1.05, z: 0.1, color: '#9ad5e5', build: buildLLM },
    { id: 'c', label: 'Condition', sub: 'Needs approval?', x: 2.35, z: 0.1, color: '#e2a86b', build: buildCondition },
    { id: 'h', label: 'Approval', sub: 'Human in loop', x: 3.45, z: -1.2, color: '#c97a5d', build: buildApproval },
    { id: 'o', label: 'Action', sub: 'Send reply', x: 3.45, z: 1.35, color: '#f4f8f9', build: buildAction },
  ]
  const EDGES: [string, string][] = [
    ['t', 'a'],
    ['a', 'k'],
    ['a', 'd'],
    ['k', 'l'],
    ['d', 'l'],
    ['l', 'c'],
    ['c', 'h'],
    ['c', 'o'],
    ['h', 'o'],
  ]
  // execution order (waves)
  const RUN = [['t'], ['a'], ['k', 'd'], ['l'], ['c'], ['h'], ['o']]

  const nodeMap = new Map<string, { g: THREE.Group; ring: THREE.Mesh; ringMat: THREE.MeshPhysicalMaterial; label: THREE.Sprite; inner: THREE.Group; n: N }>()
  const ringGeo = track(new THREE.TorusGeometry(0.52, 0.025, 10, 64))
  const plinthGeo = rbox(0.95, 0.1, 0.95, 0.12, 4)

  NODES.forEach((n, i) => {
    const g = new THREE.Group()
    g.position.set(n.x, 0.08, n.z)
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.position.y = 0.05
    g.add(plinth)
    const ringMat = phys({ color: n.color, emissive: n.color, emissiveIntensity: 0, transparent: true, opacity: 0.25 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.12
    g.add(ring)
    const inner = new THREE.Group()
    inner.position.y = 0.1
    n.build(inner)
    g.add(inner)
    const label = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex(n.label, n.sub, n.color === '#f4f8f9' ? '#5d7083' : n.color)), transparent: true, depthWrite: false })))
    label.scale.set(1.95, 0.61, 1)
    label.position.y = 1.0
    label.center.set(0.5, 0)
    g.add(label)
    L.nodes.add(g)
    nodeMap.set(n.id, { g, ring, ringMat, label, inner, n })
    g.userData.phase = i * 0.7
  })

  // ── connectors ────────────────────────────────────
  const links = EDGES.map(([a, b]) => {
    const A = nodeMap.get(a)!.n
    const B = nodeMap.get(b)!.n
    const p0 = new THREE.Vector3(A.x + 0.48, 0.2, A.z)
    const p3 = new THREE.Vector3(B.x - 0.48, 0.2, B.z)
    const mx = (p0.x + p3.x) / 2
    const curve = new THREE.CubicBezierCurve3(p0, new THREE.Vector3(mx, 0.45, A.z), new THREE.Vector3(mx, 0.45, B.z), p3)
    const mat = tubeMat.clone()
    track(mat)
    const tube = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 48, 0.026, 8, false)), mat)
    L.links.add(tube)
    const pulse = new THREE.Mesh(track(new THREE.SphereGeometry(0.065, 14, 14)), glow('#bff3ff'))
    pulse.visible = false
    L.links.add(pulse)
    return { a, b, curve, mat, pulse }
  })

  // ── floating run console (glass panel) ─────────────────
  const consoleTex = track(consoleTexture())
  const panel = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.3, 1.15)),
    phys({ map: consoleTex, transparent: true, opacity: 0.96, roughness: 0.15, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide }),
  )
  panel.position.set(-1.2, 2.1, -2.6)
  panel.rotation.y = -0.42
  L.ui.add(panel)
  const panelFrame = new THREE.Mesh(rbox(2.38, 1.23, 0.04, 0.06), darkMetal)
  panelFrame.position.copy(panel.position).add(new THREE.Vector3(0.012, 0, -0.03))
  panelFrame.rotation.copy(panel.rotation)
  L.ui.add(panelFrame)

  // ── animation ─────────────────────────────────────
  const tmp = new THREE.Vector3()
  const STEP = 0.75
  S.setFrame((s) => {
    applyTilt(root, s, 0.42)

    L.board.position.y = -0.55 * s.e
    L.links.position.y = 0.15 * s.e
    L.nodes.position.y = 0.75 * s.e
    L.ui.position.y = 1.05 * s.e
    shadow.scale.setScalar(1 - s.e * 0.08)

    // parallax per layer
    L.nodes.position.x = s.px * 0.12
    L.ui.position.x = s.px * 0.2
    L.ui.position.z = s.py * 0.12

    // execution run (stepping through waves); during highlight the whole path lights
    const cycle = RUN.length + 2
    const tt = s.reduced ? RUN.length - 1 : (s.time / STEP) % cycle
    const wave = Math.floor(tt)
    const frac = tt - wave
    const doneSet = new Set<string>()
    const activeSet = new Set<string>()
    RUN.forEach((ids, w) => ids.forEach((id) => (w < wave ? doneSet.add(id) : w === wave ? activeSet.add(id) : null)))

    nodeMap.forEach(({ g, ring, ringMat, inner }, id) => {
      const active = activeSet.has(id)
      const done = doneSet.has(id) || s.hl > 0.5
      ringMat.emissiveIntensity = active ? 2.2 : done ? 0.9 : 0.15
      ringMat.opacity = active ? 1 : done ? 0.75 : 0.25
      ring.scale.setScalar(active ? 1 + Math.sin(frac * Math.PI) * 0.12 : 1)
      const lift = active ? 0.12 : 0
      g.position.y += (0.08 + lift + (s.reduced ? 0 : Math.sin(s.time * 1.1 + g.userData.phase) * 0.025) - g.position.y) * Math.min(1, s.dt * 8 || 1)
      inner.rotation.y += s.reduced ? 0 : s.dt * (active ? 1.2 : 0.18)
    })

    links.forEach((lk) => {
      const srcDone = doneSet.has(lk.a) || activeSet.has(lk.a)
      const firing = activeSet.has(lk.b) || (doneSet.has(lk.a) && activeSet.has(lk.b))
      const lit = s.hl > 0.3 || (doneSet.has(lk.a) && (doneSet.has(lk.b) || activeSet.has(lk.b)))
      lk.mat.color.set(lit ? '#5cc3be' : '#6f8ea3')
      lk.mat.emissive.set('#38a6a2')
      lk.mat.emissiveIntensity = lit ? 0.6 + s.hl * 0.8 : 0
      lk.pulse.visible = (firing && srcDone && !s.reduced) || s.hl > 0.3
      if (lk.pulse.visible) {
        const u = s.hl > 0.3 ? (s.time * 0.6 + lk.curve.v0.x * 0.05) % 1 : frac
        lk.curve.getPoint(u, tmp)
        lk.pulse.position.copy(tmp)
      }
    })
    tubeHot.emissiveIntensity = s.hl
    panel.rotation.y = -0.42 + s.px * 0.08
    panelFrame.rotation.y = panel.rotation.y
  })

  return S.api

  /* ── node builders ───────────────────────────────── */
  function buildTrigger(g: THREE.Group) {
    const puck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.38, 0.22, 48)), champ)
    puck.position.y = 0.12
    g.add(puck)
    const bolt = new THREE.Shape()
    bolt.moveTo(0.05, 0.22)
    bolt.lineTo(-0.12, -0.02)
    bolt.lineTo(0, -0.02)
    bolt.lineTo(-0.06, -0.22)
    bolt.lineTo(0.13, 0.04)
    bolt.lineTo(0.01, 0.04)
    bolt.closePath()
    const b = new THREE.Mesh(track(new THREE.ExtrudeGeometry(bolt, { depth: 0.05, bevelEnabled: false })), darkMetal)
    b.rotation.x = -Math.PI / 2
    b.position.y = 0.24
    g.add(b)
  }
  function buildAgent(g: THREE.Group) {
    const body = new THREE.Mesh(rbox(0.58, 0.46, 0.58, 0.12, 4), teal)
    body.position.y = 0.26
    g.add(body)
    const eye = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 24, 24)), glow('#d8fbf7'))
    eye.position.y = 0.55
    g.add(eye)
    const halo = new THREE.Mesh(track(new THREE.TorusGeometry(0.42, 0.018, 8, 64)), champ)
    halo.rotation.x = Math.PI / 2.4
    halo.position.y = 0.38
    g.add(halo)
  }
  function buildKnowledge(g: THREE.Group) {
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(rbox(0.6 - i * 0.04, 0.07, 0.42 - i * 0.02, 0.03), i % 2 ? white : navyBlue)
      d.position.set(0, 0.1 + i * 0.1, 0)
      d.rotation.y = i * 0.12
      g.add(d)
    }
    const lens = new THREE.Mesh(track(new THREE.TorusGeometry(0.13, 0.03, 10, 32)), champ)
    lens.position.set(0.18, 0.56, 0.05)
    lens.rotation.x = -0.6
    g.add(lens)
  }
  function buildDatabase(g: THREE.Group) {
    const mat = phys({ color: '#4b8a5c', metalness: 0.4, roughness: 0.3, clearcoat: 1 })
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(track(new THREE.CylinderGeometry(0.3, 0.3, 0.13, 40)), i === 2 ? white : mat)
      c.position.y = 0.1 + i * 0.16
      g.add(c)
      const band = new THREE.Mesh(track(new THREE.TorusGeometry(0.3, 0.012, 6, 48)), champ)
      band.rotation.x = Math.PI / 2
      band.position.y = 0.17 + i * 0.16
      g.add(band)
    }
  }
  function buildLLM(g: THREE.Group) {
    const prism = new THREE.Mesh(track(new THREE.CylinderGeometry(0.36, 0.36, 0.55, 6)), ice)
    prism.position.y = 0.3
    g.add(prism)
    const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.14, 1)), glow('#5cc3be'))
    core.position.y = 0.3
    g.add(core)
    const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 6)), darkMetal)
    cap.position.y = 0.6
    g.add(cap)
  }
  function buildCondition(g: THREE.Group) {
    const dia = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.34, 0)), amber)
    dia.scale.set(1, 1.15, 1)
    dia.position.y = 0.45
    g.add(dia)
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.2, 0.12, 24)), darkMetal)
    base.position.y = 0.08
    g.add(base)
  }
  function buildApproval(g: THREE.Group) {
    const s = new THREE.Shape()
    s.moveTo(0, 0.32)
    s.quadraticCurveTo(0.24, 0.3, 0.28, 0.22)
    s.lineTo(0.26, -0.02)
    s.quadraticCurveTo(0.2, -0.24, 0, -0.34)
    s.quadraticCurveTo(-0.2, -0.24, -0.26, -0.02)
    s.lineTo(-0.28, 0.22)
    s.quadraticCurveTo(-0.24, 0.3, 0, 0.32)
    const shield = new THREE.Mesh(track(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 })), coral)
    shield.position.set(0, 0.45, -0.07)
    g.add(shield)
    const gate = new THREE.Mesh(track(new THREE.TorusGeometry(0.42, 0.02, 8, 48, Math.PI)), champ)
    gate.position.y = 0.12
    g.add(gate)
  }
  function buildAction(g: THREE.Group) {
    const s = new THREE.Shape()
    s.moveTo(-0.3, -0.22)
    s.lineTo(0.12, -0.22)
    s.lineTo(0.34, 0)
    s.lineTo(0.12, 0.22)
    s.lineTo(-0.3, 0.22)
    s.closePath()
    const w = new THREE.Mesh(track(new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 })), white)
    w.rotation.x = -Math.PI / 2
    w.position.y = 0.1
    g.add(w)
    const stripe = new THREE.Mesh(rbox(0.3, 0.02, 0.06, 0.01), teal)
    stripe.position.set(-0.05, 0.4, 0)
    g.add(stripe)
  }
}

function boardTexture() {
  return canvasTex(1024, 560, (g) => {
    const grd = g.createLinearGradient(0, 0, 1024, 560)
    grd.addColorStop(0, '#16374f')
    grd.addColorStop(1, '#0d2438')
    g.fillStyle = grd
    g.fillRect(0, 0, 1024, 560)
    g.fillStyle = 'rgba(154,213,229,.16)'
    for (let x = 16; x < 1024; x += 26) for (let y = 16; y < 560; y += 26) g.fillRect(x, y, 2, 2)
    g.strokeStyle = 'rgba(154,213,229,.12)'
    g.lineWidth = 2
    g.strokeRect(10, 10, 1004, 540)
  })
}

function consoleTexture() {
  return canvasTex(640, 320, (g) => {
    g.fillStyle = 'rgba(12,32,50,0.92)'
    g.beginPath()
    g.roundRect(0, 0, 640, 320, 26)
    g.fill()
    g.fillStyle = '#9ad5e5'
    g.font = '700 26px Manrope, sans-serif'
    g.fillText('Execution history', 28, 48)
    g.fillStyle = '#5cc3be'
    g.beginPath()
    g.arc(600, 40, 8, 0, Math.PI * 2)
    g.fill()
    const rows = [
      ['0.6s', 'Message received', '#8cc39b'],
      ['1.4s', 'Intent: billing · high', '#8cc39b'],
      ['2.3s', '3 passages retrieved', '#8cc39b'],
      ['3.1s', 'Draft reply prepared', '#8cc39b'],
      ['3.9s', 'Awaiting approval…', '#e9c27a'],
    ]
    g.font = '500 22px "IBM Plex Mono", monospace'
    rows.forEach(([t, txt, c], i) => {
      const y = 98 + i * 44
      g.fillStyle = '#6a879a'
      g.fillText(t, 28, y)
      g.fillStyle = c
      g.beginPath()
      g.arc(112, y - 7, 6, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#dfe9ee'
      g.font = '500 23px Manrope, sans-serif'
      g.fillText(txt, 132, y)
      g.font = '500 22px "IBM Plex Mono", monospace'
    })
  })
}
