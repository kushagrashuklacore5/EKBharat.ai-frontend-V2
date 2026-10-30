import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Shared base for the product 3D scenes: transparent renderer with studio
 * environment lighting, a cursor-following light, inertial pointer state,
 * scroll progress mapped to a four-stage story, visibility-aware render loop.
 *
 * Story values passed to each frame:
 *   e  — exploded amount  (0 assembled → 1 separated → 0 reassembled)
 *   hl — highlight amount (architecture reveal, mid-story)
 */
export interface FrameState {
  dt: number
  time: number
  e: number
  hl: number
  px: number
  py: number
  reduced: boolean
}

export interface StageOptions {
  reducedMotion: boolean
  /** camera distance on desktop / mobile */
  dist: [number, number]
  target: [number, number, number]
  /** extra camera pull-back while exploded (fraction) */
  dolly?: number
}

export type SceneApi = { setVisible(v: boolean): void; dispose(): void }

export function createStage(canvas: HTMLCanvasElement, opts: StageOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  scene.environment = env

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  const target = new THREE.Vector3(...opts.target)
  const baseTargetY = target.y

  scene.add(new THREE.HemisphereLight('#eef7fb', '#9db6c3', 0.55))
  const key = new THREE.DirectionalLight('#ffffff', 1.5)
  key.position.set(4, 9, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#9ad5e5', 1.1)
  rim.position.set(-7, 3, -5)
  scene.add(rim)
  const warm = new THREE.DirectionalLight('#f1d6ae', 0.5)
  warm.position.set(7, 1, -4)
  scene.add(warm)
  const cursorLight = new THREE.PointLight('#bfefff', 7, 10, 1.6)
  scene.add(cursorLight)

  const trash: { dispose(): void }[] = [env, pmrem]
  const track = <T extends { dispose(): void }>(x: T) => {
    trash.push(x)
    return x
  }
  const rbox = (w: number, h: number, d: number, r = 0.03, seg = 3) => track(new RoundedBoxGeometry(w, h, d, seg, r))
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => track(new THREE.MeshPhysicalMaterial(p))

  const root = new THREE.Group()
  scene.add(root)

  // ── pointer / scroll / size ─────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let progress = 0
  let progressT = 0
  let w = 1
  let h = 1
  let baseDist = opts.dist[0]
  let visible = false
  let running = false
  let raf = 0
  let last = performance.now()
  let time = 0
  let onFrame: (s: FrameState) => void = () => {}

  const resize = () => {
    const p = canvas.parentElement!
    w = p.clientWidth
    h = p.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    baseDist = w < 520 ? opts.dist[1] : opts.dist[0]
    camera.updateProjectionMatrix()
    if (!running) kick()
  }
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    pointer.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
    kick()
  }
  const onScroll = () => {
    const r = canvas.getBoundingClientRect()
    const vh = window.innerHeight
    const pageTop = r.top + window.scrollY - (parseFloat(canvas.parentElement!.dataset.shift || '0') || 0)
    const start = Math.max(0, pageTop - vh * 0.6)
    progressT = Math.max(0, Math.min(1, (window.scrollY - start) / (vh * 0.7)))
    kick()
  }

  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const smooth = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
  }

  const frame = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const reduced = opts.reducedMotion
    if (!reduced) time += dt
    const k = reduced ? 1 : Math.min(1, dt * 4.5)
    progress += (progressT - progress) * k
    const pk = reduced ? 1 : Math.min(1, dt * 3.2)
    pointer.x += (pointer.tx - pointer.x) * pk
    pointer.y += (pointer.ty - pointer.y) * pk

    const p = progress
    const e = smooth(0.12, 0.42, p) * (1 - smooth(0.72, 0.95, p))
    const hl = smooth(0.36, 0.5, p) * (1 - smooth(0.66, 0.78, p))

    const dd = baseDist * (1 + e * (opts.dolly ?? 0.3))
    target.y = baseTargetY + e * 0.35
    camera.position.set(dd * 0.5, dd * 0.52, dd * 0.7)
    camera.lookAt(target)
    cursorLight.position.set(pointer.x * 4, 3.2, -pointer.y * 3 + 1.5)

    onFrame({ dt, time, e, hl, px: pointer.x, py: pointer.y, reduced })
    renderer.render(scene, camera)
    if (running) raf = requestAnimationFrame(frame)
  }

  function kick() {
    if (visible && !running && !document.hidden) start()
  }
  function start() {
    if (opts.reducedMotion) {
      frame()
      return
    }
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function stop() {
    running = false
    cancelAnimationFrame(raf)
  }

  const ro = new ResizeObserver(resize)
  ro.observe(canvas.parentElement!)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  resize()
  onScroll()

  const api: SceneApi = {
    setVisible(v: boolean) {
      visible = v
      if (v && !document.hidden) start()
      else stop()
    },
    dispose() {
      stop()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      trash.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }

  return {
    THREE,
    scene,
    root,
    camera,
    track,
    rbox,
    phys,
    api,
    setFrame(fn: (s: FrameState) => void) {
      onFrame = fn
    },
  }
}

/* ───────────────── shared helpers ───────────────── */

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function radialTex(inner: string, outer: string) {
  return canvasTex(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grd.addColorStop(0, inner)
    grd.addColorStop(0.75, outer)
    grd.addColorStop(1, outer)
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
  })
}

/** A camera-facing label: pill with title (+ optional subtitle). */
export function labelTex(title: string, sub?: string, accent = '#5cc3be') {
  return canvasTex(512, 160, (g) => {
    g.font = '800 54px Manrope, sans-serif'
    const tw = Math.max(g.measureText(title).width, sub ? (g.font = '600 34px Manrope, sans-serif', g.measureText(sub).width) : 0)
    const W = Math.min(500, tw + 92)
    const x = (512 - W) / 2
    g.fillStyle = 'rgba(242,246,247,0.94)'
    g.beginPath()
    g.roundRect(x, 14, W, sub ? 132 : 92, 26)
    g.fill()
    g.fillStyle = accent
    g.beginPath()
    g.arc(x + 34, sub ? 58 : 60, 9, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#102a40'
    g.font = '800 54px Manrope, sans-serif'
    g.textBaseline = 'middle'
    g.fillText(title, x + 56, sub ? 58 : 60)
    if (sub) {
      g.fillStyle = '#4d6679'
      g.font = '600 34px Manrope, sans-serif'
      g.fillText(sub, x + 56, 110)
    }
  })
}

/** Gentle tilt/float shared by scenes. */
export function applyTilt(root: THREE.Object3D, s: FrameState, baseY = -0.42) {
  root.rotation.y = baseY + s.px * 0.32 + (s.reduced ? 0 : Math.sin(s.time * 0.35) * 0.05) + s.e * 0.12
  root.rotation.x = s.py * 0.12
  root.rotation.z = -s.px * 0.025
  root.position.y = s.reduced ? 0 : Math.sin(s.time * 0.9) * 0.05
}
