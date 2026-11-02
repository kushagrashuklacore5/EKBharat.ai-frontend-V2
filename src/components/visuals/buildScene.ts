import * as THREE from 'three'
import { applyTilt, canvasTex, createStage, labelTex, radialTex } from './stage3d'

/**
 * Custom AI development as a build site.
 *
 * A blueprint baseplate with drawn plans and dimension lines; on it the
 * customer's solution is stacked as engineered layers —
 *   Data (storage cylinders) · Integrations (plug connectors to outside
 *   systems) · Backend & APIs (server blades) · AI core (glowing model in a
 *   glass case) · Interface (app screens).
 * A gantry crane runs a build loop, carrying a module along its beam and
 * lowering it onto the stack. Service pipes rise through the layers.
 * Scroll: layers separate (exploded architecture), pipes light, reassemble.
 */
export function createBuildScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const S = createStage(canvas, { reducedMotion: opts.reducedMotion, dist: [17, 19], target: [0, 0.95, 0], dolly: 0.3 })
  const { root, track, rbox, phys } = S

  const ceramic = phys({ color: '#edf2f4', roughness: 0.3, clearcoat: 0.9 })
  const navy = phys({ color: '#15334c', metalness: 0.7, roughness: 0.25, clearcoat: 1 })
  const petrol = phys({ color: '#1f5a70', metalness: 0.55, roughness: 0.28, clearcoat: 1 })
  const graphite = phys({ color: '#2a3743', metalness: 0.85, roughness: 0.35 })
  const champ = phys({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  const steel = phys({ color: '#b6c3cb', metalness: 1, roughness: 0.32 })
  const glass = phys({ color: '#cdeef5', transmission: 0.75, thickness: 0.8, roughness: 0.05, transparent: true, opacity: 0.9, clearcoat: 1 })
  const glow = (c: string, i = 1.4) => phys({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 })
  const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    return m
  }

  const base = new THREE.Group()
  const stack = new THREE.Group()
  const crane = new THREE.Group()
  const pipes = new THREE.Group()
  root.add(base, stack, crane, pipes)

  // ── blueprint baseplate ─────────────────────────────
  const bp = new THREE.Mesh(rbox(6.4, 0.16, 4.4, 0.08, 4), [navy, navy, phys({ map: track(blueprintTexture()), roughness: 0.55, clearcoat: 0.4 }), navy, navy, navy])
  bp.position.y = -0.08
  base.add(bp)
  base.add(at(rbox(6.46, 0.03, 4.46, 0.04), champ, 0, -0.17, 0))
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(10, 7)), track(new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(11,32,52,0.42)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.6
  root.add(shadow)
  // drafting instruments on the plate
  const ruler = new THREE.Mesh(rbox(1.6, 0.03, 0.18, 0.02), steel)
  ruler.position.set(-2.3, 0.02, 1.6)
  ruler.rotation.y = 0.3
  base.add(ruler)
  const compass = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.02, 8, 48)), champ)
  compass.rotation.x = Math.PI / 2
  compass.position.set(2.4, 0.02, 1.55)
  base.add(compass)

  // ── the solution stack ───────────────────────────────
  const W = 2.5
  const D = 1.8
  type Layer = { g: THREE.Group; baseY: number; label: THREE.Sprite; glowMat: THREE.MeshPhysicalMaterial }
  const layers: Layer[] = []
  const addLayer = (name: string, sub: string, color: string, h: number, build: (g: THREE.Group) => void) => {
    const g = new THREE.Group()
    const y = layers.length ? layers[layers.length - 1].baseY + 0.5 : 0.02
    const plate = new THREE.Mesh(rbox(W, 0.07, D, 0.05), layers.length % 2 ? petrol : navy)
    plate.position.y = 0.035
    g.add(plate)
    const glowMat = glow(color, 0.2)
    g.add(at(rbox(W + 0.05, 0.028, D + 0.05, 0.03), glowMat, 0, 0.035, 0))
    build(g)
    const label = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex(name, sub, color)), transparent: true, depthWrite: false })))
    label.scale.set(1.55, 0.48, 1)
    label.center.set(1, 0.5)
    label.position.set(-W / 2 - 0.2, 0.12 + h * 0.25, D / 2 + 0.1)
    g.add(label)
    stack.add(g)
    layers.push({ g, baseY: y, label, glowMat })
  }

  addLayer('Data', 'Storage · pipelines', '#7fa7d9', 0.4, (g) => {
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 2; k++) {
        const c = at(track(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 32)), k ? ceramic : phys({ color: '#2c64a0', metalness: 0.4, roughness: 0.3, clearcoat: 1 }), -0.75 + i * 0.75, 0.14 + k * 0.13, 0.1)
        g.add(c)
      }
    }
  })
  addLayer('Integrations', 'CRM · ERP · APIs', '#d5b68a', 0.3, (g) => {
    // connectors reaching to outside systems on both sides
    for (let i = 0; i < 4; i++) {
      const z = -0.6 + i * 0.4
      g.add(at(rbox(0.42, 0.12, 0.18, 0.04), graphite, -W / 2 - 0.1, 0.13, z))
      g.add(at(rbox(0.42, 0.12, 0.18, 0.04), graphite, W / 2 + 0.1, 0.13, z))
      for (let p = 0; p < 3; p++) {
        g.add(at(rbox(0.12, 0.02, 0.025, 0.008), champ, -W / 2 - 0.36, 0.13, z - 0.05 + p * 0.05))
        g.add(at(rbox(0.12, 0.02, 0.025, 0.008), champ, W / 2 + 0.36, 0.13, z - 0.05 + p * 0.05))
      }
    }
    g.add(at(rbox(1.6, 0.05, 0.05, 0.02), champ, 0, 0.11, 0))
  })
  addLayer('Backend & APIs', 'Services · auth · queues', '#93b5e2', 0.35, (g) => {
    for (let i = 0; i < 5; i++) {
      const blade = at(rbox(0.32, 0.24, 1.2, 0.03), graphite, -0.9 + i * 0.45, 0.19, 0)
      g.add(blade)
      g.add(at(rbox(0.2, 0.02, 0.02, 0.005), glow(i % 2 ? '#5cc3be' : '#9ad5e5', 1.2), -0.9 + i * 0.45, 0.24, 0.61))
    }
  })
  let coreMat: THREE.MeshPhysicalMaterial
  addLayer('AI core', 'Models · agents · RAG', '#5cc3be', 0.45, (g) => {
    g.add(at(rbox(0.9, 0.44, 0.9, 0.08), glass, 0, 0.3, 0))
    coreMat = glow('#5cc3be', 1.8)
    const core = at(track(new THREE.IcosahedronGeometry(0.2, 1)), coreMat, 0, 0.3, 0)
    core.name = 'core'
    g.add(core)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      g.add(at(track(new THREE.SphereGeometry(0.06, 14, 14)), i === 0 ? champ : ceramic, Math.cos(a) * 0.85, 0.15, Math.sin(a) * 0.6))
    }
  })
  addLayer('Interface', 'Web · chat · voice', '#9ad5e5', 0.6, (g) => {
    const screenTex = track(uiTexture())
    const screens = [
      { x: -0.55, w: 0.95, h: 0.62, ry: 0.15 },
      { x: 0.55, w: 0.7, h: 0.5, ry: -0.15 },
    ]
    screens.forEach((s) => {
      g.add(at(rbox(s.w + 0.06, s.h + 0.06, 0.05, 0.04), graphite, s.x, 0.12 + s.h / 2, -0.2))
      const face = new THREE.Mesh(track(new THREE.PlaneGeometry(s.w, s.h)), phys({ map: screenTex, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 0.35, roughness: 0.25 }))
      face.position.set(s.x, 0.12 + s.h / 2, -0.172)
      g.add(face)
    })
    g.add(at(rbox(0.18, 0.34, 0.03, 0.04), graphite, 0.95, 0.29, 0.45))
    g.add(at(track(new THREE.PlaneGeometry(0.15, 0.3)), glow('#9ad5e5', 0.5), 0.95, 0.29, 0.467))
  })

  // ── service pipes through the stack ──────────────────────
  const pipeMat = phys({ color: '#8aa3b4', metalness: 0.9, roughness: 0.25, emissive: '#5cc3be', emissiveIntensity: 0 })
  const pipeMeshes = [
    [-W / 2 + 0.15, -D / 2 + 0.15],
    [W / 2 - 0.15, -D / 2 + 0.15],
    [W / 2 - 0.15, D / 2 - 0.15],
  ].map(([x, z]) => {
    const m = at(track(new THREE.CylinderGeometry(0.035, 0.035, 1, 12)), pipeMat, x, 0, z)
    pipes.add(m)
    return m
  })
  const pipePulse = pipeMeshes.map(() => {
    const p = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 12, 12)), glow('#bff3ff', 2))
    pipes.add(p)
    return p
  })

  // ── gantry crane with build loop ───────────────────────
  const cw = 5.4
  const ch = 3.6
  ;[-1, 1].forEach((sx) => {
    crane.add(at(rbox(0.16, ch, 0.16, 0.04), champ, (sx * cw) / 2, ch / 2, -1.6))
    crane.add(at(rbox(0.5, 0.1, 0.5, 0.04), navy, (sx * cw) / 2, 0.05, -1.6))
    const brace = at(rbox(0.06, 1.6, 0.06, 0.02), steel, (sx * cw) / 2, ch * 0.62, -1.6)
    brace.rotation.z = sx * 0.5
    crane.add(brace)
  })
  crane.add(at(rbox(cw + 0.3, 0.2, 0.22, 0.05), navy, 0, ch, -1.6))
  const trolley = new THREE.Group()
  trolley.position.set(0, ch - 0.18, -1.6)
  crane.add(trolley)
  trolley.add(at(rbox(0.42, 0.16, 0.36, 0.04), graphite, 0, 0, 0))
  const arm = at(rbox(0.1, 0.1, 1.7, 0.03), steel, 0, -0.05, 0.85)
  trolley.add(arm)
  const cable = at(track(new THREE.CylinderGeometry(0.012, 0.012, 1, 6)), steel, 0, 0, 1.6)
  trolley.add(cable)
  const hook = new THREE.Group()
  hook.position.set(0, 0, 1.6)
  trolley.add(hook)
  hook.add(at(track(new THREE.TorusGeometry(0.07, 0.018, 8, 20, Math.PI * 1.4)), champ, 0, 0.05, 0))
  const cargoMat = glow('#5cc3be', 0.6)
  const cargo = at(rbox(0.8, 0.36, 0.6, 0.07), petrol, 0, -0.25, 0)
  hook.add(cargo)
  hook.add(at(rbox(0.82, 0.03, 0.62, 0.02), cargoMat, 0, -0.06, 0))
  const craneLabel = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(labelTex('We build it', 'Architect · build · deploy', '#d5b68a')), transparent: true, depthWrite: false })))
  craneLabel.scale.set(2, 0.62, 1)
  craneLabel.center.set(0.5, 0)
  craneLabel.position.set(0, ch + 0.25, -1.6)
  crane.add(craneLabel)

  // ── frame ─────────────────────────────────────────
  S.setFrame((s) => {
    applyTilt(root, s, 0.38)
    const e = s.e
    base.position.y = -0.35 * e
    crane.position.y = 0.25 * e
    layers.forEach((L, i) => {
      L.g.position.y = L.baseY + e * i * 0.42 + (s.reduced ? 0 : Math.sin(s.time * 1 + i) * 0.012 * (1 + e))
      L.glowMat.emissiveIntensity = 0.2 + s.hl * 1.4
    })
    stack.position.x = s.px * 0.08
    const top = layers[layers.length - 1].g.position.y + 0.6
    pipeMeshes.forEach((m, i) => {
      m.scale.y = top
      m.position.y = top / 2
      m.position.x = (i === 0 ? -W / 2 + 0.15 : W / 2 - 0.15) + stack.position.x
      const t = s.reduced ? 0.5 : (s.time * 0.45 + i * 0.33) % 1
      pipePulse[i].position.set(m.position.x, t * top, m.position.z)
      pipePulse[i].visible = !s.reduced
    })
    pipeMat.emissiveIntensity = 0.1 + s.hl * 1.4
    coreMat.emissiveIntensity = 1.5 + Math.sin(s.time * 2.6) * 0.35 + s.hl
    const core = layers[3].g.getObjectByName('core')
    if (core && !s.reduced) core.rotation.y = s.time * 0.8

    // crane loop: travel in → lower → release → raise → return
    const T = 6
    const u = s.reduced ? 0.45 : (s.time % T) / T
    const sm = (a: number, b: number) => {
      const x = Math.min(1, Math.max(0, (u - a) / (b - a)))
      return x * x * (3 - 2 * x)
    }
    const travel = sm(0, 0.25) - sm(0.72, 0.95)
    const lower = sm(0.25, 0.45) - sm(0.55, 0.72)
    trolley.position.x = -2.1 + travel * 2.1 + stack.position.x * travel
    const drop = 0.4 + lower * Math.max(0.3, ch - (top + 0.4) - 0.6)
    cable.scale.y = drop
    cable.position.y = -drop / 2
    hook.position.y = -drop
    const carrying = u < 0.5 || u > 0.97
    cargo.visible = carrying
    cargoMat.emissiveIntensity = carrying ? 0.6 : 0
    layers[layers.length - 1].glowMat.emissiveIntensity += u > 0.48 && u < 0.6 ? 1.2 : 0
    shadow.scale.setScalar(1 - e * 0.05)
  })

  return S.api
}

function blueprintTexture() {
  return canvasTex(1280, 880, (g) => {
    g.fillStyle = '#17475b'
    g.fillRect(0, 0, 1280, 880)
    g.strokeStyle = 'rgba(154,213,229,0.12)'
    g.lineWidth = 1
    for (let x = 0; x <= 1280; x += 32) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, 880)
      g.stroke()
    }
    for (let y = 0; y <= 880; y += 32) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(1280, y)
      g.stroke()
    }
    g.strokeStyle = 'rgba(234,241,244,0.55)'
    g.lineWidth = 3
    g.strokeRect(390, 260, 500, 360)
    g.setLineDash([12, 10])
    g.strokeRect(360, 230, 560, 420)
    g.setLineDash([])
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(390, 680)
    g.lineTo(890, 680)
    g.moveTo(390, 670)
    g.lineTo(390, 690)
    g.moveTo(890, 670)
    g.lineTo(890, 690)
    g.stroke()
    g.fillStyle = 'rgba(234,241,244,0.7)'
    g.font = '600 26px "IBM Plex Mono", monospace'
    g.fillText('2500', 610, 716)
    g.fillText('SOLUTION ARCHITECTURE · REV 3', 60, 70)
    g.fillStyle = 'rgba(213,182,138,0.85)'
    g.fillText('EK भारत.AI', 60, 830)
    g.strokeStyle = 'rgba(154,213,229,0.4)'
    g.beginPath()
    g.arc(1110, 700, 90, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(1020, 700)
    g.lineTo(1200, 700)
    g.moveTo(1110, 610)
    g.lineTo(1110, 790)
    g.stroke()
  })
}

function uiTexture() {
  return canvasTex(400, 260, (g) => {
    g.fillStyle = '#f2f6f8'
    g.fillRect(0, 0, 400, 260)
    g.fillStyle = '#102a40'
    g.fillRect(0, 0, 400, 34)
    g.fillStyle = '#d5b68a'
    g.fillRect(14, 12, 40, 10)
    g.fillStyle = '#c9dce4'
    g.beginPath()
    g.roundRect(20, 54, 210, 34, 17)
    g.fill()
    g.fillStyle = '#38a6a2'
    g.beginPath()
    g.roundRect(150, 102, 230, 34, 17)
    g.fill()
    g.fillStyle = '#c9dce4'
    g.beginPath()
    g.roundRect(20, 150, 250, 34, 17)
    g.fill()
    g.fillStyle = '#102a40'
    g.beginPath()
    g.roundRect(20, 206, 360, 36, 10)
    g.fill()
  })
}
