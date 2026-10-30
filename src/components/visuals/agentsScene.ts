import * as THREE from 'three'
import { applyTilt, createStage, labelTex, radialTex } from './stage3d'

/**
 * Multi-agent system as an installation:
 *  - orchestrator: a stepped tower with a glass crown, glowing core and
 *    rotating task ring
 *  - five specialist agents on hex pads, each a distinct object:
 *      Research (lens) · Analysis (bar chart) · Verify (check shield)
 *      Tools (gear) · Report (document stack)
 *  - delegation arcs from the orchestrator crown to each agent, with a task
 *    pulse that visits agents in turn (agent LED + pad light up)
 *  - a shared-context ring at the base carrying memory tokens
 * Scroll: platform drops, agents move outward and rise, crown separates,
 * every channel lights (architecture reveal), then everything settles.
 */
export function createAgentsScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const S = createStage(canvas, { reducedMotion: opts.reducedMotion, dist: [17.5, 17], target: [0, 0.95, 0], dolly: 0.3 })
  const { root, track, rbox, phys } = S

  const ceramic = phys({ color: '#eef3f5', roughness: 0.3, clearcoat: 0.9 })
  const navy = phys({ color: '#15334c', metalness: 0.7, roughness: 0.25, clearcoat: 1 })
  const petrol = phys({ color: '#1f5a70', metalness: 0.55, roughness: 0.28, clearcoat: 1 })
  const champ = phys({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  const glass = phys({ color: '#bfe8ef', transmission: 0.7, thickness: 0.8, roughness: 0.06, transparent: true, opacity: 0.9, clearcoat: 1 })
  const glowM = (c: string, i = 1.5) => phys({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 })

  const G = { base: new THREE.Group(), memory: new THREE.Group(), orch: new THREE.Group(), crown: new THREE.Group(), agents: new THREE.Group(), links: new THREE.Group() }
  Object.values(G).forEach((g) => root.add(g))

  // ── platform ──────────────────────────────────────
  const plat = new THREE.Mesh(track(new THREE.CylinderGeometry(3.35, 3.5, 0.2, 96)), ceramic)
  plat.position.y = -0.11
  G.base.add(plat)
  const platRim = new THREE.Mesh(track(new THREE.TorusGeometry(3.42, 0.025, 10, 160)), champ)
  platRim.rotation.x = Math.PI / 2
  platRim.position.y = -0.01
  G.base.add(platRim)
  const inlay = new THREE.Mesh(track(new THREE.RingGeometry(1.25, 3.15, 96)), phys({ color: '#d7e3e8', roughness: 0.5 }))
  inlay.rotation.x = -Math.PI / 2
  inlay.position.y = 0.006
  G.base.add(inlay)
  // radial guide lines
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const l = new THREE.Mesh(track(new THREE.BoxGeometry(i % 6 === 0 ? 0.5 : 0.25, 0.01, 0.012)), phys({ color: '#9fb6c4' }))
    l.position.set(Math.cos(a) * 2.95, 0.012, Math.sin(a) * 2.95)
    l.rotation.y = -a
    G.base.add(l)
  }
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(10, 10)), track(new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(11,32,52,0.45)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.6
  root.add(shadow)

  // ── shared context ring with memory tokens ───────────────
  const memRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.05, 0.07, 16, 160)), glass)
  memRing.rotation.x = Math.PI / 2
  memRing.position.y = 0.16
  G.memory.add(memRing)
  const tokenGeo = rbox(0.16, 0.1, 0.16, 0.03)
  const tokenMats = [glowM('#5cc3be', 0.9), glowM('#9ad5e5', 0.9), champ]
  const tokens = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(tokenGeo, tokenMats[i % 3])
    G.memory.add(m)
    return { m, a: (i / 10) * Math.PI * 2 }
  })

  // ── orchestrator tower ────────────────────────────────
  const tiers = [
    { r: 0.95, h: 0.5, m: navy },
    { r: 0.82, h: 0.45, m: petrol },
    { r: 0.7, h: 0.42, m: navy },
  ]
  let y = 0
  tiers.forEach((t) => {
    const c = new THREE.Mesh(track(new THREE.CylinderGeometry(t.r, t.r + 0.04, t.h, 64)), t.m)
    c.position.y = y + t.h / 2
    G.orch.add(c)
    const band = new THREE.Mesh(track(new THREE.TorusGeometry(t.r + 0.01, 0.015, 8, 96)), champ)
    band.rotation.x = Math.PI / 2
    band.position.y = y + t.h - 0.02
    G.orch.add(band)
    y += t.h
  })
  const crownBase = y
  // crown: glass dome + glowing core + task ring
  const dome = new THREE.Mesh(track(new THREE.CylinderGeometry(0.58, 0.64, 0.42, 64)), glass)
  dome.position.y = 0.21
  G.crown.add(dome)
  const coreMat = glowM('#5cc3be', 1.6)
  const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.2, 2)), coreMat)
  core.position.y = 0.22
  G.crown.add(core)
  const lid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 0.6, 0.06, 64)), ceramic)
  lid.position.y = 0.45
  G.crown.add(lid)
  const taskRing = new THREE.Group()
  taskRing.position.y = 0.25
  G.crown.add(taskRing)
  const tick = rbox(0.1, 0.04, 0.04, 0.01)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const m = new THREE.Mesh(tick, i % 6 === 0 ? champ : petrol)
    m.position.set(Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86)
    m.rotation.y = -a
    taskRing.add(m)
  }
  const orchLabel = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex('Orchestrator', 'Plans · delegates', '#d5b68a')), transparent: true, depthWrite: false })))
  orchLabel.scale.set(2.1, 0.66, 1)
  orchLabel.center.set(0.5, 0)
  orchLabel.position.y = 0.95
  G.crown.add(orchLabel)

  // ── specialist agents ──────────────────────────────────
  const AGENTS = [
    { name: 'Research', sub: 'web · read', color: '#9ad5e5', build: buildResearch },
    { name: 'Analysis', sub: 'compare · compute', color: '#38a6a2', build: buildAnalysis },
    { name: 'Verify', sub: 'cite · cross-check', color: '#8cc39b', build: buildVerify },
    { name: 'Tools', sub: 'APIs · functions', color: '#e2a86b', build: buildTools },
    { name: 'Report', sub: 'draft · format', color: '#d5b68a', build: buildReport },
  ]
  const R = 2.6
  const padGeo = track(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 6))
  const agents = AGENTS.map((A, i) => {
    const a = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5 + 0.35
    const g = new THREE.Group()
    g.position.set(Math.cos(a) * R, 0.08, Math.sin(a) * R)
    const pad = new THREE.Mesh(padGeo, petrol)
    pad.rotation.y = Math.PI / 6
    g.add(pad)
    const padTopMat = glowM(A.color, 0)
    const padTop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 6)), padTopMat)
    padTop.position.y = 0.09
    padTop.rotation.y = Math.PI / 6
    g.add(padTop)
    const ledMat = glowM('#8cc39b', 0.6)
    const led = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 12, 12)), ledMat)
    led.position.set(0.48, 0.14, 0)
    g.add(led)
    const inner = new THREE.Group()
    inner.position.y = 0.1
    A.build(inner, A.color)
    g.add(inner)
    const label = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex(A.name, A.sub, A.color)), transparent: true, depthWrite: false })))
    label.scale.set(1.75, 0.55, 1)
    label.center.set(0.5, 0)
    label.position.set(Math.cos(a) * 0.55, 0.78, Math.sin(a) * 0.55)
    g.add(label)
    G.agents.add(g)
    return { g, inner, a, padTopMat, ledMat, home: g.position.clone(), phase: i * 1.1 }
  })

  // ── delegation arcs ────────────────────────────────────
  const arcMat = phys({ color: '#7f9db0', metalness: 0.7, roughness: 0.3 })
  const hotMat = glowM('#5cc3be', 1.2)
  const pulseGeo = track(new THREE.SphereGeometry(0.07, 14, 14))
  const pulseMat = glowM('#bff3ff', 2.2)
  const arcs = agents.map(() => {
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), arcMat)
    G.links.add(tube)
    const pulse = new THREE.Mesh(pulseGeo, pulseMat)
    G.links.add(pulse)
    return { tube, pulse, curve: new THREE.QuadraticBezierCurve3(), lastGeo: null as THREE.TubeGeometry | null }
  })
  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vM = new THREE.Vector3()

  // ── frame ─────────────────────────────────────────
  S.setFrame((s) => {
    applyTilt(root, s, -0.3)
    const e = s.e

    G.base.position.y = -0.45 * e
    G.memory.position.y = -0.2 * e
    G.orch.position.y = 0.05 * e
    G.crown.position.y = crownBase + 0.6 * e
    G.agents.position.x = s.px * 0.12
    G.crown.position.x = s.px * 0.06

    // delegation cycle: one agent at a time
    const turn = s.reduced ? 0 : (s.time / 1.4) % agents.length
    const activeIdx = Math.floor(turn)
    const frac = turn - activeIdx

    agents.forEach((ag, i) => {
      const out = 1 + e * 0.18
      ag.g.position.set(ag.home.x * out, ag.home.y + e * (0.55 + (i % 2) * 0.2) + (s.reduced ? 0 : Math.sin(s.time * 1.2 + ag.phase) * 0.03), ag.home.z * out)
      const on = i === activeIdx || s.hl > 0.4
      ag.padTopMat.emissiveIntensity += ((on ? 1.1 : 0.05) - ag.padTopMat.emissiveIntensity) * Math.min(1, s.dt * 6 || 1)
      ag.ledMat.emissiveIntensity = on ? 2 : 0.5
      ag.inner.rotation.y += s.reduced ? 0 : s.dt * (on ? 0.9 : 0.15)
    })

    // rebuild arcs as layers move (cheap: 5 short tubes)
    root.updateMatrixWorld(true)
    arcs.forEach((arc, i) => {
      const ag = agents[i]
      vA.set(G.crown.position.x, G.crown.position.y + 0.3, 0)
      vB.copy(ag.g.position).add(G.agents.position).setY(ag.g.position.y + 0.55)
      vM.copy(vA).add(vB).multiplyScalar(0.5).setY(Math.max(vA.y, vB.y) + 0.7)
      arc.curve.v0.copy(vA)
      arc.curve.v1.copy(vM)
      arc.curve.v2.copy(vB)
      const geo = new THREE.TubeGeometry(arc.curve, 28, 0.022, 6, false)
      arc.tube.geometry.dispose()
      arc.tube.geometry = geo
      const on = i === activeIdx || s.hl > 0.4
      arc.tube.material = on ? hotMat : arcMat
      arc.pulse.visible = on && !s.reduced
      if (arc.pulse.visible) arc.curve.getPoint(s.hl > 0.4 ? (s.time * 0.5 + i * 0.2) % 1 : frac, arc.pulse.position)
    })
    hotMat.emissiveIntensity = 1 + s.hl

    tokens.forEach((t, i) => {
      const a = t.a + (s.reduced ? 0 : s.time * 0.25)
      t.m.position.set(Math.cos(a) * 2.05, 0.16 + Math.sin(s.time * 2 + i) * 0.015, Math.sin(a) * 2.05)
      t.m.rotation.y = -a
    })
    taskRing.rotation.y = s.reduced ? 0 : s.time * 0.4
    core.rotation.y = s.time * 0.6
    coreMat.emissiveIntensity = 1.4 + Math.sin(s.time * 2.4) * 0.3 + s.hl * 1.2
    shadow.scale.setScalar(1 - e * 0.06)
  })

  const api = S.api
  const dispose = api.dispose
  api.dispose = () => {
    arcs.forEach((a) => a.tube.geometry.dispose())
    dispose()
  }
  return api

  /* ── specialist builders ─────────────────────────── */
  function buildResearch(g: THREE.Group, c: string) {
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.05, 16, 48)), champ)
    ring.position.set(-0.05, 0.42, 0)
    g.add(ring)
    const lens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40)), phys({ color: c, transmission: 0.6, thickness: 0.3, roughness: 0.05, transparent: true, opacity: 0.85 }))
    lens.rotation.x = Math.PI / 2
    lens.position.copy(ring.position)
    g.add(lens)
    ring.rotation.x = 0
    const handle = new THREE.Mesh(rbox(0.07, 0.3, 0.07, 0.03), navy)
    handle.position.set(0.17, 0.18, 0)
    handle.rotation.z = 0.7
    g.add(handle)
  }
  function buildAnalysis(g: THREE.Group, c: string) {
    const h = [0.22, 0.42, 0.32, 0.55]
    h.forEach((v, i) => {
      const b = new THREE.Mesh(rbox(0.12, v, 0.12, 0.03), i === 3 ? phys({ color: c, metalness: 0.3, roughness: 0.25, clearcoat: 1 }) : i % 2 ? petrol : ceramic)
      b.position.set(-0.22 + i * 0.15, v / 2 + 0.02, 0)
      g.add(b)
    })
  }
  function buildVerify(g: THREE.Group, c: string) {
    const s = new THREE.Shape()
    s.moveTo(0, 0.3)
    s.quadraticCurveTo(0.22, 0.28, 0.26, 0.2)
    s.lineTo(0.24, -0.02)
    s.quadraticCurveTo(0.18, -0.22, 0, -0.3)
    s.quadraticCurveTo(-0.18, -0.22, -0.24, -0.02)
    s.lineTo(-0.26, 0.2)
    s.quadraticCurveTo(-0.22, 0.28, 0, 0.3)
    const shield = new THREE.Mesh(track(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 })), phys({ color: c, metalness: 0.3, roughness: 0.3, clearcoat: 1 }))
    shield.position.set(0, 0.42, -0.06)
    g.add(shield)
    const chk = new THREE.Shape()
    chk.moveTo(-0.12, 0.0)
    chk.lineTo(-0.04, -0.08)
    chk.lineTo(0.13, 0.1)
    chk.lineTo(0.1, 0.13)
    chk.lineTo(-0.04, -0.02)
    chk.lineTo(-0.09, 0.03)
    chk.closePath()
    const ck = new THREE.Mesh(track(new THREE.ExtrudeGeometry(chk, { depth: 0.04, bevelEnabled: false })), ceramic)
    ck.position.set(0, 0.42, 0.09)
    g.add(ck)
  }
  function buildTools(g: THREE.Group, c: string) {
    const gear = new THREE.Group()
    gear.position.y = 0.4
    gear.rotation.x = Math.PI / 2
    const mat = phys({ color: c, metalness: 0.7, roughness: 0.25 })
    gear.add(new THREE.Mesh(track(new THREE.TorusGeometry(0.18, 0.07, 12, 40)), mat))
    for (let i = 0; i < 8; i++) {
      const t = new THREE.Mesh(rbox(0.09, 0.12, 0.08, 0.02), mat)
      const a = (i / 8) * Math.PI * 2
      t.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0)
      t.rotation.z = a
      gear.add(t)
    }
    g.add(gear)
    const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16)), navy)
    shaft.position.y = 0.15
    g.add(shaft)
  }
  function buildReport(g: THREE.Group, c: string) {
    for (let i = 0; i < 3; i++) {
      const sheet = new THREE.Mesh(rbox(0.42, 0.025, 0.54, 0.02), i === 2 ? ceramic : phys({ color: i ? '#dfe8ec' : c, roughness: 0.4 }))
      sheet.position.set(i * 0.03, 0.08 + i * 0.07, -i * 0.03)
      sheet.rotation.y = i * 0.08
      g.add(sheet)
    }
    for (let k = 0; k < 4; k++) {
      const line = new THREE.Mesh(rbox(k === 0 ? 0.22 : 0.3, 0.01, 0.035, 0.005), k === 0 ? champ : petrol)
      line.position.set(0.06, 0.24, -0.15 + k * 0.09)
      line.rotation.y = 0.16
      g.add(line)
    }
  }
}
