import * as THREE from 'three'
import { MARK_SRC } from '../ui/Logo'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface HeroSceneOptions {
  reducedMotion: boolean
  compact: boolean
  /** called every frame with the screen-space anchor of each layer (+ pedestal) */
  onAnchors?: (pts: { x: number; y: number; visible: boolean }[]) => void
}

/**
 * The Ek भारत.AI computational stack. Bottom → top:
 *   0 GPU Cloud     — petrol metal slab with champagne seam
 *   1 Knowledge     — clear glass
 *   2 Models        — ceramic with model tiles
 *   3 AI Agents     — teal glass with agent nodes
 *   4 Workflows     — navy core plate carrying the Ek भारत.AI mark
 * on a ceramic pedestal (anchor 5 · Custom AI — built across the stack).
 * Layers separate with scroll; a hovered label lifts and lights its layer.
 */
export function createHeroScene(canvas: HTMLCanvasElement, opts: HeroSceneOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.compact ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  scene.background = null
  renderer.setClearColor(0x000000, 0)
  renderer.setClearAlpha(0)

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  const target = new THREE.Vector3(0, 0.55, 0)

  scene.add(new THREE.HemisphereLight('#f4fbff', '#8fb1c2', 0.7))
  const key = new THREE.DirectionalLight('#ffffff', 1.6)
  key.position.set(5, 9, 6)
  scene.add(key)
  const tealRim = new THREE.DirectionalLight('#7fe0d6', 1.4)
  tealRim.position.set(-7, 2, -5)
  scene.add(tealRim)
  const champ = new THREE.DirectionalLight('#f3d2a2', 0.9)
  champ.position.set(7, 0.5, -3)
  scene.add(champ)

  const disposables: { dispose(): void }[] = [envTex, pmrem]
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x)
    return x
  }
  const rbox = (w: number, h: number, d: number, r: number) => track(new RoundedBoxGeometry(w, h, d, 5, r))

  const root = new THREE.Group()
  scene.add(root)

  // ── pedestal ─────────────────────────────────────
  const pedestal = new THREE.Mesh(
    track(new THREE.CylinderGeometry(2.85, 2.95, 0.28, 96)),
    track(new THREE.MeshPhysicalMaterial({ color: '#edf3f5', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 })),
  )
  pedestal.position.y = -1.55
  root.add(pedestal)
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(2.9, 0.022, 12, 160)), track(new THREE.MeshStandardMaterial({ color: '#d5b68a', metalness: 1, roughness: 0.25 })))
  rim.rotation.x = Math.PI / 2
  rim.position.y = -1.41
  root.add(rim)

  // ── layers ──────────────────────────────────────
  type Layer = { group: THREE.Group; mat: THREE.MeshStandardMaterial; glow: THREE.Color }
  const layers: Layer[] = []
  const W = 3.3

  const addLayer = (i: number, h: number, material: THREE.MeshStandardMaterial, glow: string, decorate?: (g: THREE.Group) => void) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(rbox(W - i * 0.12, h, W - i * 0.12, 0.14), track(material)))
    decorate?.(g)
    root.add(g)
    layers.push({ group: g, mat: material, glow: new THREE.Color(glow) })
  }

  // 0 · GPU Cloud
  addLayer(0, 0.36, new THREE.MeshPhysicalMaterial({ color: '#17475b', metalness: 0.55, roughness: 0.28, clearcoat: 0.8 }), '#5cc3be', (g) => {
    const seam = new THREE.Mesh(rbox(W + 0.02, 0.04, W + 0.02, 0.02), track(new THREE.MeshStandardMaterial({ color: '#d5b68a', metalness: 1, roughness: 0.2, emissive: '#5a4320', emissiveIntensity: 0.4 })))
    seam.position.y = -0.06
    g.add(seam)
    const finMat = track(new THREE.MeshStandardMaterial({ color: '#9ad5e5', metalness: 0.6, roughness: 0.3 }))
    for (let k = 0; k < 6; k++) {
      const fin = new THREE.Mesh(rbox(0.06, 0.05, 2.4, 0.02), finMat)
      fin.position.set(-1.0 + k * 0.4, 0.2, 0)
      g.add(fin)
    }
  })
  // 1 · Knowledge — glass
  addLayer(1, 0.2, new THREE.MeshPhysicalMaterial({ color: '#cdeef5', transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.4 }), '#9ad5e5', (g) => {
    const dotGeo = track(new THREE.SphereGeometry(0.05, 12, 12))
    const dotMat = track(new THREE.MeshStandardMaterial({ color: '#1d6a80', emissive: '#38a6a2', emissiveIntensity: 0.5 }))
    for (let k = 0; k < 18; k++) {
      const d = new THREE.Mesh(dotGeo, dotMat)
      d.position.set(((k % 6) - 2.5) * 0.42, 0.13, (Math.floor(k / 6) - 1) * 0.6)
      g.add(d)
    }
  })
  // 2 · Models — ceramic with tiles
  addLayer(2, 0.3, new THREE.MeshPhysicalMaterial({ color: '#f1f6f7', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }), '#2a8784', (g) => {
    const cols = ['#38a6a2', '#9ad5e5', '#17475b', '#d5b68a']
    cols.forEach((c, k) => {
      const t = new THREE.Mesh(rbox(0.62, 0.12, 0.62, 0.05), track(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 1, metalness: c === '#d5b68a' ? 0.8 : 0.1 })))
      t.position.set(((k % 2) - 0.5) * 0.9, 0.2, (Math.floor(k / 2) - 0.5) * 0.9)
      g.add(t)
    })
  })
  // 3 · AI Agents — teal glass with nodes
  addLayer(3, 0.2, new THREE.MeshPhysicalMaterial({ color: '#8fdcd4', transparent: true, opacity: 0.5, roughness: 0.06, clearcoat: 1, envMapIntensity: 1.4 }), '#5cc3be', (g) => {
    const nGeo = track(new THREE.SphereGeometry(0.09, 16, 16))
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      const n = new THREE.Mesh(nGeo, track(new THREE.MeshPhysicalMaterial({ color: k === 0 ? '#d5b68a' : '#ffffff', metalness: k === 0 ? 0.9 : 0, roughness: 0.2, clearcoat: 1 })))
      n.position.set(Math.cos(a) * 0.95, 0.16, Math.sin(a) * 0.95)
      g.add(n)
    }
  })
  // 4 · Workflows — navy core with the mark
  addLayer(4, 0.38, new THREE.MeshPhysicalMaterial({ color: '#0f2a40', metalness: 0.45, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }), '#9ad5e5', (g) => {
    const tex = track(markTexture())
    const plate = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 2.2)), track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })))
    plate.rotation.x = -Math.PI / 2
    plate.position.y = 0.195
    g.add(plate)
    const edge = new THREE.Mesh(rbox(W - 0.46, 0.03, W - 0.46, 0.02), track(new THREE.MeshStandardMaterial({ color: '#d5b68a', metalness: 1, roughness: 0.25 })))
    edge.position.y = -0.2
    g.add(edge)
  })

  // contact shadow
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(11, 11)), track(new THREE.MeshBasicMaterial({ map: track(radialTexture()), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.72
  root.add(shadow)

  // ── interaction state ─────────────────────────────
  let highlight: number | null = null
  const lift = layers.map(() => 0)
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
    const dist = width < 640 ? 21.5 : 20.5
    target.set(0, width < 1024 ? 1.0 : 0.55, 0)
    camera.position.set(dist * 0.62, dist * 0.46, dist * 0.64)
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
  const onScroll = () => (scroll = Math.min(1, window.scrollY / (window.innerHeight * 0.85)))
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
  const v = new THREE.Vector3()
  let last = performance.now()
  let elapsed = opts.reducedMotion ? 10 : 0
  let raf = 0
  let running = false

  const frame = () => {
    const now = performance.now()
    const dt = opts.reducedMotion ? 1 : Math.min((now - last) / 1000, 0.05)
    last = now
    if (!opts.reducedMotion) elapsed += dt
    const t = elapsed

    // assembly on load, then scroll-driven separation
    const sc = width >= 1024 ? scroll : 0
    const spread = 0.62 + sc * 0.55
    layers.forEach((L, i) => {
      const k = ease((t - 0.15 - i * 0.12) / 0.9)
      const goal = highlight === i ? 0.42 : 0
      lift[i] += (goal - lift[i]) * Math.min(1, dt * 8)
      L.group.position.y = -1.05 + i * spread + (1 - k) * (1.6 + i * 0.4) + lift[i] + (opts.reducedMotion ? 0 : Math.sin(t * 0.9 + i * 0.7) * 0.025)
      L.group.scale.setScalar(Math.max(0.001, 0.6 + k * 0.4))
      L.group.visible = k > 0.001
      L.mat.emissive.copy(L.glow)
      L.mat.emissiveIntensity += ((highlight === i ? 0.35 : 0) - L.mat.emissiveIntensity) * Math.min(1, dt * 8)
    })

    pointer.x += (pointer.tx - pointer.x) * 0.05
    pointer.y += (pointer.ty - pointer.y) * 0.05
    root.rotation.y = -0.15 + Math.sin(t * 0.14) * 0.1 + pointer.x * 0.2 + sc * 0.5
    root.rotation.x = pointer.y * 0.04
    root.updateMatrixWorld(true)

    renderer.render(scene, camera)

    if (opts.onAnchors) {
      const pts = layers.map((L) => {
        v.set(1.45, 0, 1.45).applyMatrix4(L.group.matrixWorld).project(camera)
        return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible: L.group.visible && v.z < 1 }
      })
      v.set(-2.2, -1.5, 2.4).applyMatrix4(root.matrixWorld).project(camera)
      pts.push({ x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible: true })
      opts.onAnchors(pts)
    }
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
    setHighlight(i: number | null) {
      highlight = i
      if (opts.reducedMotion) frame()
    },
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

/** The Ek भारत.AI symbol painted onto the core plate. */
function markTexture() {
  // the official mark, centred on a transparent square so it sits on the navy plate
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const img = new Image()
  img.onload = () => {
    const g = c.getContext('2d')!
    const sz = 330
    const w = (sz * img.width) / img.height
    g.fillStyle = 'rgba(235,243,253,0.96)'
    g.beginPath()
    g.roundRect(256 - 200, 256 - 200, 400, 400, 60)
    g.fill()
    g.drawImage(img, 256 - w / 2, 256 - sz / 2, w, sz)
    tex.needsUpdate = true
  }
  img.src = MARK_SRC
  return tex
}

function radialTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(11,32,52,0.32)')
  grd.addColorStop(0.5, 'rgba(11,32,52,0.12)')
  grd.addColorStop(1, 'rgba(11,32,52,0)')
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
