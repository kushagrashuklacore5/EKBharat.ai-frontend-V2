import * as THREE from 'three'
import { applyTilt, canvasTex, createStage, labelTex, radialTex } from './stage3d'

/**
 * Industry solutions as an enterprise AI district.
 *
 * A circular campus on a translucent knowledge layer (data lake). At the
 * centre an AI spire; around it seven industry buildings, each with its own
 * architecture — hospital, bank, school, warehouse, factory, support centre,
 * enterprise tower. Data streams arc from the spire to every building and a
 * governance dome encloses the district.
 * Scroll: buildings rise and spread, the dome lifts, every stream lights.
 */
export function createDistrictScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const S = createStage(canvas, { reducedMotion: opts.reducedMotion, dist: [15.5, 18], target: [0, 0.7, 0], dolly: 0.3 })
  const { root, track, rbox, phys } = S

  const ceramic = phys({ color: '#eef3f5', roughness: 0.3, clearcoat: 0.9 })
  const navy = phys({ color: '#15334c', metalness: 0.7, roughness: 0.25, clearcoat: 1 })
  const petrol = phys({ color: '#1f5a70', metalness: 0.55, roughness: 0.28, clearcoat: 1 })
  const champ = phys({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  const graphite = phys({ color: '#2a3743', metalness: 0.8, roughness: 0.35 })
  const winTex = track(windowTexture())
  const windows = phys({ map: winTex, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0.25, roughness: 0.3, clearcoat: 0.8 })
  const glow = (c: string, i = 1.4) => phys({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 })
  const at = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    return m
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = h / 2, z = 0, r = 0.03) => at(rbox(w, h, d, r), mat, x, y, z)

  const G = { lake: new THREE.Group(), ground: new THREE.Group(), spire: new THREE.Group(), town: new THREE.Group(), dome: new THREE.Group(), streams: new THREE.Group() }
  Object.values(G).forEach((g) => root.add(g))

  // ── knowledge layer + campus ground ───────────────────────
  const lake = at(track(new THREE.CylinderGeometry(3.75, 3.75, 0.08, 96)), phys({ map: track(lakeTexture()), transparent: true, opacity: 0.92, roughness: 0.2, clearcoat: 1, emissive: '#38a6a2', emissiveIntensity: 0.08 }), 0, -0.28, 0)
  G.lake.add(lake)
  const lakeLabel = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex('Knowledge layer', 'Docs · data · RAG', '#38a6a2')), transparent: true, depthWrite: false })))
  lakeLabel.scale.set(1.8, 0.56, 1)
  lakeLabel.center.set(1, 0.5)
  lakeLabel.position.set(-3.5, -0.3, 1.4)
  G.lake.add(lakeLabel)
  const ground = at(track(new THREE.CylinderGeometry(3.55, 3.6, 0.16, 96)), ceramic, 0, -0.08, 0)
  G.ground.add(ground)
  const groundRim = at(track(new THREE.TorusGeometry(3.57, 0.022, 10, 160)), champ, 0, 0, 0)
  groundRim.rotation.x = Math.PI / 2
  G.ground.add(groundRim)
  const roads = at(track(new THREE.RingGeometry(1.15, 1.45, 96)), phys({ color: '#c9d8e0', roughness: 0.6 }), 0, 0.004, 0)
  roads.rotation.x = -Math.PI / 2
  G.ground.add(roads)
  const shadow = at(track(new THREE.PlaneGeometry(10, 10)), track(new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(11,32,52,0.42)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })), 0, -0.75, 0)
  shadow.rotation.x = -Math.PI / 2
  root.add(shadow)

  // ── AI spire ───────────────────────────────────────
  const spireMat = navy
  const tiers = [0.62, 0.5, 0.4, 0.3]
  let y = 0
  tiers.forEach((r, i) => {
    const h = 0.42 - i * 0.04
    G.spire.add(at(track(new THREE.CylinderGeometry(r * 0.92, r, h, 6)), i % 2 ? petrol : spireMat, 0, y + h / 2, 0))
    const band = at(track(new THREE.TorusGeometry(r * 0.94, 0.018, 8, 6)), champ, 0, y + h, 0)
    band.rotation.x = Math.PI / 2
    band.rotation.z = Math.PI / 6
    G.spire.add(band)
    y += h
  })
  const orbMat = glow('#5cc3be', 1.6)
  const orb = at(track(new THREE.IcosahedronGeometry(0.22, 2)), orbMat, 0, y + 0.32, 0)
  G.spire.add(orb)
  const orbShell = at(track(new THREE.SphereGeometry(0.34, 32, 32)), phys({ color: '#cdeef5', transmission: 0.8, thickness: 0.5, roughness: 0.04, transparent: true, opacity: 0.6 }), 0, y + 0.32, 0)
  G.spire.add(orbShell)
  const spireTop = y + 0.32
  const spireLabel = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex('Ek भारत.AI core', 'Models · agents · workflows', '#5cc3be')), transparent: true, depthWrite: false })))
  spireLabel.scale.set(2.2, 0.69, 1)
  spireLabel.center.set(0.5, 0)
  spireLabel.position.y = spireTop + 1.05
  spireLabel.renderOrder = 6
  G.spire.add(spireLabel)

  // ── industry buildings ──────────────────────────────
  const INDUSTRIES = [
    { name: 'Healthcare', color: '#c97a5d', build: buildHospital },
    { name: 'Finance', color: '#d5b68a', build: buildBank },
    { name: 'Education', color: '#e2a86b', build: buildSchool },
    { name: 'E-commerce', color: '#9ad5e5', build: buildWarehouse },
    { name: 'Manufacturing', color: '#8fa3b4', build: buildFactory },
    { name: 'Support', color: '#5cc3be', build: buildSupport },
    { name: 'Enterprise', color: '#93b5e2', build: buildTower },
  ]
  const R = 2.5
  const buildings = INDUSTRIES.map((ind, i) => {
    const a = (i / INDUSTRIES.length) * Math.PI * 2 + 0.35
    const g = new THREE.Group()
    g.position.set(Math.cos(a) * R, 0, Math.sin(a) * R)
    g.rotation.y = -a + Math.PI / 2
    const lot = box(1.15, 0.06, 1.15, petrol, 0, 0.03, 0, 0.05)
    g.add(lot)
    const lotGlow = glow(ind.color, 0)
    g.add(box(1.17, 0.012, 1.17, lotGlow, 0, 0.066, 0, 0.04))
    const inner = new THREE.Group()
    inner.position.y = 0.07
    inner.scale.setScalar(1.22)
    ind.build(inner, ind.color)
    g.add(inner)
    const label = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex(ind.name, undefined, ind.color)), transparent: true, depthWrite: false })))
    label.scale.set(1.45, 0.45, 1)
    label.center.set(0.5, 0)
    label.position.y = new THREE.Box3().setFromObject(inner).max.y + 0.1
    label.renderOrder = 5
    g.add(label)
    G.town.add(g)
    return { g, a, lotGlow, home: g.position.clone(), phase: i * 0.9 }
  })

  // ── governance dome ─────────────────────────────────
  const domeWire = at(track(new THREE.SphereGeometry(3.45, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2)), phys({ color: '#9ad5e5', wireframe: true, transparent: true, opacity: 0.09, emissive: '#9ad5e5', emissiveIntensity: 0.3, depthWrite: false }), 0, 0, 0)
  domeWire.scale.y = 0.62
  domeWire.renderOrder = -2
  G.dome.add(domeWire)
  const domeShell = at(track(new THREE.SphereGeometry(3.42, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2)), phys({ color: '#d6f1f6', transparent: true, opacity: 0.07, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0)
  domeShell.scale.y = 0.62
  domeShell.renderOrder = -1
  G.dome.add(domeShell)
  const domeLabel = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex('Governance', 'Access · redaction · audit', '#8cc39b')), transparent: true, depthWrite: false })))
  domeLabel.scale.set(1.9, 0.6, 1)
  domeLabel.center.set(0.5, 0)
  domeLabel.position.set(-2.4, 1.85, -0.6)
  G.dome.add(domeLabel)

  // ── data streams spire → buildings ─────────────────────
  const streamMat = phys({ color: '#7f9db0', metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.7 })
  const hotMat = glow('#5cc3be', 1.1)
  const pulseGeo = track(new THREE.SphereGeometry(0.055, 12, 12))
  const pulseMat = glow('#bff3ff', 2.2)
  const streams = buildings.map(() => {
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), streamMat)
    G.streams.add(tube)
    const pulse = new THREE.Mesh(pulseGeo, pulseMat)
    G.streams.add(pulse)
    return { tube, pulse, curve: new THREE.QuadraticBezierCurve3() }
  })
  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()

  S.setFrame((s) => {
    applyTilt(root, s, 0.1)
    const e = s.e
    G.lake.position.y = -0.55 * e
    G.ground.position.y = -0.12 * e
    G.spire.position.y = 0.25 * e
    G.dome.position.y = 1.0 * e
    G.dome.scale.setScalar(1 + e * 0.08)

    const turn = s.reduced ? 0 : (s.time / 1.1) % buildings.length
    const activeIdx = Math.floor(turn)
    const frac = turn - activeIdx

    buildings.forEach((b, i) => {
      const out = 1 + e * 0.12
      b.g.position.set(b.home.x * out, e * (0.35 + (i % 3) * 0.12) + (s.reduced ? 0 : Math.sin(s.time + b.phase) * 0.015), b.home.z * out)
      const on = i === activeIdx || s.hl > 0.4
      b.lotGlow.emissiveIntensity += ((on ? 1.3 : 0) - b.lotGlow.emissiveIntensity) * Math.min(1, s.dt * 6 || 1)
    })

    streams.forEach((st, i) => {
      const b = buildings[i]
      vA.set(0, G.spire.position.y + spireTop, 0)
      vB.copy(b.g.position).setY(b.g.position.y + 0.85)
      st.curve.v0.copy(vA)
      st.curve.v1.set(vB.x * 0.55, Math.max(vA.y, vB.y) + 0.55, vB.z * 0.55)
      st.curve.v2.copy(vB)
      st.tube.geometry.dispose()
      st.tube.geometry = new THREE.TubeGeometry(st.curve, 24, 0.018, 6, false)
      const on = i === activeIdx || s.hl > 0.4
      st.tube.material = on ? hotMat : streamMat
      st.pulse.visible = on && !s.reduced
      if (st.pulse.visible) st.curve.getPoint(s.hl > 0.4 ? (s.time * 0.5 + i * 0.14) % 1 : frac, st.pulse.position)
    })
    hotMat.emissiveIntensity = 1.1 + s.hl
    orbMat.emissiveIntensity = 1.5 + Math.sin(s.time * 2.4) * 0.35 + s.hl
    orb.rotation.y = s.time * 0.6
    windows.emissiveIntensity = 0.25 + s.hl * 0.5
    shadow.scale.setScalar(1 - e * 0.05)
  })

  const api = S.api
  const dispose = api.dispose
  api.dispose = () => {
    streams.forEach((st) => st.tube.geometry.dispose())
    dispose()
  }
  return api

  /* ── building builders (local +z faces outward) ──────────── */
  function buildHospital(g: THREE.Group, c: string) {
    g.add(box(0.7, 0.55, 0.55, [ceramic, ceramic, ceramic, ceramic, windows, windows]))
    g.add(box(0.36, 0.25, 0.36, ceramic, 0, 0.67))
    const cross = glow(c, 0.9)
    g.add(box(0.26, 0.07, 0.07, cross, 0, 0.83, 0, 0.01))
    g.add(box(0.07, 0.07, 0.26, cross, 0, 0.83, 0, 0.01))
    g.add(box(0.22, 0.2, 0.06, glow('#9ad5e5', 0.4), 0, 0.1, 0.3, 0.02))
  }
  function buildBank(g: THREE.Group, c: string) {
    g.add(box(0.8, 0.07, 0.6, ceramic, 0, 0.035))
    g.add(box(0.72, 0.06, 0.52, ceramic, 0, 0.1))
    for (let i = 0; i < 5; i++) g.add(at(track(new THREE.CylinderGeometry(0.035, 0.04, 0.38, 14)), ceramic, -0.28 + i * 0.14, 0.32, 0.18))
    g.add(box(0.6, 0.38, 0.28, petrol, 0, 0.32, -0.06))
    g.add(box(0.76, 0.05, 0.56, champ, 0, 0.53, 0, 0.01))
    const roof = at(track(new THREE.CylinderGeometry(0.32, 0.32, 0.74, 3)), ceramic, 0, 0.62, 0)
    roof.rotation.z = Math.PI / 2
    roof.scale.set(0.5, 1, 0.75)
    g.add(roof)
    g.add(at(track(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 24)), glow(c, 0.8), 0, 0.62, 0.27))
  }
  function buildSchool(g: THREE.Group, c: string) {
    g.add(box(0.78, 0.36, 0.5, [ceramic, ceramic, ceramic, ceramic, windows, windows]))
    g.add(box(0.3, 0.6, 0.3, ceramic, 0, 0.3))
    g.add(box(0.36, 0.03, 0.36, navy, 0, 0.62, 0, 0.01))
    g.add(at(track(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16)), navy, 0, 0.66, 0))
    g.add(at(track(new THREE.SphereGeometry(0.03, 10, 10)), glow(c, 1), 0.16, 0.6, 0.16))
    g.add(box(0.12, 0.12, 0.02, glow(c, 0.5), 0, 0.48, 0.16, 0.01))
  }
  function buildWarehouse(g: THREE.Group, c: string) {
    g.add(box(0.8, 0.3, 0.55, graphite))
    const roof = at(track(new THREE.CylinderGeometry(0.275, 0.275, 0.8, 24, 1, false, 0, Math.PI)), petrol, 0, 0.3, 0)
    roof.rotation.z = Math.PI / 2
    roof.rotation.y = Math.PI / 2
    roof.rotation.order = 'YZX'
    g.add(roof)
    g.add(box(0.3, 0.2, 0.02, glow(c, 0.5), 0, 0.12, 0.285, 0.01))
    ;[
      [-0.3, 0.35],
      [-0.18, 0.4],
      [-0.25, 0.4],
    ].forEach(([x, z], i) => g.add(box(0.11, 0.1, 0.11, i === 1 ? champ : phys({ color: '#c9a46e', roughness: 0.6 }), x, 0.05 + (i === 2 ? 0.1 : 0), z, 0.01)))
  }
  function buildFactory(g: THREE.Group, c: string) {
    g.add(box(0.8, 0.28, 0.55, ceramic))
    for (let i = 0; i < 3; i++) {
      const tooth = at(track(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 3)), petrol, -0.27 + i * 0.27, 0.38, 0)
      tooth.rotation.x = Math.PI / 2
      tooth.rotation.y = 0.0
      tooth.scale.set(1, 1, 0.7)
      g.add(tooth)
    }
    g.add(at(track(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 16)), graphite, 0.3, 0.35, -0.18))
    g.add(at(track(new THREE.TorusGeometry(0.05, 0.012, 8, 16)), glow(c, 0.6), 0.3, 0.72, -0.18))
    const gear = at(track(new THREE.TorusGeometry(0.09, 0.03, 8, 8)), champ, -0.2, 0.16, 0.29)
    g.add(gear)
  }
  function buildSupport(g: THREE.Group, c: string) {
    g.add(at(track(new THREE.CylinderGeometry(0.22, 0.26, 0.75, 24)), [windows, ceramic, ceramic], 0, 0.375, 0))
    const set = at(track(new THREE.TorusGeometry(0.2, 0.03, 10, 32, Math.PI)), navy, 0, 0.8, 0)
    g.add(set)
    g.add(box(0.07, 0.12, 0.1, navy, -0.2, 0.78, 0))
    g.add(box(0.07, 0.12, 0.1, navy, 0.2, 0.78, 0))
    const bubble = box(0.3, 0.18, 0.06, glow(c, 0.6), 0.32, 1.0, 0, 0.06)
    g.add(bubble)
  }
  function buildTower(g: THREE.Group, c: string) {
    g.add(box(0.45, 1.05, 0.45, [windows, windows, ceramic, ceramic, windows, windows]))
    g.add(box(0.36, 0.2, 0.36, navy, 0, 1.15))
    g.add(at(track(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8)), champ, 0, 1.4, 0))
    g.add(at(track(new THREE.SphereGeometry(0.03, 10, 10)), glow(c, 1.5), 0, 1.56, 0))
  }
}

function windowTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#e8eff2'
    g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 6; x++) {
        g.fillStyle = (x + y) % 5 === 0 ? '#9ad5e5' : '#1f5a70'
        g.fillRect(8 + x * 20, 6 + y * 15, 12, 9)
      }
  })
}

function lakeTexture() {
  return canvasTex(512, 512, (g) => {
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256)
    grd.addColorStop(0, '#1f5a70')
    grd.addColorStop(1, '#0f2a40')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 250
      g.fillStyle = Math.random() < 0.15 ? 'rgba(213,182,138,.7)' : 'rgba(154,213,229,.5)'
      g.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 2, 2)
    }
  })
}
