import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createTechScene } from './techScene'

/**
 * Fighter jet that draws the logo's tricolour ribbon in the final scroll phase.
 * The jet flies the ribbon's wipe-front (read from the SVG each frame) and
 * leaves a short saffron · white · green smoke trail that hands over to the
 * SVG ribbon. Everything follows scroll, so reverse scrolling un-draws it.
 */

export interface JetFrame {
  /** tech prelude progress 0..1 (null = not shown) */
  tech: number | null
  /** jet screen position/tangent in canvas px (null = hidden) */
  ribbon: { x: number; y: number; tx: number; ty: number; trail: [number, number][]; fade: number } | null
}

const LANES = [new THREE.Color('#ff9a3c'), new THREE.Color('#f7f8f6'), new THREE.Color('#2c9a46')]
const PER = 70

export function createJetScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const trash: { dispose(): void }[] = []
  const T = <X extends { dispose(): void }>(x: X) => (trash.push(x), x)

  const scene = new THREE.Scene()
  const pmrem = T(new THREE.PMREMGenerator(renderer))
  const env = T(pmrem.fromScene(new RoomEnvironment(), 0.03).texture)
  scene.environment = env
  const tech = createTechScene(env, T)
  const key = new THREE.DirectionalLight('#fff4e6', 2.2)
  key.position.set(-30, 50, 40)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#cfe2ff', 1.1)
  rim.position.set(40, -10, -30)
  scene.add(rim)
  scene.add(new THREE.HemisphereLight('#e6eef6', '#8d959c', 0.6))

  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 400)
  const jet = buildJet(T)
  scene.add(jet)

  // short smoke trail (re-positioned every frame)
  const RT = 3 * PER
  const rtPos = new Float32Array(RT * 3)
  const rtCol = new Float32Array(RT * 3)
  const rtSize = new Float32Array(RT)
  const rtAlpha = new Float32Array(RT)
  for (let i = 0; i < RT; i++) {
    const c = LANES[Math.floor(i / PER)]
    rtCol.set([c.r, c.g, c.b], i * 3)
  }
  const rtGeo = T(new THREE.BufferGeometry())
  rtGeo.setAttribute('position', new THREE.BufferAttribute(rtPos, 3))
  rtGeo.setAttribute('aCol', new THREE.BufferAttribute(rtCol, 3))
  rtGeo.setAttribute('aSize', new THREE.BufferAttribute(rtSize, 1))
  rtGeo.setAttribute('aAlpha', new THREE.BufferAttribute(rtAlpha, 1))
  const rtMat = T(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: T(puffTexture()) }, uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 aCol; attribute float aSize; attribute float aAlpha; uniform float uScale;
        varying vec3 vCol; varying float vA;
        void main(){ vCol = aCol; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; varying vec3 vCol; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vCol * (0.85 + 0.25*(1.0-gl_PointCoord.y)), t.a * vA);
          #include <colorspace_fragment>
        }`,
    }),
  )
  const trail = new THREE.Points(rtGeo, rtMat)
  trail.frustumCulled = false
  scene.add(trail)

  let W = 1
  let H = 1
  const resize = () => {
    W = canvas.clientWidth || 1
    H = canvas.clientHeight || 1
    renderer.setSize(W, H, false)
    cam.aspect = W / H
    cam.updateProjectionMatrix()
    rtMat.uniforms.uScale.value = (H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)))
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  const tmp = new THREE.Vector3()
  const toWorld = (sx: number, sy: number, depth: number, out: THREE.Vector3) => {
    out.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1, 0.5).unproject(cam)
    out.sub(cam.position).normalize()
    return out.multiplyScalar(depth / -out.z).add(cam.position)
  }

  function render(f: JetFrame, _dt: number, time: number) {
    renderer.clear()
    if (f.tech !== null) tech.render(renderer, f.tech, time, W / H)
    const r = f.ribbon
    if (!r) return
    const depth = 40
    const p = toWorld(r.x, r.y, depth, new THREE.Vector3())
    const fwd = toWorld(r.x + r.tx * 30, r.y + r.ty * 30, depth, new THREE.Vector3()).sub(p).normalize()
    fwd.z -= 0.35 // 3/4 view: nose angled slightly away from camera
    fwd.normalize()
    const roll = THREE.MathUtils.clamp(-r.ty * 0.9, -0.7, 0.7) - 0.35
    const up0 = new THREE.Vector3(0, 1, 0).applyAxisAngle(fwd, roll)
    const right = new THREE.Vector3().crossVectors(up0, fwd).normalize()
    const up = new THREE.Vector3().crossVectors(fwd, right).normalize()
    jet.position.copy(p)
    jet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd))
    jet.scale.setScalar(0.46)
    jet.visible = true
    setJetOpacity(jet, r.fade)
    // trail: three lanes behind the jet along the ribbon, fading into the SVG ribbon
    const n = r.trail.length
    for (let lane = 0; lane < 3; lane++) {
      for (let i = 0; i < PER; i++) {
        const k = lane * PER + i
        const s = r.trail[Math.min(n - 1, Math.floor((i / PER) * n))]
        if (!s) {
          rtAlpha[k] = 0
          continue
        }
        const off = (1 - lane) * 7
        toWorld(s[0] - r.ty * off, s[1] - r.tx * off, depth, tmp)
        rtPos.set([tmp.x + Math.sin(i * 1.7 + time) * 0.05, tmp.y, tmp.z], k * 3)
        const age = i / PER
        rtSize[k] = 0.5 + age * 1.6
        rtAlpha[k] = (1 - age) * 0.45 * r.fade // light, to match the faded ribbon
      }
    }
    rtGeo.attributes.position.needsUpdate = true
    rtGeo.attributes.aSize.needsUpdate = true
    rtGeo.attributes.aAlpha.needsUpdate = true
    renderer.render(scene, cam)
  }

  renderer.autoClear = false
  return {
    render,
    clear() {
      renderer.clear()
    },
    dispose() {
      ro.disconnect()
      trash.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}

/* ───────────── jet model ───────────── */

function setJetOpacity(jet: THREE.Object3D, o: number) {
  jet.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.Material | undefined
    if (m && 'opacity' in m) {
      m.transparent = o < 0.999
      ;(m as THREE.MeshStandardMaterial).opacity = o * ((m.userData.baseOpacity as number) ?? 1)
    }
  })
  jet.visible = jet.visible && o > 0.01
}

/**
 * Procedural light-combat-aircraft style delta-wing jet (unarmed, display
 * livery). Local axes: +Z nose, +Y up, +X right. Length ≈ 9 units.
 */
function buildJet(T: <X extends { dispose(): void }>(x: X) => X) {
  const g = new THREE.Group()
  const skin = T(panelTexture())
  const metal = T(new THREE.MeshPhysicalMaterial({ map: skin, color: '#aab3bb', metalness: 0.62, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }))
  const dark = T(new THREE.MeshPhysicalMaterial({ color: '#3b434b', metalness: 0.75, roughness: 0.35 }))
  // gold-tinted canopy, like a display team's visor coat
  const glass = T(new THREE.MeshPhysicalMaterial({ color: '#8a6a2a', metalness: 0.7, roughness: 0.05, clearcoat: 1, envMapIntensity: 2.4, transparent: true, opacity: 0.95 }))
  glass.userData.baseOpacity = 0.95
  const wingSkin = T(panelTexture(true))
  const wingMat = T(new THREE.MeshPhysicalMaterial({ map: wingSkin, color: '#959fa8', metalness: 0.58, roughness: 0.34, clearcoat: 0.45 }))

  // fuselage (lathe along Y, rotated so the nose points +Z)
  const prof = [
    [0.0, 4.6],
    [0.06, 4.45],
    [0.22, 4.0],
    [0.42, 3.3],
    [0.6, 2.4],
    [0.72, 1.4],
    [0.78, 0.2],
    [0.8, -1.4],
    [0.76, -2.8],
    [0.66, -3.8],
    [0.58, -4.25],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const fusGeo = T(new THREE.LatheGeometry(prof, 48))
  fusGeo.rotateX(Math.PI / 2)
  const fus = new THREE.Mesh(fusGeo, metal)
  fus.scale.set(1, 0.86, 1)
  g.add(fus)
  // dorsal spine
  const spine = new THREE.Mesh(T(new THREE.CapsuleGeometry(0.28, 4.2, 6, 16)), metal)
  spine.rotation.x = Math.PI / 2
  spine.position.set(0, 0.55, -1.0)
  spine.scale.set(1, 1, 0.7)
  g.add(spine)
  // nose cone (radome) + pitot probe
  const radome = new THREE.Mesh(T(new THREE.ConeGeometry(0.22, 0.7, 24)), dark)
  radome.rotation.x = Math.PI / 2
  radome.position.z = 4.45
  g.add(radome)
  const pitot = new THREE.Mesh(T(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8)), dark)
  pitot.rotation.x = Math.PI / 2
  pitot.position.z = 5.1
  g.add(pitot)
  // canopy
  const canopy = new THREE.Mesh(T(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), glass)
  canopy.scale.set(0.82, 0.95, 2.6)
  canopy.position.set(0, 0.42, 2.05)
  g.add(canopy)
  const frame = new THREE.Mesh(T(new THREE.TorusGeometry(0.4, 0.035, 8, 32, Math.PI)), dark)
  frame.position.set(0, 0.42, 1.6)
  g.add(frame)
  // intakes
  ;[-1, 1].forEach((s) => {
    const intake = new THREE.Mesh(T(new THREE.BoxGeometry(0.42, 0.62, 2.0)), metal)
    intake.position.set(s * 0.82, -0.12, 0.35)
    g.add(intake)
    const lip = new THREE.Mesh(T(new THREE.BoxGeometry(0.36, 0.54, 0.05)), dark)
    lip.position.set(s * 0.82, -0.12, 1.36)
    g.add(lip)
  })
  // delta wings (shape in XZ, extruded thin in Y)
  const wingShape = (s: number) => {
    const sh = new THREE.Shape()
    sh.moveTo(s * 0.7, 1.2)
    sh.lineTo(s * 4.3, -2.7)
    sh.lineTo(s * 4.45, -3.35)
    sh.lineTo(s * 0.7, -3.55)
    sh.closePath()
    const geo = T(new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 }))
    geo.rotateX(Math.PI / 2)
    return geo
  }
  ;[-1, 1].forEach((s) => {
    const w = new THREE.Mesh(wingShape(s), wingMat)
    w.position.y = -0.1
    g.add(w)
    // roundel: saffron · white · green (display livery)
    ;[
      ['#ff9933', 0.42],
      ['#ffffff', 0.28],
      ['#138808', 0.14],
    ].forEach(([c, r], i) => {
      const d = new THREE.Mesh(T(new THREE.CircleGeometry(r as number, 32)), T(new THREE.MeshStandardMaterial({ color: c as string, roughness: 0.5 })))
      d.rotation.x = -Math.PI / 2
      d.position.set(s * 2.6, 0.0 + i * 0.002, -2.35)
      g.add(d)
    })
    // wing-tip nav light
    const nav = new THREE.Mesh(T(new THREE.SphereGeometry(0.06, 10, 10)), T(new THREE.MeshBasicMaterial({ color: s > 0 ? '#3cff7a' : '#ff3b3b' })))
    nav.position.set(s * 4.4, -0.05, -3.3)
    g.add(nav)
  })
  // tail fin (shape in Z/Y, thin in X) with tricolour fin flash
  const fin = new THREE.Shape()
  fin.moveTo(-1.6, 0.4)
  fin.lineTo(-3.75, 2.95)
  fin.lineTo(-4.25, 2.95)
  fin.lineTo(-4.3, 0.4)
  fin.closePath()
  const finGeo = T(new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2 }))
  finGeo.rotateY(-Math.PI / 2)
  finGeo.translate(0.05, 0, 0)
  g.add(new THREE.Mesh(finGeo, wingMat))
  ;['#ff9933', '#ffffff', '#138808'].forEach((c, i) => {
    ;[-1, 1].forEach((s) => {
      const strip = new THREE.Mesh(T(new THREE.PlaneGeometry(0.5, 0.16)), T(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide })))
      strip.rotation.y = s * Math.PI / 2
      strip.position.set(s * 0.085, 2.35 - i * 0.17, -3.85)
      g.add(strip)
    })
  })
  // slim tricolour cheatline along both flanks
  ;['#ff9933', '#ffffff', '#138808'].forEach((c, i) => {
    const m = T(new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 }))
    ;[-1, 1].forEach((s) => {
      const line = new THREE.Mesh(T(new THREE.BoxGeometry(0.03, 0.07, 3.4)), m)
      line.position.set(s * 0.8, 0.08 - i * 0.075, -1.0)
      g.add(line)
    })
  })
  // engine nozzle with a faint warm glow
  const nozzle = new THREE.Mesh(T(new THREE.CylinderGeometry(0.56, 0.48, 0.75, 32, 1, true)), dark)
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.z = -4.55
  g.add(nozzle)
  const glow = new THREE.Mesh(T(new THREE.CircleGeometry(0.42, 32)), T(new THREE.MeshBasicMaterial({ color: '#ffb36b' })))
  glow.rotation.y = Math.PI
  glow.position.z = -4.6
  g.add(glow)
  return g
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

function panelTexture(wing = false) {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#c3cbd2'
    g.fillRect(0, 0, 1024, 1024)
    const r = mulberry(wing ? 9 : 3)
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 255 : 40},${r() > 0.5 ? 255 : 50},${r() > 0.5 ? 255 : 60},${r() * 0.035})`
      g.fillRect(r() * 1024, r() * 1024, 6 + r() * 40, 6 + r() * 40)
    }
    g.strokeStyle = 'rgba(40,48,56,0.38)'
    g.lineWidth = 2
    const step = wing ? 128 : 96
    for (let y = step; y < 1024; y += step) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(1024, y)
      g.stroke()
    }
    for (let x = 0; x < 1024; x += wing ? 160 : 256) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, 1024)
      g.stroke()
    }
    g.fillStyle = 'rgba(40,48,56,0.35)'
    for (let y = step / 2; y < 1024; y += step) for (let x = 8; x < 1024; x += 22) g.fillRect(x, y, 2, 2)
  })
}

function puffTexture() {
  return canvasTex(128, 128, (g) => {
    const r = mulberry(21)
    for (let i = 0; i < 22; i++) {
      const x = 64 + (r() - 0.5) * 50
      const y = 64 + (r() - 0.5) * 50
      const rad = 18 + r() * 28
      const grd = g.createRadialGradient(x, y, 0, x, y, rad)
      grd.addColorStop(0, 'rgba(255,255,255,0.22)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, 128, 128)
    }
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
