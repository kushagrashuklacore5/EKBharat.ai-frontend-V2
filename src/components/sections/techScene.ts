import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Tech prelude for the brand reveal: one continuous camera move from a
 * silicon wafer, to a GPU package (with an exploded view of die, HBM and
 * interposer), to the board's circuit traces carrying data to other compute
 * nodes. Everything is a pure function of `t` (0..1 scroll progress) plus a
 * slow clock for the data pulses, so reverse scrolling plays it backwards.
 */

const GPU = new THREE.Vector3(14, 0, -6)
const PETROL = new THREE.Color('#2b5f78')
const TEAL = new THREE.Color('#2fb8c0')
const SAFFRON = new THREE.Color('#ff9a3c')

type Keep = <X extends { dispose(): void }>(x: X) => X

export function createTechScene(env: THREE.Texture, T: Keep) {
  const scene = new THREE.Scene()
  scene.environment = env
  const key = new THREE.DirectionalLight('#fff3e2', 2.6)
  key.position.set(-8, 14, 10)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#7fd6dc', 1.6) // controlled teal reflection
  rim.position.set(10, 4, -14)
  scene.add(rim)
  const warm = new THREE.PointLight('#ffb168', 18, 30) // subtle saffron highlight
  warm.position.set(GPU.x - 6, 3, GPU.z + 5)
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
  wEdge.position.y = 0
  wafer.add(wTop, wEdge, blob(15, 0.35))
  scene.add(wafer)

  // ───────────── GPU package ─────────────
  const pkg = new THREE.Group()
  pkg.position.copy(GPU)
  const pcbMat = phys({ map: T(boardTexture()), metalness: 0.35, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35 })
  const substrate = new THREE.Mesh(rbox(5.2, 0.2, 5.2, 0.06), pcbMat)
  substrate.position.y = 0.1
  const interposer = new THREE.Mesh(rbox(3.5, 0.08, 2.7, 0.02), phys({ color: '#7f8b96', metalness: 0.85, roughness: 0.3, iridescence: 0.3 }))
  const die = new THREE.Mesh(rbox(1.9, 0.1, 1.6, 0.015), [
    phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 }),
    phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 }),
    phys({ map: T(dieTexture()), metalness: 0.92, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.4 }),
    phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 }),
    phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 }),
    phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 }),
  ])
  // HBM stacks: four layers each, so the exploded view can fan them apart
  const hbmMat = phys({ color: '#20272e', metalness: 0.55, roughness: 0.35, clearcoat: 0.6 })
  const hbmTopMat = phys({ map: T(hbmTexture()), metalness: 0.5, roughness: 0.3, clearcoat: 0.8 })
  const hbmLayers: { m: THREE.Mesh; i: number }[] = []
  const hbm = new THREE.Group()
  ;[-1, 1].forEach((side) => {
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(rbox(0.5, 0.045, 0.72, 0.008), i === 3 ? [hbmMat, hbmMat, hbmTopMat, hbmMat, hbmMat, hbmMat] : hbmMat)
        m.position.set(side * 1.42, i * 0.05, (j - 1) * 0.82)
        hbm.add(m)
        hbmLayers.push({ m, i })
      }
    }
  })
  // decoupling capacitors around the package (one instanced draw)
  const capGeo = rbox(0.12, 0.07, 0.22, 0.01)
  const caps = new THREE.InstancedMesh(capGeo, phys({ color: '#b08a55', metalness: 0.8, roughness: 0.35 }), 64)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 64; i++) {
    const side = i % 4
    const k = Math.floor(i / 4) / 15 - 0.5
    const r = 2.2
    dummy.position.set(side < 2 ? (side ? r : -r) : k * 4, 0.235, side < 2 ? k * 4 : side === 2 ? r : -r)
    dummy.rotation.y = side < 2 ? 0 : Math.PI / 2
    dummy.updateMatrix()
    caps.setMatrixAt(i, dummy.matrix)
  }
  // brushed-aluminium heat spreader that lifts away
  const lid = new THREE.Mesh(rbox(4.0, 0.14, 3.2, 0.05), phys({ map: T(brushedTexture()), color: '#d4dade', metalness: 1, roughness: 0.32, clearcoat: 0.3 }))
  pkg.add(substrate, interposer, die, hbm, caps, lid, blob(9, 0.4))
  scene.add(pkg)

  // smaller compute nodes the traces connect to
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

  // ───────────── circuit traces with data pulses ─────────────
  const rnd = mulberry(31)
  const paths: THREE.Vector3[][] = []
  // Manhattan/45° routing between two points on the board
  const route = (a: THREE.Vector3, b: THREE.Vector3, bias: number) => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const diag = Math.min(Math.abs(dx), Math.abs(dz)) * bias
    const pts = [a.clone()]
    const m1 = a.clone().add(new THREE.Vector3(Math.abs(dx) > Math.abs(dz) ? (Math.abs(dx) - diag) * Math.sign(dx) * 0.5 : 0, 0, Math.abs(dz) >= Math.abs(dx) ? (Math.abs(dz) - diag) * Math.sign(dz) * 0.5 : 0))
    pts.push(m1)
    pts.push(m1.clone().add(new THREE.Vector3(diag * Math.sign(dx), 0, diag * Math.sign(dz))))
    pts.push(b.clone())
    return pts
  }
  // a bus of parallel traces from the package to each node, and from the wafer
  const bus = (from: THREE.Vector3, to: THREE.Vector3, count: number, spacing: number) => {
    const dir = to.clone().sub(from).setY(0).normalize()
    const nrm = new THREE.Vector3(-dir.z, 0, dir.x)
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * spacing
      paths.push(route(from.clone().addScaledVector(nrm, o), to.clone().addScaledVector(nrm, o * 0.6), 0.85))
    }
  }
  NODES.forEach((n) => {
    const d = n.clone().sub(GPU).setY(0).normalize()
    bus(GPU.clone().addScaledVector(d, 2.7), n.clone().addScaledVector(d, -0.9), 5, 0.16)
  })
  bus(new THREE.Vector3(5.6, 0, -1.6), GPU.clone().add(new THREE.Vector3(-2.7, 0, 0.6)), 6, 0.16)
  // fine fan-out traces leaving the package edge
  for (let i = 0; i < 46; i++) {
    const side = i % 4
    const k = (rnd() - 0.5) * 4.2
    const s = side === 0 ? new THREE.Vector3(2.65, 0, k) : side === 1 ? new THREE.Vector3(-2.65, 0, k) : side === 2 ? new THREE.Vector3(k, 0, 2.65) : new THREE.Vector3(k, 0, -2.65)
    const out = side === 0 ? new THREE.Vector3(1, 0, 0) : side === 1 ? new THREE.Vector3(-1, 0, 0) : side === 2 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1)
    const a = s.add(GPU)
    const l1 = 1 + rnd() * 3
    const p1 = a.clone().addScaledVector(out, l1)
    const turn = new THREE.Vector3(out.z, 0, -out.x).multiplyScalar(rnd() > 0.5 ? 1 : -1)
    const l2 = 1 + rnd() * 3
    const p2 = p1.clone().addScaledVector(out, l2 * 0.7).addScaledVector(turn, l2 * 0.7)
    const p3 = p2.clone().addScaledVector(out, 2 + rnd() * 9)
    paths.push([a, p1, p2, p3])
  }

  // build every trace as a flat ribbon with distance-along-path attributes
  const pos: number[] = []
  const sAttr: number[] = []
  const lenAttr: number[] = []
  const seedAttr: number[] = []
  const idx: number[] = []
  const W = 0.045
  paths.forEach((pts) => {
    const seed = rnd()
    let total = 0
    for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1])
    let s = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const d = b.clone().sub(a)
      const l = d.length()
      if (l < 1e-4) continue
      d.normalize()
      const n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(W / 2)
      const base = pos.length / 3
      ;[a.clone().add(n), a.clone().sub(n), b.clone().add(n), b.clone().sub(n)].forEach((v, j) => {
        pos.push(v.x, 0.012, v.z)
        sAttr.push(j < 2 ? s : s + l)
        lenAttr.push(total)
        seedAttr.push(seed)
      })
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      s += l
    }
  })
  const traceGeo = T(new THREE.BufferGeometry())
  traceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  traceGeo.setAttribute('aS', new THREE.Float32BufferAttribute(sAttr, 1))
  traceGeo.setAttribute('aLen', new THREE.Float32BufferAttribute(lenAttr, 1))
  traceGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seedAttr, 1))
  traceGeo.setIndex(idx)
  const traceMat = T(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uReveal: { value: 0 }, uFlow: { value: 0 }, uPulse: { value: 0 }, uBase: { value: PETROL }, uTeal: { value: TEAL }, uSaff: { value: SAFFRON } },
      vertexShader: /* glsl */ `
        attribute float aS; attribute float aLen; attribute float aSeed;
        varying float vS; varying float vLen; varying float vSeed; varying float vFade;
        void main(){ vS = aS; vLen = aLen; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = 1.0 - smoothstep(30.0, 62.0, -mv.z);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uReveal; uniform float uFlow; uniform float uPulse; uniform vec3 uBase; uniform vec3 uTeal; uniform vec3 uSaff;
        varying float vS; varying float vLen; varying float vSeed; varying float vFade;
        void main(){
          float drawn = 1.0 - smoothstep(-0.4, 0.0, vS - uReveal * (vLen + 0.5));
          if (drawn < 0.01) discard;
          // data packets travelling outward along each trace
          float ph = fract(vS * 0.09 - uFlow * (0.6 + vSeed * 0.6) - vSeed * 7.0);
          float pkt = smoothstep(0.0, 0.025, ph) * (1.0 - smoothstep(0.025, 0.11, ph)) * uPulse;
          vec3 hot = vSeed > 0.78 ? uSaff : uTeal;
          vec3 col = mix(uBase, hot, pkt);
          gl_FragColor = vec4(col, (0.42 + pkt * 0.58) * drawn * vFade);
          #include <colorspace_fragment>
        }`,
    }),
  )
  const traces = new THREE.Mesh(traceGeo, traceMat)
  traces.frustumCulled = false
  traces.renderOrder = -1
  scene.add(traces)

  // ───────────── one continuous camera journey ─────────────
  const camPath = new THREE.CatmullRomCurve3(
    [
      [-11, 7.5, 13],
      [-6, 4.2, 7.5],
      [-2, 2.6, 3.6],
      [5, 5, 6],
      [8.6, 6.8, 4.6],
      [10.8, 6.2, 1.8],
      [15, 13, 4],
      [GPU.x + 1, 27, GPU.z + 8],
    ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    false,
    'centripetal',
  )
  const lookPath = new THREE.CatmullRomCurve3(
    [
      [0, 0, 0],
      [0.3, 0, -0.4],
      [1.5, 0, -1.6],
      [9, 0, -4.5],
      [GPU.x, 0.9, GPU.z],
      [GPU.x, 0.9, GPU.z],
      [GPU.x, 0, GPU.z - 2],
      [GPU.x, 0, GPU.z - 3],
    ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    false,
    'centripetal',
  )

  function render(renderer: THREE.WebGLRenderer, t: number, time: number, aspect: number) {
    cam.aspect = aspect
    cam.updateProjectionMatrix()
    // parametric (not arc-length) so camera and target keyframes stay paired
    camPath.getPoint(t, cam.position)
    cam.lookAt(lookPath.getPoint(t))

    wafer.rotation.y = -0.35 + t * 0.9
    // exploded view of the GPU package, reassembling as the camera rises
    const e = smooth01(range(t, 0.44, 0.6)) * (1 - smooth01(range(t, 0.7, 0.8)))
    lid.position.y = 0.42 + e * 2.4
    lid.rotation.z = e * 0.12
    ;(lid.material as THREE.MeshPhysicalMaterial).opacity = 1 - e * 0.55
    ;(lid.material as THREE.MeshPhysicalMaterial).transparent = e > 0.001
    interposer.position.y = 0.24 + e * 0.35
    die.position.y = 0.33 + e * 1.15
    hbm.position.y = 0.3 + e * 0.75
    hbmLayers.forEach(({ m, i }) => (m.position.y = i * (0.05 + e * 0.16)))

    traceMat.uniforms.uReveal.value = smooth01(range(t, 0.2, 0.8))
    traceMat.uniforms.uFlow.value = time * 0.25 + t * 6 // pulses respond to scroll as well as time
    traceMat.uniforms.uPulse.value = range(t, 0.5, 0.7)
    renderer.render(scene, cam)
  }

  return { render }
}

/* ───────────── procedural textures ───────────── */

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

/** GPU die: compute clusters around a central cache, I/O along the edges */
function dieTexture() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#1e2a35'
    g.fillRect(0, 0, 1024, 1024)
    const r = mulberry(8)
    const cols = 8
    const rows = 6
    const pad = 60
    const cw = (1024 - pad * 2) / cols
    const ch = (1024 - pad * 2 - 90) / rows
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = pad + i * cw
        const y = pad + j * ch + (j >= rows / 2 ? 90 : 0)
        g.fillStyle = `hsl(${195 + r() * 20}, 30%, ${22 + r() * 6}%)`
        g.fillRect(x + 4, y + 4, cw - 8, ch - 8)
        g.fillStyle = 'rgba(120,210,220,0.22)'
        for (let k = 0; k < 6; k++) g.fillRect(x + 10 + k * ((cw - 20) / 6), y + 12, (cw - 20) / 6 - 4, ch * 0.45)
        g.fillStyle = 'rgba(255,180,110,0.25)'
        g.fillRect(x + 10, y + ch * 0.62, cw - 20, 6)
      }
    }
    // L2 cache band
    g.fillStyle = '#3c5566'
    g.fillRect(pad, 512 - 40, 1024 - pad * 2, 80)
    g.fillStyle = 'rgba(220,235,240,0.25)'
    for (let x = pad + 6; x < 1024 - pad; x += 12) g.fillRect(x, 512 - 34, 6, 68)
    // I/O ring
    g.strokeStyle = 'rgba(214,180,120,0.55)'
    g.lineWidth = 6
    g.strokeRect(24, 24, 976, 976)
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

function hbmTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#1b2228'
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = 'rgba(160,190,200,0.25)'
    g.lineWidth = 3
    g.strokeRect(18, 18, 220, 220)
    g.fillStyle = 'rgba(160,190,200,0.3)'
    for (let y = 60; y < 200; y += 22) g.fillRect(40, y, 176, 6)
  })
}

function brushedTexture() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#c8ced3'
    g.fillRect(0, 0, 512, 512)
    const r = mulberry(17)
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 255 : 90},${r() > 0.5 ? 255 : 100},${r() > 0.5 ? 255 : 110},${r() * 0.06})`
      g.fillRect(0, r() * 512, 512, 1)
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

function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const range = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const smooth01 = (t: number) => t * t * (3 - 2 * t)
