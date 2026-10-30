import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Procedural datacenter GPU accelerator.
 *
 * Assembly (bottom → top): backplate · PCB (traces, PCIe fingers, bracket,
 * power delivery, power connector) · GPU package (substrate + metal-lidded
 * die) · 8 memory modules · vapour chamber · heat pipes + fin stack · shroud.
 *
 * Scroll drives four stages: assembled → exploded → architecture highlight
 * (die, memory, data paths) → reassembled. The pointer adds inertial tilt,
 * per-layer parallax and a moving key light.
 */
export function createGpuScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  scene.environment = env
  renderer.setClearColor(0x000000, 0)

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  const target = new THREE.Vector3(0, 0.55, 0)

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
  const cursorLight = new THREE.PointLight('#bfefff', 7, 9, 1.6)
  scene.add(cursorLight)
  const coreLight = new THREE.PointLight('#5cc3be', 0, 3.5, 2)
  scene.add(coreLight)

  const trash: { dispose(): void }[] = [env, pmrem]
  const k = <T extends { dispose(): void }>(x: T) => {
    trash.push(x)
    return x
  }
  const rbox = (w: number, h: number, d: number, r = 0.03, seg = 3) => k(new RoundedBoxGeometry(w, h, d, seg, r))
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => k(new THREE.MeshPhysicalMaterial(p))

  // ── materials ────────────────────────────────────
  const graphite = phys({ color: '#26323d', metalness: 0.85, roughness: 0.38 })
  const shroudMat = phys({ color: '#14293b', metalness: 0.75, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 })
  const aluminium = phys({ color: '#b8c4cc', metalness: 1, roughness: 0.32 })
  const copper = phys({ color: '#c79a6a', metalness: 1, roughness: 0.25 })
  const gold = phys({ color: '#d9b77e', metalness: 1, roughness: 0.18 })
  const steel = phys({ color: '#aeb9c1', metalness: 1, roughness: 0.4 })
  const blackPlastic = phys({ color: '#0d1820', metalness: 0.1, roughness: 0.55 })
  const substrateMat = phys({ color: '#1d4a5c', metalness: 0.3, roughness: 0.4, clearcoat: 0.6 })
  const lidMat = phys({ map: k(brushedTexture()), metalness: 1, roughness: 0.28, color: '#d7dee3' })
  const vramMat = phys({ map: k(vramTexture()), metalness: 0.2, roughness: 0.45, emissive: '#5cc3be', emissiveIntensity: 0 })
  const pcbMat = phys({ map: k(pcbTexture()), metalness: 0.25, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.4 })
  const accent = phys({ color: '#5cc3be', emissive: '#38a6a2', emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 })

  const L = 6.2 // card length (x)
  const D = 2.5 // card depth (z)

  const root = new THREE.Group()
  scene.add(root)

  // groups that separate in the exploded view
  const g = {
    backplate: new THREE.Group(),
    pcb: new THREE.Group(),
    pkg: new THREE.Group(),
    vram: new THREE.Group(),
    chamber: new THREE.Group(),
    cooler: new THREE.Group(),
    shroud: new THREE.Group(),
  }
  Object.values(g).forEach((x) => root.add(x))

  // ── backplate ───────────────────────────────────
  const bp = new THREE.Mesh(rbox(L - 0.1, 0.05, D - 0.05, 0.03), graphite)
  bp.position.y = -0.1
  g.backplate.add(bp)
  const ventMat = blackPlastic
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(k(new THREE.BoxGeometry(0.06, 0.01, 1.2)), ventMat)
    s.position.set(-1.6 + i * 0.22, -0.13, 0)
    g.backplate.add(s)
  }

  // ── PCB + board components ─────────────────────
  const board = new THREE.Mesh(rbox(L, 0.07, D, 0.02), [pcbMat, pcbMat, pcbMat, pcbMat, pcbMat, pcbMat])
  g.pcb.add(board)
  // PCIe edge fingers with key notch
  for (let i = 0; i < 34; i++) {
    if (i === 9) continue
    const f = new THREE.Mesh(k(new THREE.BoxGeometry(0.06, 0.075, 0.26)), gold)
    f.position.set(-1.9 + i * 0.085, 0, D / 2 + 0.1)
    g.pcb.add(f)
  }
  const tongue = new THREE.Mesh(k(new THREE.BoxGeometry(2.95, 0.07, 0.24)), pcbMat)
  tongue.position.set(-0.55, 0, D / 2 + 0.1)
  g.pcb.add(tongue)
  // I/O bracket
  const bracket = new THREE.Mesh(rbox(0.05, 1.25, D + 0.1, 0.01), steel)
  bracket.position.set(-L / 2 - 0.03, 0.5, 0)
  g.pcb.add(bracket)
  for (let i = 0; i < 3; i++) {
    const port = new THREE.Mesh(rbox(0.06, 0.22, 0.42, 0.04), blackPlastic)
    port.position.set(-L / 2 - 0.05, 0.42, -0.75 + i * 0.75)
    g.pcb.add(port)
  }
  // power connector at the tail
  const pwr = new THREE.Mesh(rbox(0.42, 0.26, 0.62, 0.03), blackPlastic)
  pwr.position.set(L / 2 - 0.35, 0.17, -0.7)
  g.pcb.add(pwr)
  // VRM chokes + capacitors (instanced)
  const choke = new THREE.InstancedMesh(rbox(0.2, 0.16, 0.2, 0.03), graphite, 12)
  const cap = new THREE.InstancedMesh(k(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14)), steel, 12)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < 12; i++) {
    const x = 1.25 + (i % 6) * 0.27
    const z = i < 6 ? -0.55 : 0.55
    m4.makeTranslation(x, 0.115, z)
    choke.setMatrixAt(i, m4)
    m4.makeTranslation(x, 0.135, z + (i < 6 ? -0.32 : 0.32))
    cap.setMatrixAt(i, m4)
  }
  g.pcb.add(choke, cap)
  // data paths from die to memory (revealed in stage 3)
  const pathMat = phys({ color: '#5cc3be', emissive: '#5cc3be', emissiveIntensity: 0, transparent: true, opacity: 0 })
  const vramPos: THREE.Vector3[] = []
  ;[-0.62, -0.21, 0.21, 0.62].forEach((z) => {
    vramPos.push(new THREE.Vector3(-1.45, 0, z))
    vramPos.push(new THREE.Vector3(0.45, 0, z))
  })
  const paths = vramPos.map((p) => {
    const a = new THREE.Vector3(-0.5, 0.04, 0)
    const len = a.distanceTo(new THREE.Vector3(p.x, 0.04, p.z))
    const m = new THREE.Mesh(k(new THREE.BoxGeometry(len, 0.012, 0.025)), pathMat)
    m.position.set((a.x + p.x) / 2, 0.045, p.z / 2)
    m.rotation.y = -Math.atan2(p.z, p.x - a.x)
    g.pcb.add(m)
    return { from: a, to: new THREE.Vector3(p.x, 0.06, p.z) }
  })

  // ── GPU package ────────────────────────────────
  g.pkg.position.x = -0.5
  const substrate = new THREE.Mesh(rbox(1.55, 0.07, 1.55, 0.03), substrateMat)
  substrate.position.y = 0.07
  g.pkg.add(substrate)
  const lid = new THREE.Mesh(rbox(1.1, 0.09, 1.1, 0.04), lidMat)
  lid.position.y = 0.15
  g.pkg.add(lid)
  const ringMat = phys({ color: '#5cc3be', emissive: '#5cc3be', emissiveIntensity: 0, transparent: true, opacity: 0 })
  const ring = new THREE.Mesh(k(new THREE.TorusGeometry(0.72, 0.012, 8, 64)), ringMat)
  ring.rotation.x = Math.PI / 2
  ring.rotation.z = Math.PI / 4
  ring.position.y = 0.2
  g.pkg.add(ring)

  // ── memory modules ─────────────────────────────
  const vramMeshes = vramPos.map((p) => {
    const m = new THREE.Mesh(rbox(0.32, 0.06, 0.3, 0.015), vramMat)
    m.position.set(p.x, 0.07, p.z)
    g.vram.add(m)
    return m
  })

  // ── vapour chamber ──────────────────────────────
  const chamber = new THREE.Mesh(rbox(3.1, 0.06, 2.0, 0.04), copper)
  chamber.position.set(-0.5, 0.32, 0)
  g.chamber.add(chamber)

  // ── heat pipes + fin stack ──────────────────────
  for (let i = 0; i < 4; i++) {
    const z = -0.6 + i * 0.4
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.4, 0.4, z),
      new THREE.Vector3(-0.5, 0.4, z),
      new THREE.Vector3(0.6, 0.42, z),
      new THREE.Vector3(1.0, 0.55, z),
      new THREE.Vector3(1.1, 0.78, z),
    ])
    g.cooler.add(new THREE.Mesh(k(new THREE.TubeGeometry(curve, 40, 0.045, 10, false)), copper))
  }
  const finCount = 52
  const fins = new THREE.InstancedMesh(k(new THREE.BoxGeometry(0.018, 0.44, 2.05)), aluminium, finCount)
  for (let i = 0; i < finCount; i++) {
    m4.makeTranslation(-2.75 + i * 0.105, 0.6, 0)
    fins.setMatrixAt(i, m4)
  }
  g.cooler.add(fins)

  // ── shroud: windowed top, side rails, teal accent ────
  const shape = new THREE.Shape()
  const hw = L / 2 - 0.02
  const hd = D / 2 - 0.02
  shape.moveTo(-hw, -hd)
  shape.lineTo(hw, -hd)
  shape.lineTo(hw, hd)
  shape.lineTo(-hw, hd)
  shape.closePath()
  const fanX = [-1.55, 0.95]
  const fanR = 0.9
  fanX.forEach((x) => {
    const hole = new THREE.Path()
    hole.absarc(x, 0, fanR, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  })
  const top = new THREE.Mesh(k(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 })), shroudMat)
  top.rotation.x = -Math.PI / 2
  top.position.y = 0.9
  g.shroud.add(top)
  ;[-1, 1].forEach((s) => {
    const rail = new THREE.Mesh(rbox(L - 0.05, 0.78, 0.06, 0.03), shroudMat)
    rail.position.set(0, 0.5, s * (D / 2 - 0.03))
    g.shroud.add(rail)
    const strip = new THREE.Mesh(rbox(L * 0.62, 0.025, 0.012, 0.006), accent)
    strip.position.set(-0.3, 0.7, s * (D / 2 + 0.005))
    g.shroud.add(strip)
  })
  const endcap = new THREE.Mesh(rbox(0.06, 0.78, D - 0.05, 0.03), shroudMat)
  endcap.position.set(L / 2 - 0.03, 0.5, 0)
  g.shroud.add(endcap)
  const badge = new THREE.Mesh(rbox(0.9, 0.02, 0.3, 0.01), phys({ color: '#d9b77e', metalness: 1, roughness: 0.3 }))
  badge.position.set(2.45, 0.995, 0)
  g.shroud.add(badge)

  // axial fans set into the shroud
  const bladeMat = phys({ color: '#1b2c3a', metalness: 0.4, roughness: 0.35, clearcoat: 0.6 })
  const hubMat = phys({ color: '#0f1e2a', metalness: 0.7, roughness: 0.25, clearcoat: 1 })
  const fanRingMat = phys({ color: '#5a6f7e', metalness: 1, roughness: 0.3 })
  const fans: THREE.Group[] = []
  fanX.forEach((x) => {
    const fan = new THREE.Group()
    fan.position.set(x, 0.88, 0)
    const rotor = new THREE.Group()
    fan.add(rotor)
    const hub = new THREE.Mesh(k(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 40)), hubMat)
    rotor.add(hub)
    const cap2 = new THREE.Mesh(k(new THREE.CylinderGeometry(0.12, 0.12, 0.085, 32)), accent)
    rotor.add(cap2)
    for (let b = 0; b < 9; b++) {
      const blade = new THREE.Mesh(rbox(0.56, 0.02, 0.2, 0.01), bladeMat)
      const a2 = (b / 9) * Math.PI * 2
      blade.position.set(Math.cos(a2) * 0.52, 0, Math.sin(a2) * 0.52)
      blade.rotation.y = -a2
      blade.rotation.x = 0.38
      rotor.add(blade)
    }
    const ringM = new THREE.Mesh(k(new THREE.TorusGeometry(fanR - 0.02, 0.02, 10, 80)), fanRingMat)
    ringM.rotation.x = Math.PI / 2
    ringM.position.y = 0.05
    fan.add(ringM)
    g.shroud.add(fan)
    fans.push(rotor)
  })

  // ── data pulses (stage 3) ────────────────────────
  const pulseMat = phys({ color: '#bff3ff', emissive: '#9ad5e5', emissiveIntensity: 2.2, transparent: true, opacity: 0 })
  const pulseGeo = k(new THREE.SphereGeometry(0.035, 10, 10))
  const pulses = paths.map((p, i) => {
    const m = new THREE.Mesh(pulseGeo, pulseMat)
    g.pcb.add(m)
    return { m, p, t: (i * 0.125) % 1 }
  })

  // ── ground: soft contact shadow, faint teal bloom ─────
  const shadow = new THREE.Mesh(k(new THREE.PlaneGeometry(7.4, 3.8)), k(new THREE.MeshBasicMaterial({ map: k(radial('rgba(11,32,52,0.5)', 'rgba(11,32,52,0)')), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.75
  root.add(shadow)
  const bloom = new THREE.Mesh(k(new THREE.PlaneGeometry(4.2, 2.6)), k(new THREE.MeshBasicMaterial({ map: k(radial('rgba(92,195,190,0.30)', 'rgba(92,195,190,0)')), transparent: true, depthWrite: false, toneMapped: false })))
  bloom.rotation.x = -Math.PI / 2
  bloom.position.y = -0.74
  root.add(bloom)

  // ── state & interaction ────────────────────────────
  let last = performance.now()
  let time = 0
  let raf = 0
  let visible = false
  let running = false
  const v = new THREE.Vector3()
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let progress = 0
  let progressT = 0
  let w = 1
  let h = 1
  let baseDist = 14.5

  const resize = () => {
    const p = canvas.parentElement!
    w = p.clientWidth
    h = p.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    baseDist = w < 520 ? 17 : 14.5
    camera.position.set(baseDist * 0.5, baseDist * 0.52, baseDist * 0.7)
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
    kick()
  }
  const onScroll = () => {
    // progress runs over ~70% of a viewport, starting once the card is well in view
    const r = canvas.getBoundingClientRect()
    const vh = window.innerHeight
    const pageTop = r.top + window.scrollY - (parseFloat(canvas.parentElement!.dataset.shift || '0') || 0)
    const start = Math.max(0, pageTop - vh * 0.6)
    progressT = Math.max(0, Math.min(1, (window.scrollY - start) / (vh * 0.7)))
    kick()
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const smooth = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
  }


  const frame = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!opts.reducedMotion) time += dt
    const ease = opts.reducedMotion ? 1 : Math.min(1, dt * 4.5)
    progress += (progressT - progress) * ease
    pointer.x += (pointer.tx - pointer.x) * (opts.reducedMotion ? 1 : Math.min(1, dt * 3.2))
    pointer.y += (pointer.ty - pointer.y) * (opts.reducedMotion ? 1 : Math.min(1, dt * 3.2))

    // stages: 0–.12 assembled · .12–.42 separate · .38–.72 highlight · .72–.95 reassemble
    const p = progress
    const e = smooth(0.12, 0.42, p) * (1 - smooth(0.72, 0.95, p))
    const hl = smooth(0.36, 0.5, p) * (1 - smooth(0.66, 0.78, p))

    const par = (depth: number) => ({ x: pointer.x * depth * 0.09, z: pointer.y * depth * 0.06 })
    const place = (grp: THREE.Group, y: number, depth: number) => {
      const o = par(depth)
      grp.position.set(o.x + (grp === g.pkg ? -0.5 : 0), y, o.z)
    }
    place(g.backplate, -0.4 * e, -1)
    place(g.pcb, 0, 0)
    place(g.vram, 0.32 * e, 1)
    place(g.pkg, 0.55 * e, 1.4)
    place(g.chamber, 0.9 * e, 2)
    place(g.cooler, 1.3 * e, 2.6)
    place(g.shroud, 1.75 * e, 3.2)
    g.pkg.position.x = -0.5 + pointer.x * 1.4 * 0.09

    // architecture highlight
    vramMat.emissiveIntensity = hl * 0.55
    ringMat.opacity = hl
    ringMat.emissiveIntensity = hl * 2
    pathMat.opacity = hl * 0.9
    pathMat.emissiveIntensity = hl * 1.6
    pulseMat.opacity = hl
    coreLight.intensity = hl * 6
    g.pkg.getWorldPosition(v)
    coreLight.position.set(v.x, v.y + 0.5, v.z)
    pulses.forEach((pl, i) => {
      if (!opts.reducedMotion) pl.t = (pl.t + dt * 0.7) % 1
      const tt = i % 2 ? pl.t : 1 - pl.t
      pl.m.position.lerpVectors(pl.p.from, pl.p.to, tt).setY(0.06)
    })
    vramMeshes.forEach((m, i) => (m.position.y = 0.07 + (opts.reducedMotion ? 0 : Math.sin(time * 1.6 + i) * 0.01 * e)))

    if (!opts.reducedMotion) fans.forEach((f, i) => (f.rotation.y += dt * (2.2 + i * 0.3) * (1 - e * 0.7)))

    // inertial tilt + idle float
    root.rotation.y = -0.42 + pointer.x * 0.32 + (opts.reducedMotion ? 0 : Math.sin(time * 0.35) * 0.05) + e * 0.12
    root.rotation.x = pointer.y * 0.14
    root.rotation.z = -pointer.x * 0.03
    root.position.y = opts.reducedMotion ? 0 : Math.sin(time * 0.9) * 0.05
    shadow.scale.setScalar(1 - e * 0.06)

    target.y = 0.55 + e * 0.35
    const dd = baseDist * (1 + e * 0.32)
    camera.position.set(dd * 0.5, dd * 0.52, dd * 0.7)
    camera.lookAt(target)

    // light follows the cursor
    cursorLight.position.set(pointer.x * 4, 3.2, -pointer.y * 3 + 1.5)

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

  return {
    setVisible(vis: boolean) {
      visible = vis
      if (vis && !document.hidden) start()
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
}

/* ───────────────── procedural textures ───────────────── */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function pcbTexture() {
  return canvasTex(2048, 832, (g) => {
    g.fillStyle = '#0f2735'
    g.fillRect(0, 0, 2048, 832)
    // fine traces
    const rnd = mulberry(7)
    g.lineCap = 'round'
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${90 + rnd() * 40},${150 + rnd() * 50},${170 + rnd() * 40},${0.12 + rnd() * 0.18})`
      g.lineWidth = 1 + rnd() * 2
      let x = rnd() * 2048
      let y = rnd() * 832
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 3; s++) {
        if (rnd() > 0.5) x += (rnd() - 0.5) * 420
        else y += (rnd() - 0.5) * 260
        const d = (rnd() - 0.5) * 80
        g.lineTo(x + d, y + d)
      }
      g.stroke()
    }
    // vias
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(200,215,220,${0.15 + rnd() * 0.2})`
      g.beginPath()
      g.arc(rnd() * 2048, rnd() * 832, 1.5 + rnd() * 1.5, 0, Math.PI * 2)
      g.fill()
    }
    // silkscreen outlines
    g.strokeStyle = 'rgba(230,240,244,.28)'
    g.lineWidth = 2
    g.strokeRect(560, 250, 330, 330)
    for (let i = 0; i < 8; i++) g.strokeRect(1330 + (i % 6) * 88, i < 6 ? 180 : 600, 60, 60)
    g.fillStyle = 'rgba(230,240,244,.35)'
    g.font = '600 26px monospace'
    g.fillText('BHARAT.AI  ACCEL-X', 90, 780)
    g.fillText('U1', 900, 240)
  })
}

function brushedTexture() {
  return canvasTex(512, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 512, 512)
    grd.addColorStop(0, '#e9eef1')
    grd.addColorStop(0.5, '#aebac2')
    grd.addColorStop(1, '#dfe6ea')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 512)
    const rnd = mulberry(3)
    for (let i = 0; i < 700; i++) {
      g.strokeStyle = `rgba(255,255,255,${rnd() * 0.08})`
      g.beginPath()
      const y = rnd() * 512
      g.moveTo(0, y)
      g.lineTo(512, y + (rnd() - 0.5) * 6)
      g.stroke()
    }
    g.fillStyle = 'rgba(16,42,64,.55)'
    g.font = '700 38px sans-serif'
    g.fillText('BX-1', 60, 120)
    g.font = '500 22px monospace'
    g.fillText('COMPUTE  ACCELERATOR', 60, 420)
  })
}

function vramTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#121a20'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = 'rgba(200,210,215,.45)'
    g.fillRect(14, 20, 70, 6)
    g.fillRect(14, 34, 50, 5)
    g.beginPath()
    g.arc(104, 104, 6, 0, Math.PI * 2)
    g.fill()
  })
}

function radial(inner: string, outer: string) {
  return canvasTex(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grd.addColorStop(0, inner)
    grd.addColorStop(0.75, outer)
    grd.addColorStop(1, outer)
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
  })
}

function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
