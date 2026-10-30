import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * A GPU accelerator card in an exploded technical view:
 * PCB with traces + gold edge connector → package substrate, die and HBM
 * stacks → vapour-chamber plate → finned heatsink.
 * Cursor tilts the assembly; scroll separates the layers.
 */
export function createGpuScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  renderer.setClearColor(0x000000, 0)

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  const target = new THREE.Vector3(0, 0.75, 0)

  scene.add(new THREE.HemisphereLight('#cfeff5', '#0b2034', 0.6))
  const key = new THREE.DirectionalLight('#ffffff', 1.4)
  key.position.set(4, 8, 5)
  scene.add(key)
  const teal = new THREE.PointLight('#5cc3be', 6, 6)
  teal.position.set(0, 0.6, 0)
  scene.add(teal)
  const rim = new THREE.DirectionalLight('#9ad5e5', 1.2)
  rim.position.set(-6, 2, -4)
  scene.add(rim)

  const trash: { dispose(): void }[] = [env, pmrem]
  const t = <T extends { dispose(): void }>(x: T) => {
    trash.push(x)
    return x
  }
  const rbox = (w: number, h: number, d: number, r = 0.04) => t(new RoundedBoxGeometry(w, h, d, 4, r))
  const std = (p: THREE.MeshPhysicalMaterialParameters) => t(new THREE.MeshPhysicalMaterial(p))

  const root = new THREE.Group()
  scene.add(root)

  // ── PCB ───────────────────────────────────────
  const pcb = new THREE.Group()
  root.add(pcb)
  pcb.add(new THREE.Mesh(rbox(4.4, 0.12, 2.7, 0.06), std({ color: '#123a50', metalness: 0.3, roughness: 0.45, clearcoat: 0.6 })))
  const traceMat = std({ color: '#2b6f86', emissive: '#38a6a2', emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.4 })
  const traces: THREE.Vector3[][] = []
  for (let i = 0; i < 9; i++) {
    const z = -0.9 + i * 0.225
    const pts = [new THREE.Vector3(-2.0, 0.065, z), new THREE.Vector3(-1.1, 0.065, z), new THREE.Vector3(-0.8, 0.065, z * 0.5)]
    traces.push(pts)
    const len = pts[0].distanceTo(pts[1])
    const seg = new THREE.Mesh(t(new THREE.BoxGeometry(len, 0.01, 0.03)), traceMat)
    seg.position.set((pts[0].x + pts[1].x) / 2, 0.065, z)
    pcb.add(seg)
    const seg2 = new THREE.Mesh(t(new THREE.BoxGeometry(pts[1].distanceTo(pts[2]), 0.01, 0.03)), traceMat)
    seg2.position.copy(pts[1]).add(pts[2]).multiplyScalar(0.5)
    seg2.rotation.y = -Math.atan2(pts[2].z - pts[1].z, pts[2].x - pts[1].x)
    pcb.add(seg2)
  }
  // gold edge connector
  const gold = std({ color: '#d5b68a', metalness: 1, roughness: 0.22 })
  for (let i = 0; i < 18; i++) {
    const f = new THREE.Mesh(rbox(0.12, 0.02, 0.32, 0.01), gold)
    f.position.set(-1.7 + i * 0.2, 0.07, 1.25)
    pcb.add(f)
  }
  // power connector + small components
  const comp = std({ color: '#0b2034', metalness: 0.5, roughness: 0.4 })
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(rbox(0.16, 0.08, 0.16, 0.02), comp)
    c.position.set(1.35 + (i % 2) * 0.3, 0.1, -1.0 + Math.floor(i / 2) * 0.42)
    pcb.add(c)
  }

  // ── package: substrate, die, HBM ───────────────────
  const pkg = new THREE.Group()
  root.add(pkg)
  pkg.add(new THREE.Mesh(rbox(1.7, 0.08, 1.7, 0.04), std({ color: '#1f5a70', metalness: 0.4, roughness: 0.35, clearcoat: 1 })))
  const die = new THREE.Group()
  pkg.add(die)
  die.add(new THREE.Mesh(rbox(0.86, 0.07, 0.86, 0.02), std({ color: '#0b2034', metalness: 0.7, roughness: 0.18, clearcoat: 1 })))
  const coreMat = std({ color: '#5cc3be', emissive: '#5cc3be', emissiveIntensity: 1.2, roughness: 0.3 })
  const core = new THREE.Mesh(rbox(0.5, 0.02, 0.5, 0.01), coreMat)
  core.position.y = 0.045
  die.add(core)
  die.position.y = 0.075
  const hbm: THREE.Mesh[] = []
  const ceramic = std({ color: '#e9f0f2', roughness: 0.3, clearcoat: 0.8 })
  ;[
    [-0.62, 0],
    [0.62, 0],
    [0, -0.62],
    [0, 0.62],
  ].forEach(([x, z]) => {
    const m = new THREE.Mesh(rbox(x ? 0.24 : 0.6, 0.16, x ? 0.6 : 0.24, 0.03), ceramic)
    m.position.set(x, 0.12, z)
    pkg.add(m)
    hbm.push(m)
  })

  // ── vapour chamber + heatsink ─────────────────────
  const plate = new THREE.Mesh(rbox(3.4, 0.07, 2.3, 0.05), std({ color: '#d5b68a', metalness: 1, roughness: 0.28 }))
  root.add(plate)
  const sink = new THREE.Group()
  root.add(sink)
  sink.add(new THREE.Mesh(rbox(3.4, 0.08, 2.3, 0.05), std({ color: '#b9cdd6', metalness: 0.9, roughness: 0.3 })))
  const finMat = std({ color: '#cfdde3', metalness: 0.95, roughness: 0.25 })
  for (let i = 0; i < 24; i++) {
    const fin = new THREE.Mesh(t(new THREE.BoxGeometry(0.035, 0.55, 2.1)), finMat)
    fin.position.set(-1.6 + i * 0.139, 0.31, 0)
    sink.add(fin)
  }
  // heat pipes
  const pipeMat = std({ color: '#d5b68a', metalness: 1, roughness: 0.2 })
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(t(new THREE.CylinderGeometry(0.045, 0.045, 3.6, 16)), pipeMat)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(0, 0.2, -0.5 + i * 0.5)
    sink.add(pipe)
  }

  // ── data pulses along traces ──────────────────────
  const pulseGeo = t(new THREE.SphereGeometry(0.035, 12, 12))
  const pulseMat = std({ color: '#9ad5e5', emissive: '#9ad5e5', emissiveIntensity: 2 })
  const pulses = traces.map((pts, i) => {
    const m = new THREE.Mesh(pulseGeo, pulseMat)
    pcb.add(m)
    return { m, curve: new THREE.CatmullRomCurve3(pts), t: (i * 0.13) % 1, s: 0.35 + (i % 3) * 0.12 }
  })

  // soft teal glow on the floor
  const glowTex = t(glowTexture())
  const glow = new THREE.Mesh(t(new THREE.PlaneGeometry(8, 8)), t(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false })))
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -0.4
  root.add(glow)

  // ── interaction ───────────────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let explode = 0
  let explodeT = 0
  let w = 1
  let h = 1
  const resize = () => {
    const p = canvas.parentElement!
    w = p.clientWidth
    h = p.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const d = w < 500 ? 12.5 : 10.5
    camera.position.set(d * 0.55, d * 0.5, d * 0.68)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas.parentElement!)

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    pointer.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
  }
  const onScroll = () => {
    const r = canvas.getBoundingClientRect()
    const vh = window.innerHeight
    // 0 when the card sits in its resting position, 1 as it scrolls toward the top
    explodeT = Math.max(0, Math.min(1, (vh * 0.55 - (r.top + r.height / 2)) / (vh * 0.45) + 0.35))
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  let last = performance.now()
  let time = 0
  let raf = 0
  let running = false
  const v = new THREE.Vector3()

  const frame = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!opts.reducedMotion) time += dt
    explode += (explodeT - explode) * (opts.reducedMotion ? 1 : Math.min(1, dt * 5))
    const e = explode

    pcb.position.y = 0
    pkg.position.y = 0.06 + e * 0.35
    hbm.forEach((m, i) => (m.position.y = 0.12 + e * (0.18 + (i % 2) * 0.06)))
    die.position.y = 0.075 + e * 0.32
    plate.position.y = 0.42 + e * 0.7
    sink.position.y = 0.5 + e * 1.1
    coreMat.emissiveIntensity = 1 + Math.sin(time * 2.2) * 0.35 + e * 0.6
    teal.intensity = 4 + e * 6

    pulses.forEach((p) => {
      p.t = (p.t + p.s * dt) % 1
      p.curve.getPointAt(p.t, v)
      p.m.position.copy(v).setY(0.08)
    })

    pointer.x += (pointer.tx - pointer.x) * 0.06
    pointer.y += (pointer.ty - pointer.y) * 0.06
    root.rotation.y = -0.35 + pointer.x * 0.45 + e * 0.35 + (opts.reducedMotion ? 0 : Math.sin(time * 0.3) * 0.06)
    root.rotation.x = pointer.y * 0.18
    root.position.y = opts.reducedMotion ? 0 : Math.sin(time * 0.8) * 0.05

    renderer.render(scene, camera)
    if (running) raf = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (opts.reducedMotion) return frame()
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      trash.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(92,195,190,0.35)')
  grd.addColorStop(0.5, 'rgba(56,166,162,0.1)')
  grd.addColorStop(1, 'rgba(56,166,162,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
