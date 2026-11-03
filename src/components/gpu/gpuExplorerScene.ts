import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildGpuAssembly } from '../sections/gpuAssembly'

/**
 * Standalone renderer for the interactive GPU explorer: the same procedural
 * card as the brand-reveal prelude, orbitable, with a controllable exploded
 * view and a camera that can focus on any layer.
 */
export function createGpuExplorer(canvas: HTMLCanvasElement, opts: { low: boolean; reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.low ? 1.25 : 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const trash: { dispose(): void }[] = []
  const T = <X extends { dispose(): void }>(x: X) => (trash.push(x), x)

  const scene = new THREE.Scene()
  const pmrem = T(new THREE.PMREMGenerator(renderer))
  scene.environment = T(pmrem.fromScene(new RoomEnvironment(), 0.03).texture)
  const key = new THREE.DirectionalLight('#fff3e2', 2.4)
  key.position.set(-6, 12, 8)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#7fd6dc', 1.6)
  rim.position.set(8, 3, -10)
  scene.add(rim)
  const warm = new THREE.PointLight('#ffb168', 14, 26)
  warm.position.set(-6, 3, 5)
  scene.add(warm)
  scene.add(new THREE.HemisphereLight('#eef4f8', '#7d8a94', 0.8))

  const gpu = buildGpuAssembly(T, opts.low)
  gpu.group.scale.setScalar(0.42)
  const pivot = new THREE.Group()
  pivot.add(gpu.group)
  scene.add(pivot)

  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200)
  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    cam.aspect = w / h
    cam.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // state (targets) and their eased values
  let explode = 0
  let explodeT = 0
  let focus: number | null = null
  let yaw = -0.5
  let yawT = -0.5
  const look = new THREE.Vector3()
  const lookT = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  let last = performance.now()
  let time = 0

  function frame() {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt
    const k = opts.reduced ? 1 : Math.min(1, dt * 5)
    explode += (explodeT - explode) * k
    if (!opts.reduced && focus === null) yawT += dt * 0.08 // slow presentation turn
    yaw += (yawT - yaw) * k
    gpu.update(explode, time, explode)
    pivot.rotation.y = yaw
    pivot.updateMatrixWorld(true)

    // camera: frame the whole card, or move in on a focused layer
    const stackH = 5.8 * explode
    if (focus !== null) {
      gpu.layers[focus].getWorldPosition(tmp)
      lookT.set(0, tmp.y + 0.3, 0)
    } else lookT.set(0, stackH * 0.5, 0)
    look.lerp(lookT, k)
    const dist = focus !== null ? 13 : 17 + stackH * 0.9
    cam.position.set(0, look.y + dist * 0.42, dist)
    cam.lookAt(look)
    renderer.render(scene, cam)
  }

  return {
    frame,
    setExplode(v: number) {
      explodeT = v
    },
    setFocus(i: number | null) {
      focus = i
    },
    rotate(dx: number) {
      yawT += dx
    },
    dispose() {
      ro.disconnect()
      trash.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}
