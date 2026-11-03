import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { buildGpuAssembly, canvasTex, mulberry, route, traceGeometry, traceMaterial, type Keep, type TracePath } from './gpuAssembly'

/**
 * Tech prelude for the brand reveal: one continuous camera move from a
 * silicon wafer, to a data-centre GPU card shown as an engineering exploded
 * view (backplate → PCB → power stage → GPU package → memory → thermal
 * interface → cold plate → heat pipes → heatsink), to the board's traces
 * carrying data to other compute nodes. Everything is a function of `t`
 * (0..1 scroll progress) plus a slow clock, so reverse scrolling plays it
 * backwards. A light cursor parallax sits on top of the camera move.
 */

const GPU = new THREE.Vector3(14, 0, -6)
const CARD_Y = 2.4
const CARD_SCALE = 0.5

export function createTechScene(env: THREE.Texture, T: Keep) {
  // lighter build for weaker machines: fewer parts, smaller textures, no shadow maps
  const low = (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 4

  const scene = new THREE.Scene()
  scene.environment = env
  const key = new THREE.DirectionalLight('#fff3e2', 2.6)
  key.position.set(GPU.x - 10, 18, GPU.z + 12)
  key.target.position.copy(GPU)
  scene.add(key, key.target)
  if (!low) {
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = key.shadow.camera.bottom = -11
    key.shadow.camera.right = key.shadow.camera.top = 11
    key.shadow.camera.near = 2
    key.shadow.camera.far = 60
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
  }
  const rim = new THREE.DirectionalLight('#7fd6dc', 1.8) // controlled teal reflection
  rim.position.set(GPU.x + 12, 6, GPU.z - 16)
  scene.add(rim)
  const warm = new THREE.PointLight('#ffb168', 22, 34) // restrained saffron highlight
  warm.position.set(GPU.x - 8, 5, GPU.z + 6)
  scene.add(warm)
  scene.add(new THREE.HemisphereLight('#eef4f8', '#7d8a94', 0.8))

  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => T(new THREE.MeshPhysicalMaterial(p))
  const rbox = (w: number, h: number, d: number, r = 0.03) => T(new RoundedBoxGeometry(w, h, d, 3, r))
  const shadowTex = T(blobTexture())
  const blob = (size: number, o: number) => {
    const m = new THREE.Mesh(T(new THREE.PlaneGeometry(size, size)), T(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: o, depthWrite: false })))
    m.rotation.x = -Math.PI / 2
    m.position.y = -0.02
    return m
  }

  // ───────────── silicon wafer ─────────────
  const wafer = new THREE.Group()
  const wTop = new THREE.Mesh(
    T(new THREE.CircleGeometry(6, 128)),
    phys({ map: T(waferTexture()), metalness: 0.9, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15, iridescence: 0.55, iridescenceIOR: 1.6 }),
  )
  wTop.rotation.x = -Math.PI / 2
  wTop.position.y = 0.061
  const wEdge = new THREE.Mesh(T(new THREE.CylinderGeometry(6, 6, 0.12, 128, 1, true)), phys({ color: '#b9c2ca', metalness: 1, roughness: 0.28 }))
  wafer.add(wTop, wEdge, blob(15, 0.35))
  scene.add(wafer)

  // ───────────── the GPU card, suspended over the board ─────────────
  const gpu = buildGpuAssembly(T, low)
  const pivot = new THREE.Group() // rotates about the card centre
  pivot.position.set(GPU.x, CARD_Y, GPU.z)
  gpu.group.scale.setScalar(CARD_SCALE)
  pivot.add(gpu.group)
  scene.add(pivot)
  const cardShadow = blob(17, 0.42)
  cardShadow.scale.set(1.25, 0.75, 1)
  cardShadow.position.set(GPU.x, -0.01, GPU.z)
  scene.add(cardShadow)

  // smaller compute nodes the traces connect to
  const pcbMat = phys({ map: T(boardTexture()), metalness: 0.35, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35 })
  const nodeGeo = rbox(1.6, 0.14, 1.6, 0.04)
  const nodeDie = rbox(0.8, 0.08, 0.8, 0.01)
  const nodeDieMat = phys({ color: '#4a5866', metalness: 0.95, roughness: 0.18, iridescence: 0.5 })
  const NODES = [
    new THREE.Vector3(GPU.x + 13, 0, GPU.z - 9),
    new THREE.Vector3(GPU.x - 11, 0, GPU.z - 12),
    new THREE.Vector3(GPU.x + 15, 0, GPU.z + 7),
    new THREE.Vector3(GPU.x - 2, 0, GPU.z - 19),
    new THREE.Vector3(GPU.x + 3, 0, GPU.z + 13),
  ]
  NODES.forEach((p) => {
    const n = new THREE.Group()
    const b = new THREE.Mesh(nodeGeo, pcbMat)
    b.position.y = 0.07
    const d = new THREE.Mesh(nodeDie, nodeDieMat)
    d.position.y = 0.18
    n.add(b, d, blob(3.4, 0.3))
    n.position.copy(p)
    scene.add(n)
  })

  // ───────────── board traces with data pulses ─────────────
  const rnd = mulberry(31)
  const paths: TracePath[] = []
  const bus = (from: THREE.Vector3, to: THREE.Vector3, count: number, spacing: number) => {
    const dir = to.clone().sub(from).setY(0).normalize()
    const nrm = new THREE.Vector3(-dir.z, 0, dir.x)
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * spacing
      paths.push({ pts: route(from.clone().addScaledVector(nrm, o), to.clone().addScaledVector(nrm, o * 0.6), 0.85), hot: rnd() > 0.78 ? 1 : 0 })
    }
  }
  NODES.forEach((n) => {
    const d = n.clone().sub(GPU).setY(0).normalize()
    bus(GPU.clone().addScaledVector(d, 3.2), n.clone().addScaledVector(d, -0.9), 5, 0.16)
  })
  bus(new THREE.Vector3(5.6, 0, -1.6), GPU.clone().add(new THREE.Vector3(-6.8, 0, 0.6)), 6, 0.16)
  // fine fan-out traces leaving the card's footprint
  for (let i = 0; i < 46; i++) {
    const side = i % 4
    const k = (rnd() - 0.5) * 5
    const s = side === 0 ? new THREE.Vector3(6.6, 0, k * 0.6) : side === 1 ? new THREE.Vector3(-6.6, 0, k * 0.6) : side === 2 ? new THREE.Vector3(k * 2, 0, 2.9) : new THREE.Vector3(k * 2, 0, -2.9)
    const out = side === 0 ? new THREE.Vector3(1, 0, 0) : side === 1 ? new THREE.Vector3(-1, 0, 0) : side === 2 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1)
    const a = s.add(GPU)
    const p1 = a.clone().addScaledVector(out, 1 + rnd() * 3)
    const turn = new THREE.Vector3(out.z, 0, -out.x).multiplyScalar(rnd() > 0.5 ? 1 : -1)
    const l2 = 1 + rnd() * 3
    const p2 = p1.clone().addScaledVector(out, l2 * 0.7).addScaledVector(turn, l2 * 0.7)
    paths.push({ pts: [a, p1, p2, p2.clone().addScaledVector(out, 2 + rnd() * 9)], hot: rnd() > 0.78 ? 1 : 0 })
  }
  const traceMat = T(traceMaterial())
  const traces = new THREE.Mesh(T(traceGeometry(paths, 0.045, 0.012, rnd)), traceMat)
  traces.frustumCulled = false
  traces.renderOrder = -1
  scene.add(traces)

  // ───────────── one continuous camera journey ─────────────
  // keyframes are evenly spaced in t (parametric), camera and target paired
  const V = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2])
  const camPath = new THREE.CatmullRomCurve3(
    [
      [-11, 7.5, 13], // wafer, wide
      [-6, 4.2, 7.5],
      [-2, 2.6, 3.6], // gliding over the dies
      [2.5, 6.5, 10],
      [5.5, 7, 9.5], // the assembled card, three-quarter view
      [1.5, 10.5, 11.5], // layers separate
      [4, 9, 9.5], // orbit around the exploded stack
      [10.2, 5, -0.4], // in close, between the layers, at the die
      [7.5, 8.5, 6], // reassembling
      [14.5, 15, 5],
      [GPU.x + 1, 27, GPU.z + 8], // top-down over the board traces
    ].map(V),
    false,
    'centripetal',
  )
  const lookPath = new THREE.CatmullRomCurve3(
    [
      [0, 0, 0],
      [0.3, 0, -0.4],
      [1.5, 0, -1.6],
      [10, 2, -5],
      [GPU.x, CARD_Y + 0.4, GPU.z],
      [GPU.x, CARD_Y + 2.6, GPU.z],
      [GPU.x, CARD_Y + 2.6, GPU.z],
      [GPU.x - 1, CARD_Y + 1.9, GPU.z],
      [GPU.x, CARD_Y + 1.2, GPU.z],
      [GPU.x, 1, GPU.z - 2],
      [GPU.x, 0, GPU.z - 3],
    ].map(V),
    false,
    'centripetal',
  )

  // cursor parallax (eased), layered on top of the scripted camera
  const mouse = new THREE.Vector2()
  const par = new THREE.Vector2()
  const onPointer = (ev: PointerEvent) => mouse.set((ev.clientX / window.innerWidth) * 2 - 1, (ev.clientY / window.innerHeight) * 2 - 1)
  window.addEventListener('pointermove', onPointer, { passive: true })

  const look = new THREE.Vector3()
  const side = new THREE.Vector3()
  const dieW = new THREE.Vector3()
  const closeAt = new THREE.Vector3()
  const CLOSE_OFFSET = new THREE.Vector3(-1.4, 1.25, 2.1)
  let shadowsOn = false
  function render(renderer: THREE.WebGLRenderer, t: number, time: number, aspect: number) {
    if (!low && !shadowsOn) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      shadowsOn = true
    }
    wafer.rotation.y = -0.35 + t * 0.9
    // exploded view: separates, holds while the camera travels through it, reassembles
    const e = smooth01(range(t, 0.4, 0.56)) * (1 - smooth01(range(t, 0.74, 0.86)))
    gpu.update(e, time, range(t, 0.44, 0.58))
    pivot.rotation.y = -0.3 + range(t, 0.3, 0.9) * 0.7 + Math.sin(time * 0.2) * 0.03
    pivot.updateMatrixWorld(true)

    cam.aspect = aspect
    cam.updateProjectionMatrix()
    camPath.getPoint(t, cam.position)
    lookPath.getPoint(t, look)
    // close-up: dip into the gap above the die and look down onto its surface
    const close = smooth01(range(t, 0.6, 0.67)) * (1 - smooth01(range(t, 0.73, 0.79)))
    if (close > 0) {
      gpu.dieWorld(dieW)
      look.lerp(dieW, close)
      cam.position.lerp(closeAt.copy(dieW).add(CLOSE_OFFSET), close)
    }
    par.lerp(mouse, 0.06)
    side.subVectors(look, cam.position).cross(cam.up).normalize()
    cam.position.addScaledVector(side, par.x * 0.6).addScaledVector(cam.up, -par.y * 0.4)
    cam.lookAt(look)

    traceMat.uniforms.uReveal.value = smooth01(range(t, 0.2, 0.8))
    traceMat.uniforms.uFlow.value = time * 0.25 + t * 6 // pulses respond to scroll as well as time
    traceMat.uniforms.uPulse.value = range(t, 0.5, 0.7)
    renderer.render(scene, cam)
  }

  return {
    render,
    dispose() {
      window.removeEventListener('pointermove', onPointer)
    },
  }
}

/* ───────────── procedural textures ───────────── */

/** wafer top: die grid with thin-film tint, edge exclusion ring and notch */
function waferTexture() {
  return canvasTex(2048, 2048, (g) => {
    const C = 1024
    const R = 1024
    g.fillStyle = '#9aa5ae'
    g.beginPath()
    g.arc(C, C, R, 0, Math.PI * 2)
    g.fill()
    g.save()
    g.beginPath()
    g.arc(C, C, R - 34, 0, Math.PI * 2)
    g.clip()
    const cell = 74
    const street = 5
    const r = mulberry(4)
    for (let y = C - 14 * cell; y < C + 14 * cell; y += cell) {
      for (let x = C - 14 * cell; x < C + 14 * cell; x += cell) {
        const cx = x + cell / 2 - C
        const cy = y + cell / 2 - C
        const dist = Math.hypot(cx, cy) / R
        // interference colours shift with radius, like a real patterned wafer
        const hue = 190 + Math.sin(dist * 6 + Math.atan2(cy, cx) * 0.6) * 28
        g.fillStyle = `hsl(${hue}, ${32 + dist * 14}%, ${30 + r() * 5}%)`
        g.fillRect(x + street, y + street, cell - street * 2, cell - street * 2)
        // functional blocks inside each die
        g.fillStyle = 'rgba(210,225,235,0.18)'
        for (let k = 0; k < 4; k++) g.fillRect(x + 10 + k * 14, y + 10, 10, 30)
        g.fillStyle = 'rgba(255,190,120,0.16)'
        g.fillRect(x + 10, y + 46, cell - 20, 6)
        g.strokeStyle = 'rgba(230,240,245,0.22)'
        g.lineWidth = 1
        g.strokeRect(x + street + 3, y + street + 3, cell - street * 2 - 6, cell - street * 2 - 6)
      }
    }
    g.restore()
    // flat notch
    g.fillStyle = '#7b858e'
    g.beginPath()
    g.arc(C, C + R - 6, 14, 0, Math.PI * 2)
    g.fill()
  })
}

/** package substrate: graphite navy laminate, copper traces, gold pads */
function boardTexture() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#16262f'
    g.fillRect(0, 0, 1024, 1024)
    const r = mulberry(12)
    g.lineWidth = 2
    for (let i = 0; i < 220; i++) {
      g.strokeStyle = `rgba(${r() > 0.5 ? '90,170,180' : '200,150,90'},${0.12 + r() * 0.16})`
      const x = r() * 1024
      const y = r() * 1024
      const l = 30 + r() * 140
      g.beginPath()
      g.moveTo(x, y)
      if (r() > 0.5) g.lineTo(x + l, y)
      else g.lineTo(x, y + l)
      g.lineTo(x + l * 0.4 * (r() > 0.5 ? 1 : -1) + l, y + l * 0.4)
      g.stroke()
    }
    g.fillStyle = 'rgba(214,176,108,0.8)'
    for (let k = 20; k < 1004; k += 26) {
      g.fillRect(k, 10, 12, 12)
      g.fillRect(k, 1002, 12, 12)
      g.fillRect(10, k, 12, 12)
      g.fillRect(1002, k, 12, 12)
    }
  })
}

function blobTexture() {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(20,35,48,0.55)')
    grd.addColorStop(0.55, 'rgba(20,35,48,0.18)')
    grd.addColorStop(1, 'rgba(20,35,48,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  })
}

const range = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const smooth01 = (t: number) => t * t * (3 - 2 * t)
