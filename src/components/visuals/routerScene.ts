import * as THREE from 'three'
import { applyTilt, canvasTex, createStage, labelTex, radialTex } from './stage3d'

/**
 * Multi-model orchestration as a "model gateway rail yard".
 *
 * App terminal → rail → crystal router (turntable + selector arm) →
 * one of four distinct model endpoints → back through the router →
 * schema-validator arch → response dock.
 *
 * Every few seconds a request capsule is routed to the next model; some
 * cycles the chosen model is unavailable (red beacon) and the arm swings to
 * the fallback. Scroll: endpoints move out, router lifts, every route lights.
 */
export function createRouterScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const S = createStage(canvas, { reducedMotion: opts.reducedMotion, dist: [16.6, 18.5], target: [0, 0.55, -0.2], dolly: 0.26 })
  const { root, track, rbox, phys } = S

  const ceramic = phys({ color: '#edf2f4', roughness: 0.3, clearcoat: 0.9 })
  const navy = phys({ color: '#15334c', metalness: 0.7, roughness: 0.25, clearcoat: 1 })
  const petrol = phys({ color: '#1f5a70', metalness: 0.55, roughness: 0.28, clearcoat: 1 })
  const graphite = phys({ color: '#26323d', metalness: 0.85, roughness: 0.35 })
  const champ = phys({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  const railMat = phys({ color: '#8aa3b4', metalness: 0.9, roughness: 0.25 })
  const crystal = phys({ color: '#bfeaf2', transmission: 0.75, thickness: 1.2, roughness: 0.04, ior: 1.45, transparent: true, opacity: 0.95, clearcoat: 1 })
  const glow = (c: string, i = 1.4) => phys({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 })
  const sprite = (title: string, sub: string, color: string, sx = 1.75) => {
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex(title, sub, color)), transparent: true, depthWrite: false })))
    s.scale.set(sx, sx * 0.31, 1)
    s.center.set(0.5, 0)
    return s
  }

  const G = { yard: new THREE.Group(), rails: new THREE.Group(), router: new THREE.Group(), models: new THREE.Group(), docks: new THREE.Group() }
  Object.values(G).forEach((g) => root.add(g))

  // ── yard: hexagonal platform with track bed ──────────────
  const plate = new THREE.Mesh(track(new THREE.CylinderGeometry(3.85, 4.0, 0.2, 6)), ceramic)
  plate.rotation.y = Math.PI / 6
  plate.position.y = -0.1
  G.yard.add(plate)
  const rim = new THREE.Mesh(track(new THREE.CylinderGeometry(4.02, 4.02, 0.04, 6, 1, true)), champ)
  rim.rotation.y = Math.PI / 6
  rim.position.y = -0.02
  G.yard.add(rim)
  const bed = new THREE.Mesh(track(new THREE.CircleGeometry(3.6, 6)), phys({ map: track(yardTexture()), roughness: 0.6 }))
  bed.rotation.x = -Math.PI / 2
  bed.rotation.z = Math.PI / 6
  bed.position.y = 0.005
  G.yard.add(bed)
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(11, 8)), track(new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(11,32,52,0.42)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.55
  root.add(shadow)

  // ── positions ─────────────────────────────────────
  const P = {
    input: new THREE.Vector3(-3.0, 0, 1.3),
    core: new THREE.Vector3(-0.2, 0, 0.2),
    validator: new THREE.Vector3(1.5, 0, 1.75),
    output: new THREE.Vector3(3.05, 0, 1.25),
  }
  const MODELS = [
    { name: 'Reasoning', sub: 'Large model · provider A', color: '#9ad5e5', pos: new THREE.Vector3(-2.35, 0, -1.55), build: buildReasoning },
    { name: 'Fast', sub: 'Compact · provider B', color: '#5cc3be', pos: new THREE.Vector3(-0.55, 0, -2.6), build: buildFast },
    { name: 'Code', sub: 'Code-specialised', color: '#93b5e2', pos: new THREE.Vector3(1.45, 0, -2.3), build: buildCode },
    { name: 'Open-weight', sub: 'Self-hosted · GPU Cloud', color: '#d5b68a', pos: new THREE.Vector3(2.85, 0, -0.45), build: buildOpen },
  ]

  // ── router: turntable, crystal, selector arm ─────────────
  G.router.position.copy(P.core)
  const turntable = new THREE.Mesh(track(new THREE.CylinderGeometry(0.85, 0.95, 0.22, 64)), navy)
  turntable.position.y = 0.11
  G.router.add(turntable)
  const ttRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.9, 0.025, 10, 96)), champ)
  ttRing.rotation.x = Math.PI / 2
  ttRing.position.y = 0.22
  G.router.add(ttRing)
  const arm = new THREE.Group()
  arm.position.y = 0.27
  G.router.add(arm)
  const armBar = new THREE.Mesh(rbox(1.25, 0.07, 0.16, 0.03), petrol)
  armBar.position.x = 0.62
  arm.add(armBar)
  const armTipMat = glow('#5cc3be', 1.6)
  const armTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 16, 16)), armTipMat)
  armTip.position.x = 1.25
  arm.add(armTip)
  const crystalGroup = new THREE.Group()
  crystalGroup.position.y = 0.95
  G.router.add(crystalGroup)
  const gem = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.48, 0)), crystal)
  gem.scale.set(1, 1.45, 1)
  crystalGroup.add(gem)
  const coreMat = glow('#5cc3be', 1.8)
  const gemCore = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.15, 1)), coreMat)
  crystalGroup.add(gemCore)
  const halo = new THREE.Mesh(track(new THREE.TorusGeometry(0.7, 0.015, 8, 96)), champ)
  halo.rotation.x = Math.PI / 2.3
  crystalGroup.add(halo)
  const routerLabel = sprite('Model gateway', 'Policy · route · fallback', '#5cc3be', 1.9)
  routerLabel.position.y = 1.72
  G.router.add(routerLabel)

  // ── model endpoints ─────────────────────────────────
  const models = MODELS.map((m) => {
    const g = new THREE.Group()
    g.position.copy(m.pos)
    const pad = new THREE.Mesh(rbox(1.0, 0.12, 1.0, 0.1, 4), petrol)
    pad.position.y = 0.06
    g.add(pad)
    const padTopMat = glow(m.color, 0)
    const padTop = new THREE.Mesh(rbox(0.86, 0.02, 0.86, 0.08), padTopMat)
    padTop.position.y = 0.13
    g.add(padTop)
    const inner = new THREE.Group()
    inner.position.y = 0.14
    inner.scale.setScalar(1.3)
    m.build(inner, m.color)
    g.add(inner)
    const beaconMat = glow('#8cc39b', 1.2)
    const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 14, 14)), beaconMat)
    beacon.position.set(0.42, 0.2, 0.42)
    g.add(beacon)
    const label = sprite(m.name, m.sub, m.color)
    label.position.y = 1.75
    g.add(label)
    G.models.add(g)
    return { ...m, g, padTopMat, beaconMat, home: m.pos.clone() }
  })

  // ── docks: app terminal, validator arch, response dock ────────
  const input = new THREE.Group()
  input.position.copy(P.input)
  input.add(meshAt(rbox(0.95, 0.08, 0.7, 0.05), graphite, 0, 0.1, 0))
  const screen = new THREE.Mesh(rbox(0.95, 0.62, 0.05, 0.04), graphite)
  screen.position.set(0, 0.47, -0.32)
  screen.rotation.x = -0.18
  input.add(screen)
  const scrFace = new THREE.Mesh(track(new THREE.PlaneGeometry(0.86, 0.52)), phys({ map: track(appTexture()), emissive: '#ffffff', emissiveMap: track(appTexture()), emissiveIntensity: 0.35, roughness: 0.3 }))
  scrFace.position.set(0, 0.47, -0.29)
  scrFace.rotation.x = -0.18
  input.add(scrFace)
  const inLabel = sprite('Your application', 'One API call', '#d5b68a', 1.9)
  inLabel.position.y = 1.0
  input.add(inLabel)
  G.docks.add(input)

  const validator = new THREE.Group()
  validator.position.copy(P.validator)
  validator.rotation.y = -0.6
  const archMat = phys({ color: '#4b8a5c', metalness: 0.4, roughness: 0.3, emissive: '#8cc39b', emissiveIntensity: 0, clearcoat: 1 })
  const arch = new THREE.Mesh(track(new THREE.TorusGeometry(0.5, 0.07, 14, 48, Math.PI)), archMat)
  arch.position.y = 0.12
  validator.add(arch)
  validator.add(meshAt(rbox(1.25, 0.08, 0.36, 0.04), navy, 0, 0.05, 0))
  const check = new THREE.Shape()
  check.moveTo(-0.16, 0)
  check.lineTo(-0.05, -0.11)
  check.lineTo(0.18, 0.13)
  check.lineTo(0.13, 0.17)
  check.lineTo(-0.05, -0.02)
  check.lineTo(-0.11, 0.04)
  check.closePath()
  const ck = new THREE.Mesh(track(new THREE.ExtrudeGeometry(check, { depth: 0.04, bevelEnabled: false })), glow('#8cc39b', 0.8))
  ck.position.set(0, 0.42, -0.02)
  validator.add(ck)
  const vLabel = sprite('Validate', 'Schema ✓ · retries', '#8cc39b', 1.6)
  vLabel.position.y = 0.95
  validator.add(vLabel)
  G.docks.add(validator)

  const output = new THREE.Group()
  output.position.copy(P.output)
  output.add(meshAt(track(new THREE.CylinderGeometry(0.42, 0.48, 0.18, 40)), navy, 0, 0.09, 0))
  const outRingMat = glow('#9ad5e5', 0.4)
  const outRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.34, 0.03, 10, 48)), outRingMat)
  outRing.rotation.x = Math.PI / 2
  outRing.position.y = 0.2
  output.add(outRing)
  const oLabel = sprite('Response', 'Clean · validated', '#9ad5e5', 1.55)
  oLabel.position.y = 0.75
  output.add(oLabel)
  G.docks.add(output)

  // ── rails (rebuilt on scroll since endpoints move) ───────────
  const railGeoCache: THREE.Mesh[] = []
  const railFor = () => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), railMat)
    G.rails.add(m)
    railGeoCache.push(m)
    return m
  }
  const H = 0.16
  const fixedRails = [
    [P.input, P.core],
    [P.core, P.validator],
    [P.validator, P.output],
  ].map(([a, b]) => {
    const curve = new THREE.CatmullRomCurve3([a.clone().setY(H), a.clone().lerp(b, 0.5).setY(H + 0.05), b.clone().setY(H)])
    const m = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 32, 0.035, 8, false)), railMat)
    G.rails.add(m)
    return m
  })
  const modelRails = models.map(() => ({ mesh: railFor(), curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]) }))
  const hotRail = glow('#5cc3be', 0.9)

  // request capsule
  const capsule = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.09, 0.22, 6, 16)), glow('#bff3ff', 2.2))
  capsule.rotation.z = Math.PI / 2
  G.rails.add(capsule)
  const trail = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 12, 12)), glow('#5cc3be', 1.5))
  G.rails.add(trail)

  // ── animation state ─────────────────────────────────
  const CYCLE = 3.4
  let lastCycle = -1
  let chosen = 0
  let failed = -1
  const angleTo = (v: THREE.Vector3) => Math.atan2(-(v.z - P.core.z), v.x - P.core.x)
  let armAngle = angleTo(MODELS[0].pos)
  const v = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  S.setFrame((s) => {
    applyTilt(root, s, 0.2)
    const e = s.e
    G.yard.position.y = -0.4 * e
    G.rails.position.y = -0.1 * e
    G.router.position.y = 0.15 * e
    crystalGroup.position.y = 0.95 + 0.55 * e
    G.docks.position.y = 0.2 * e

    models.forEach((m, i) => {
      const out = 1 + e * 0.16
      m.g.position.set(P.core.x + (m.home.x - P.core.x) * out, 0.45 * e + (s.reduced ? 0 : Math.sin(s.time * 1.1 + i) * 0.02), P.core.z + (m.home.z - P.core.z) * out)
    })

    // routing cycle
    const cyc = s.reduced ? 0 : Math.floor(s.time / CYCLE)
    if (cyc !== lastCycle) {
      lastCycle = cyc
      const want = cyc % models.length
      // every third cycle the preferred model is unavailable → fallback to the next
      failed = cyc % 3 === 2 ? want : -1
      chosen = failed >= 0 ? (want + 1) % models.length : want
    }
    const u = s.reduced ? 0.5 : (s.time % CYCLE) / CYCLE

    // rebuild model rails (cheap: 4 short tubes)
    models.forEach((m, i) => {
      const r = modelRails[i]
      const a = P.core.clone().setY(H)
      const b = m.g.position.clone().setY(m.g.position.y + H)
      r.curve.points[0].copy(a)
      r.curve.points[1].copy(a).lerp(b, 0.5).setY(Math.max(a.y, b.y) + 0.25)
      r.curve.points[2].copy(b)
      r.mesh.geometry.dispose()
      r.mesh.geometry = new THREE.TubeGeometry(r.curve, 24, 0.03, 6, false)
      const lit = i === chosen || s.hl > 0.35
      r.mesh.material = lit ? hotRail : railMat
      const on = i === chosen
      m.padTopMat.emissiveIntensity += ((on || s.hl > 0.35 ? 1 : 0) - m.padTopMat.emissiveIntensity) * Math.min(1, s.dt * 6 || 1)
      const down = i === failed && u < 0.55
      m.beaconMat.color.set(down ? '#ef6b6b' : '#8cc39b')
      m.beaconMat.emissive.set(down ? '#ef6b6b' : '#8cc39b')
      m.beaconMat.emissiveIntensity = down ? 2.4 + Math.sin(s.time * 14) : 1.2
    })
    hotRail.emissiveIntensity = 0.9 + s.hl

    // selector arm swings (to failed model first, then to fallback)
    const targetModel = failed >= 0 && u < 0.3 ? models[failed] : models[chosen]
    const tgt = angleTo(targetModel.g.position)
    let d = tgt - armAngle
    d = Math.atan2(Math.sin(d), Math.cos(d))
    armAngle += d * (s.reduced ? 1 : Math.min(1, s.dt * 5))
    arm.rotation.y = armAngle

    // capsule path: input → core → model → core → validator → output
    const leg = (a: THREE.Vector3, b: THREE.Vector3, t: number) => tmp.copy(a).lerp(b, t)
    const mp = models[chosen].g.position.clone().add(G.models.position)
    const core = P.core.clone()
    let pos: THREE.Vector3
    if (u < 0.15) pos = leg(P.input, core, u / 0.15)
    else if (u < 0.3) pos = core.clone()
    else if (u < 0.45) {
      modelRails[chosen].curve.getPoint((u - 0.3) / 0.15, v)
      pos = v
    } else if (u < 0.55) pos = mp
    else if (u < 0.7) {
      modelRails[chosen].curve.getPoint(1 - (u - 0.55) / 0.15, v)
      pos = v
    } else if (u < 0.85) pos = leg(core, P.validator, (u - 0.7) / 0.15)
    else pos = leg(P.validator, P.output, (u - 0.85) / 0.15)
    capsule.position.copy(pos).setY(Math.max(pos.y, H) + 0.18)
    trail.position.lerp(capsule.position, Math.min(1, s.dt * 8 || 1))
    capsule.visible = trail.visible = !s.reduced

    archMat.emissiveIntensity = u > 0.8 && u < 0.9 ? 1.6 : 0.15 + s.hl
    outRingMat.emissiveIntensity = u > 0.95 ? 2 : 0.4 + s.hl
    coreMat.emissiveIntensity = 1.4 + Math.sin(s.time * 3) * 0.3 + (u > 0.15 && u < 0.3 ? 1 : 0)
    gem.rotation.y = s.time * 0.5
    halo.rotation.z = s.time * 0.3
    armTipMat.emissiveIntensity = 1.4 + s.hl
    shadow.scale.setScalar(1 - e * 0.06)
  })

  const api = S.api
  const dispose = api.dispose
  api.dispose = () => {
    railGeoCache.forEach((m) => m.geometry.dispose())
    fixedRails.forEach((m) => m.geometry.dispose())
    dispose()
  }
  return api

  function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    return m
  }

  /* ── model endpoint builders ─────────────────────── */
  function buildReasoning(g: THREE.Group, c: string) {
    for (let i = 0; i < 4; i++) {
      const slab = new THREE.Mesh(rbox(0.66 - i * 0.05, 0.2, 0.66 - i * 0.05, 0.05), i % 2 ? petrol : navy)
      slab.position.y = 0.12 + i * 0.22
      g.add(slab)
      const ring = new THREE.Mesh(rbox(0.68 - i * 0.05, 0.02, 0.68 - i * 0.05, 0.01), champ)
      ring.position.y = 0.23 + i * 0.22
      g.add(ring)
    }
    g.add(meshAt(track(new THREE.SphereGeometry(0.12, 20, 20)), glow(c, 1.4), 0, 1.05, 0))
  }
  function buildFast(g: THREE.Group, c: string) {
    ;[-0.16, 0.16].forEach((x, i) => {
      const blade = new THREE.Mesh(rbox(0.2, 1.0 - i * 0.2, 0.66, 0.05), i ? petrol : ceramic)
      blade.position.set(x, 0.5 - i * 0.1, 0)
      g.add(blade)
      g.add(meshAt(rbox(0.02, 0.6 - i * 0.15, 0.04, 0.01), glow(c, 1.6), x + 0.08, 0.45 - i * 0.09, 0.28))
    })
  }
  function buildCode(g: THREE.Group, c: string) {
    const base = new THREE.Mesh(rbox(0.72, 0.5, 0.5, 0.08), navy)
    base.position.y = 0.25
    g.add(base)
    const chev = (dir: number) => {
      const s = new THREE.Shape()
      s.moveTo(0, 0.14)
      s.lineTo(-0.12 * dir, 0)
      s.lineTo(0, -0.14)
      s.lineTo(0.05 * dir, -0.1)
      s.lineTo(-0.05 * dir, 0)
      s.lineTo(0.05 * dir, 0.1)
      s.closePath()
      return new THREE.Mesh(track(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false })), glow(c, 1.3))
    }
    const l = chev(1)
    l.position.set(-0.14, 0.27, 0.25)
    g.add(l)
    const r = chev(-1)
    r.position.set(0.14, 0.27, 0.25)
    g.add(r)
    const slash = new THREE.Mesh(rbox(0.04, 0.3, 0.05, 0.01), champ)
    slash.position.set(0, 0.27, 0.27)
    slash.rotation.z = -0.35
    g.add(slash)
  }
  function buildOpen(g: THREE.Group, c: string) {
    const rack = new THREE.Mesh(rbox(0.7, 0.78, 0.55, 0.05), graphite)
    rack.position.y = 0.39
    g.add(rack)
    for (let i = 0; i < 3; i++) {
      const bay = new THREE.Mesh(rbox(0.6, 0.18, 0.02, 0.02), navy)
      bay.position.set(0, 0.16 + i * 0.23, 0.28)
      g.add(bay)
      const fan = new THREE.Mesh(track(new THREE.CircleGeometry(0.06, 20)), glow(c, 0.6))
      fan.position.set(0.2, 0.16 + i * 0.23, 0.295)
      g.add(fan)
      g.add(meshAt(rbox(0.25, 0.02, 0.01, 0.005), glow('#5cc3be', 1.2), -0.12, 0.16 + i * 0.23, 0.295))
    }
    const top = new THREE.Mesh(rbox(0.72, 0.03, 0.57, 0.01), champ)
    top.position.y = 0.79
    g.add(top)
  }
}

function yardTexture() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#dfe8ec'
    g.fillRect(0, 0, 1024, 1024)
    g.strokeStyle = 'rgba(16,42,64,0.08)'
    g.lineWidth = 2
    for (let i = 0; i <= 1024; i += 48) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 1024)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i)
      g.lineTo(1024, i)
      g.stroke()
    }
    g.strokeStyle = 'rgba(29,106,128,0.18)'
    g.setLineDash([10, 14])
    g.lineWidth = 3
    for (let r = 160; r < 520; r += 120) {
      g.beginPath()
      g.arc(512, 512, r, 0, Math.PI * 2)
      g.stroke()
    }
  })
}

function appTexture() {
  return canvasTex(256, 160, (g) => {
    g.fillStyle = '#0f2a40'
    g.fillRect(0, 0, 256, 160)
    g.fillStyle = '#9ad5e5'
    g.fillRect(16, 16, 90, 10)
    g.fillStyle = 'rgba(234,241,244,.5)'
    for (let i = 0; i < 4; i++) g.fillRect(16, 42 + i * 22, 140 - i * 20, 8)
    g.fillStyle = '#5cc3be'
    g.beginPath()
    g.roundRect(170, 110, 70, 30, 8)
    g.fill()
  })
}
