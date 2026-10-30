import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export interface HeroSceneOptions {
  reducedMotion: boolean
  compact: boolean
  /** DOM labels that follow anchors: [core, ...satellites] */
  labels: (HTMLElement | null)[]
}

const C = {
  surface: '#f6f8fa',
  stratum1: '#e3eaf0',
  stratum2: '#cfdbe5',
  blue: '#2f7fa8',
  deepBlue: '#2c64a0',
  teal: '#2e8d81',
  saffron: '#e3a957',
  conduit: '#8fa5b8',
  navy: '#182b3d',
}

/**
 * Hero object: a stratified compute platform (the foundation) with an
 * accelerator die on top, connected to four floating capability modules
 * — models, agents, workflows, data — by conduits carrying data pulses.
 * Lit with soft physically-based lighting for a light, premium surface.
 */
export function createHeroScene(canvas: HTMLCanvasElement, opts: HeroSceneOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.compact ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  const target = new THREE.Vector3(0.9, 0.9, -0.4)

  scene.add(new THREE.HemisphereLight('#ffffff', '#9fb2c4', 1.5))
  const key = new THREE.DirectionalLight('#ffffff', 2.3)
  key.position.set(6, 11, 7)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#8cc6e0', 1.3)
  rim.position.set(-9, 3, -6)
  scene.add(rim)
  const warm = new THREE.DirectionalLight('#f3d3a6', 0.45)
  warm.position.set(8, 1, -4)
  scene.add(warm)

  const root = new THREE.Group()
  scene.add(root)
  const disposables: { dispose(): void }[] = []
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.06, ...extra })
    disposables.push(m)
    return m
  }
  const rbox = (w: number, h: number, d: number, r: number) => {
    const g = new RoundedBoxGeometry(w, h, d, 4, r)
    disposables.push(g)
    return g
  }

  // ── Foundation: three strata + accent seams ─────────────────
  const platform = new THREE.Group()
  root.add(platform)
  platform.add(new THREE.Mesh(rbox(4.4, 0.42, 4.4, 0.16), mat(C.surface, { roughness: 0.42 })))
  const s1 = new THREE.Mesh(rbox(4.0, 0.36, 4.0, 0.14), mat(C.stratum1))
  s1.position.y = -0.52
  platform.add(s1)
  const s2 = new THREE.Mesh(rbox(3.5, 0.32, 3.5, 0.12), mat(C.stratum2))
  s2.position.y = -0.98
  platform.add(s2)
  const seam1 = new THREE.Mesh(rbox(4.06, 0.035, 4.06, 0.015), mat(C.teal, { emissive: C.teal, emissiveIntensity: 0.55 }))
  seam1.position.y = -0.27
  platform.add(seam1)
  const seam2 = new THREE.Mesh(rbox(3.56, 0.035, 3.56, 0.015), mat(C.saffron, { emissive: C.saffron, emissiveIntensity: 0.35 }))
  seam2.position.y = -0.76
  platform.add(seam2)

  // accelerator die on top of the platform
  const dies: { mesh: THREE.Mesh; active: boolean; phase: number }[] = []
  const dieGeo = rbox(0.74, 0.22, 0.74, 0.07)
  const tint = [C.blue, C.teal, C.deepBlue]
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) - 1.5
    const z = Math.floor(i / 4) - 1.5
    const active = [1, 6, 9, 14, 4].includes(i)
    const color = i === 4 ? C.saffron : active ? tint[i % 3] : '#ffffff'
    const m = new THREE.Mesh(dieGeo, mat(color, active ? { emissive: color, emissiveIntensity: 0.18 } : { roughness: 0.35 }))
    m.position.set(x * 0.94, 0.32, z * 0.94)
    platform.add(m)
    dies.push({ mesh: m, active, phase: Math.random() * Math.PI * 2 })
  }

  // ── Satellite modules ───────────────────────────────
  const satDefs = [
    { angle: -0.35, r: 4.7, y: 2.3, color: C.blue }, // models
    { angle: 1.25, r: 4.5, y: 1.25, color: C.teal }, // agents
    { angle: 2.75, r: 4.6, y: 2.75, color: C.saffron }, // workflows
    { angle: 4.35, r: 4.4, y: 1.6, color: C.deepBlue }, // data & knowledge
  ]
  const satGeo = rbox(1.5, 0.38, 1.5, 0.13)
  const capGeo = rbox(1.08, 0.07, 1.08, 0.03)
  const nubGeo = new THREE.SphereGeometry(0.075, 16, 16)
  disposables.push(nubGeo)
  const sats = satDefs.map((d, i) => {
    const g = new THREE.Group()
    g.position.set(Math.cos(d.angle) * d.r, d.y, Math.sin(d.angle) * d.r)
    const inner = new THREE.Group()
    g.add(inner)
    inner.add(new THREE.Mesh(satGeo, mat('#ffffff', { roughness: 0.35 })))
    const cap = new THREE.Mesh(capGeo, mat(d.color, { emissive: d.color, emissiveIntensity: 0.22 }))
    cap.position.y = 0.22
    inner.add(cap)
    for (let k = 0; k < 4; k++) {
      const nub = new THREE.Mesh(nubGeo, mat(k === i ? C.saffron : '#ffffff'))
      nub.position.set(((k % 2) - 0.5) * 0.5, 0.3, (Math.floor(k / 2) - 0.5) * 0.5)
      inner.add(nub)
    }
    root.add(g)
    return { group: g, inner, def: d, phase: i * 1.3 }
  })

  // ── Conduits with pulses ────────────────────────────
  const conduitMat = mat(C.conduit, { roughness: 0.6 })
  const pulseGeo = new THREE.SphereGeometry(0.075, 16, 16)
  disposables.push(pulseGeo)
  const pulses: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; t: number; speed: number }[] = []
  sats.forEach((s) => {
    const dir = new THREE.Vector3(s.group.position.x, 0, s.group.position.z).normalize()
    const start = dir.clone().multiplyScalar(2.15).setY(0.12)
    const end = s.group.position.clone().setY(s.group.position.y - 0.2)
    const mid = dir.clone().multiplyScalar(3.6).setY((start.y + end.y) / 2 - 0.35)
    const curve = new THREE.CatmullRomCurve3([start, mid, end])
    const tube = new THREE.TubeGeometry(curve, 48, 0.024, 8, false)
    disposables.push(tube)
    root.add(new THREE.Mesh(tube, conduitMat))
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(pulseGeo, mat(s.def.color, { emissive: s.def.color, emissiveIntensity: 0.9 }))
      root.add(m)
      pulses.push({ mesh: m, curve, t: k * 0.5, speed: 0.22 + Math.random() * 0.08 })
    }
  })

  // orbit hairline at platform level
  const ringGeo = new THREE.TorusGeometry(3.25, 0.008, 6, 160)
  disposables.push(ringGeo)
  const ring = new THREE.Mesh(ringGeo, mat(C.navy, { transparent: true, opacity: 0.25 }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.2
  root.add(ring)

  // contact shadow
  const shadowTex = radialTexture()
  disposables.push(shadowTex)
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  disposables.push(shadowMat)
  const shadowGeo = new THREE.PlaneGeometry(13, 13)
  disposables.push(shadowGeo)
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.5
  root.add(shadow)

  // label anchors: core corner + satellites
  const coreAnchor = new THREE.Object3D()
  coreAnchor.position.set(2.2, -0.6, 2.2)
  root.add(coreAnchor)
  const anchors = [coreAnchor, ...sats.map((s) => s.group)]

  // ── State ───────────────────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let scroll = 0
  let width = 1
  let height = 1

  const resize = () => {
    const parent = canvas.parentElement!
    width = parent.clientWidth
    height = parent.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const dist = width < 640 ? 27 : 25
    if (width < 1024) target.set(0, 0.6, 0)
    else target.set(0.9, 0.9, -0.4)
    camera.position.set(dist * 0.55, dist * 0.42, dist * 0.72)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas.parentElement!)

  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onScroll = () => (scroll = Math.min(1, window.scrollY / (window.innerHeight * 0.9)))
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
  let last = performance.now()
  let elapsed = opts.reducedMotion ? 10 : 0
  let raf = 0
  let running = false
  const v = new THREE.Vector3()

  const updateLabels = (alpha: number) => {
    anchors.forEach((a, i) => {
      const el = opts.labels[i]
      if (!el) return
      a.getWorldPosition(v)
      v.project(camera)
      const x = (v.x * 0.5 + 0.5) * width
      const y = (-v.y * 0.5 + 0.5) * height
      const inside = x > 30 && x < width - 180 && y > 30 && y < height - 30
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = inside ? String(Math.max(0, alpha * (1 - scroll * 1.4))) : '0'
    })
  }

  const frame = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!opts.reducedMotion) elapsed += dt
    const t = elapsed

    // assembly on load: strata, die, then satellites
    platform.position.y = -0.6 * (1 - ease(t / 1.2))
    dies.forEach((d, i) => {
      const k = ease((t - 0.35 - i * 0.035) / 0.6)
      d.mesh.scale.setScalar(Math.max(0.001, k))
      d.mesh.position.y = 0.32 + (d.active && !opts.reducedMotion ? Math.max(0, Math.sin(t * 1.4 + d.phase)) * 0.12 : 0)
    })
    sats.forEach((s, i) => {
      const k = ease((t - 0.9 - i * 0.15) / 0.8)
      s.group.scale.setScalar(Math.max(0.001, k))
      s.inner.position.y = opts.reducedMotion ? 0 : Math.sin(t * 0.8 + s.phase) * 0.08
    })
    const linkIn = ease((t - 1.6) / 0.6)
    pulses.forEach((p) => {
      if (!opts.reducedMotion) p.t = (p.t + p.speed * dt) % 1
      p.curve.getPointAt(p.t, v)
      p.mesh.position.copy(v)
      p.mesh.scale.setScalar(Math.max(0.001, linkIn * (0.6 + Math.sin(p.t * Math.PI) * 0.6)))
    })

    pointer.x += (pointer.tx - pointer.x) * 0.05
    pointer.y += (pointer.ty - pointer.y) * 0.05
    root.rotation.y = -0.35 + Math.sin(t * 0.12) * 0.12 + pointer.x * 0.22
    root.rotation.x = pointer.y * 0.05
    root.position.y = width >= 1024 ? scroll * 1.4 : 0

    renderer.render(scene, camera)
    updateLabels(Math.min(1, Math.max(0, (t - 1.8) / 0.6)))
    if (running) raf = requestAnimationFrame(frame)
  }

  const start = () => {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    start: () => (opts.reducedMotion ? frame() : start()),
    stop,
    dispose() {
      stop()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
    },
  }
}

function radialTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(24,43,61,0.26)')
  grd.addColorStop(0.45, 'rgba(24,43,61,0.1)')
  grd.addColorStop(1, 'rgba(24,43,61,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}
