import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Procedural data-centre GPU card, modelled layer by layer so it can be shown
 * as an engineering exploded view. Local units ≈ 1 cm; the card lies in XZ
 * (x = length, z = height of the card), +Y is "up" off the component side.
 *
 * Assembly order (bottom → top), each its own layer:
 *   backplate + I/O bracket · multi-layer PCB (with SMD field, edge connector,
 *   power connector) · power delivery (chokes, MOSFETs, polymer caps, PWM
 *   controller) · GPU package (BGA, substrate caps, micro-bumps, die) ·
 *   memory (12 packages with BGA) · thermal interface (paste, pads) ·
 *   cold plate (+ retention springs) · heat pipes + transfer block ·
 *   fin-stack heatsink with shroud rails
 *
 * Repeated parts are instanced, so the whole card is a few dozen draw calls.
 */

export type Keep = <X extends { dispose(): void }>(x: X) => X

const PKG_X = -2 // GPU package centre on the PCB
const PKG = 5.6 // package substrate size
const DIE_W = 3.1
const DIE_D = 2.7
const VRAM: [number, number][] = [
  [-6.3, -2.4], [-6.3, -0.8], [-6.3, 0.8], [-6.3, 2.4],
  [2.3, -2.4], [2.3, -0.8], [2.3, 0.8], [2.3, 2.4],
  [-3.4, -4.05], [-0.6, -4.05], [-3.4, 4.05], [-0.6, 4.05],
]
const PHASE_X = Array.from({ length: 8 }, (_, i) => 4.5 + i * 0.86)
const MEM_PH = [-12.1, -11.25, -10.4, -9.55] // memory power stage
/** support ICs: display/IO controllers, firmware flash, PMIC, drivers, clock */
const ICS: { x: number; z: number; w: number; d: number; quad: boolean; label: string }[] = [
  { x: -10.6, z: -2.2, w: 1.6, d: 1.6, quad: true, label: 'DP' },
  { x: -10.6, z: 0.6, w: 1.2, d: 1.2, quad: true, label: 'IO' },
  { x: -8.4, z: 3.2, w: 0.9, d: 0.6, quad: false, label: 'ROM' },
  { x: -11.2, z: 3.4, w: 1.0, d: 0.7, quad: false, label: 'PMIC' },
  { x: 5.4, z: -0.9, w: 0.9, d: 0.9, quad: true, label: 'DRV' },
  { x: 9.3, z: 1.0, w: 0.9, d: 0.9, quad: true, label: 'MON' },
  { x: 6.2, z: 1.2, w: 0.8, d: 0.5, quad: false, label: 'EEP' },
  { x: 8.6, z: -1.1, w: 0.8, d: 0.5, quad: false, label: 'CLK' },
  { x: -7.6, z: 4.6, w: 1.0, d: 0.6, quad: false, label: 'USB' },
  { x: 3.6, z: 4.95, w: 0.9, d: 0.4, quad: false, label: 'BUF' },
]
const XTAL: [number, number][] = [[6.4, -0.1], [-9.2, 1.9]]

interface IcPin {
  x: number
  z: number
  r: number
}
/** gull-wing pin positions for every IC (quad flat packs on 4 sides, SOIC on 2) */
function icPins() {
  const out: IcPin[] = []
  ICS.forEach((c) => {
    const nx = Math.max(4, Math.floor(c.w / 0.14))
    for (let i = 0; i < nx; i++) {
      const x = c.x - c.w / 2 + (c.w / nx) * (i + 0.5)
      out.push({ x, z: c.z - c.d / 2 - 0.05, r: 0 }, { x, z: c.z + c.d / 2 + 0.05, r: 0 })
    }
    if (!c.quad) return
    const nz = Math.max(4, Math.floor(c.d / 0.14))
    for (let i = 0; i < nz; i++) {
      const z = c.z - c.d / 2 + (c.d / nz) * (i + 0.5)
      out.push({ x: c.x - c.w / 2 - 0.05, z, r: Math.PI / 2 }, { x: c.x + c.w / 2 + 0.05, z, r: Math.PI / 2 })
    }
  })
  return out
}

export function buildGpuAssembly(T: Keep, low: boolean) {
  const root = new THREE.Group()
  const layers: { g: THREE.Group; dy: number }[] = []
  const layer = (dy: number) => {
    const g = new THREE.Group()
    root.add(g)
    layers.push({ g, dy })
    return g
  }
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => T(new THREE.MeshPhysicalMaterial(p))
  const rbox = (w: number, h: number, d: number, r = 0.02) => T(new RoundedBoxGeometry(w, h, d, 2, r))
  const boxG = (w: number, h: number, d: number) => T(new THREE.BoxGeometry(w, h, d))
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }
  const o3 = new THREE.Object3D()
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], n: number, place: (i: number, o: THREE.Object3D) => void, color?: (i: number) => THREE.Color) => {
    const im = new THREE.InstancedMesh(geo, mat, n)
    for (let i = 0; i < n; i++) {
      o3.position.set(0, 0, 0)
      o3.rotation.set(0, 0, 0)
      o3.scale.set(1, 1, 1)
      place(i, o3)
      o3.updateMatrix()
      im.setMatrixAt(i, o3.matrix)
      if (color) im.setColorAt(i, color(i))
    }
    im.castShadow = true
    im.receiveShadow = true
    return im
  }
  const rnd = mulberry(77)

  // ───────────── shared materials ─────────────
  const gold = phys({ color: '#d6a84e', metalness: 1, roughness: 0.22 })
  const solder = phys({ color: '#c9cdd2', metalness: 1, roughness: 0.3 })
  const graphite = phys({ map: T(brushedTexture('#2b333b')), metalness: 0.8, roughness: 0.38, clearcoat: 0.3 })
  const aluminium = phys({ map: T(brushedTexture('#d3d9de')), metalness: 1, roughness: 0.3 })
  const blackPlastic = phys({ color: '#15191d', roughness: 0.55, metalness: 0.1 })
  const mask = phys({ color: '#0f1e2b', roughness: 0.5, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.35 })

  // ───────────── 1 · backplate + I/O bracket ─────────────
  const back = layer(-2.6)
  const ventMat = phys({ map: T(ventTexture()), metalness: 0.8, roughness: 0.4, clearcoat: 0.3 })
  back.add(mesh(boxG(26, 0.1, 11), [graphite, graphite, ventMat, ventMat, graphite, graphite], 0, -0.34, 0))
  back.add(inst(T(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16)), aluminium, 10, (i, o) => {
    const p = [[-12.3, -5], [-12.3, 5], [12.3, -5], [12.3, 5], [PKG_X - 2.9, -2.9], [PKG_X + 2.9, -2.9], [PKG_X - 2.9, 2.9], [PKG_X + 2.9, 2.9], [6, -5], [6, 5]][i]
    o.position.set(p[0], -0.27, p[1])
  }))
  const bracketMat = phys({ map: T(bracketTexture()), metalness: 0.9, roughness: 0.35 })
  back.add(mesh(boxG(0.12, 3.6, 11.8), [bracketMat, bracketMat, aluminium, aluminium, aluminium, aluminium], -13.15, 1.3, 0))

  // ───────────── 2 · multi-layer PCB ─────────────
  const pcb = layer(0)
  // placements first, so the board artwork can put pads and solder exactly under every part
  const keepOut: number[][] = [
    [PKG_X - 3, PKG_X + 3, -3, 3],
    ...VRAM.map(([x, z]) => [x - 0.85, x + 0.85, z - 0.75, z + 0.75]),
    [4, 11, -4.6, -2.0],
    [4, 11, 2.0, 4.6],
    [11.4, 13, -1.4, 1.4],
    [6.8, 8, -0.6, 0.6],
    [-12.6, -9.1, -4.9, -3.2], // memory power stage
    ...ICS.map((c) => [c.x - c.w / 2 - 0.2, c.x + c.w / 2 + 0.2, c.z - c.d / 2 - 0.2, c.z + c.d / 2 + 0.2]),
    ...XTAL.map(([x, z]) => [x - 0.35, x + 0.35, z - 0.2, z + 0.2]),
    [-8.6, 2.6, 5.15, 6.5], // edge-connector fan-out
    [-5.5, 1.5, 3.3, 4.9], // bottom memory row breakout
  ]
  const free = (x: number, z: number, m = 0) => !keepOut.some(([a, b, c, d]) => x > a - m && x < b + m && z > c - m && z < d + m)
  // SOT-23 transistors scattered through the free areas
  const sot: [number, number, number][] = []
  while (sot.length < (low ? 30 : 70)) {
    const x = -12.4 + rnd() * 24.8
    const z = -5.1 + rnd() * 10.2
    if (free(x, z, 0.2)) sot.push([x, z, rnd() > 0.5 ? 0 : Math.PI / 2])
  }
  sot.forEach(([x, z]) => keepOut.push([x - 0.25, x + 0.25, z - 0.25, z + 0.25]))
  // thousands of 0402 passives: capacitors (tan) and resistors (black)
  const smdN = low ? 1200 : 3600
  const smdPos: [number, number, number][] = []
  while (smdPos.length < smdN) {
    const near = rnd()
    let x: number
    let z: number
    if (near < 0.38) {
      const a = rnd() * Math.PI * 2
      const r = 3.1 + rnd() * 1.6
      x = PKG_X + Math.cos(a) * r
      z = Math.sin(a) * r * 0.9
    } else if (near < 0.6) {
      const v = VRAM[Math.floor(rnd() * VRAM.length)]
      x = v[0] + (rnd() - 0.5) * 2.2
      z = v[1] + (rnd() - 0.5) * 2
    } else if (near < 0.75) {
      const c = ICS[Math.floor(rnd() * ICS.length)]
      x = c.x + (rnd() - 0.5) * (c.w + 1.4)
      z = c.z + (rnd() - 0.5) * (c.d + 1.4)
    } else {
      x = -12.5 + rnd() * 25
      z = -5.2 + rnd() * 10.4
    }
    if (Math.abs(z) > 5.25 || Math.abs(x) > 12.7 || !free(x, z)) continue
    smdPos.push([x, z, rnd() > 0.5 ? 0 : Math.PI / 2])
  }
  const pins = icPins()
  const art = { smd: smdPos, sot, pins }
  const S = low ? 60 : 120
  const mr = T(pcbTexture(S, art, true)) // metal/roughness: copper routing and pads are metallic
  const pcbTop = phys({ map: T(pcbTexture(S, art, false)), metalnessMap: mr, roughnessMap: mr, metalness: 1, roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.9 })
  const copper = phys({ map: T(copperPlaneTexture()), metalness: 1, roughness: 0.35 })
  const fr4 = phys({ color: '#86805a', roughness: 0.85 })
  // top mask · inner copper plane · FR-4 core · bottom mask — fan apart in the exploded view
  const pcbSub = [
    mesh(boxG(26, 0.04, 11), [mask, mask, pcbTop, mask, mask, mask], 0, 0.06, 0),
    mesh(boxG(25.8, 0.02, 10.8), copper, 0, 0.03, 0),
    mesh(boxG(26, 0.1, 11), fr4, 0, -0.03, 0),
    mesh(boxG(26, 0.02, 11), [mask, mask, copper, mask, mask, mask], 0, -0.09, 0),
  ]
  const pcbBase = pcbSub.map((m) => m.position.y)
  pcbSub.forEach((m) => pcb.add(m))
  // PCIe edge connector (gold fingers) and 16-pin power connector
  const fingers = phys({ map: T(fingerTexture()), metalness: 1, roughness: 0.25 })
  pcb.add(mesh(boxG(11, 0.08, 0.95), [mask, mask, fingers, fingers, mask, mask], -3, 0.04, 5.97))
  pcb.add(mesh(rbox(0.95, 0.9, 2.3, 0.05), blackPlastic, 12.2, 0.53, 0))
  pcb.add(inst(boxG(0.16, 0.16, 0.05), gold, 16, (i, o) => o.position.set(12.72, 0.3 + (i % 2) * 0.32, -0.88 + Math.floor(i / 2) * 0.25)))

  const smdMat = phys({ color: '#ffffff', roughness: 0.5, metalness: 0.2 })
  const tan = new THREE.Color('#c4a27a')
  const blk = new THREE.Color('#1c2126')
  pcb.add(
    inst(boxG(0.075, 0.05, 0.05), smdMat, smdN, (i, o) => {
      o.position.set(smdPos[i][0], 0.105, smdPos[i][1])
      o.rotation.y = smdPos[i][2]
    }, (i) => (i % 3 === 0 ? blk : tan)),
  )
  // tinned end terminations + solder fillets on every passive
  pcb.add(
    inst(boxG(0.022, 0.056, 0.056), solder, smdN * 2, (i, o) => {
      const [x, z, r] = smdPos[i >> 1]
      const d = (i & 1 ? 1 : -1) * 0.046
      o.position.set(x + Math.cos(r) * d, 0.106, z - Math.sin(r) * d)
      o.rotation.y = r
    }),
  )
  // integrated circuits: moulded bodies with gull-wing pins
  const icBody = phys({ color: '#15191d', roughness: 0.6, metalness: 0.05, clearcoat: 0.2 })
  ICS.forEach((c) => {
    const m = mesh(rbox(c.w, 0.1, c.d, 0.015), [icBody, icBody, phys({ map: T(icTexture(c.label)), roughness: 0.6 }), icBody, icBody, icBody], c.x, 0.135, c.z)
    pcb.add(m)
  })
  pcb.add(inst(boxG(1, 1, 1), solder, pins.length, (i, o) => {
    const p = pins[i]
    o.position.set(p.x, 0.1, p.z)
    o.rotation.y = p.r
    o.scale.set(0.035, 0.035, 0.13)
  }))
  // SOT-23 bodies and legs
  pcb.add(inst(boxG(0.29, 0.1, 0.16), icBody, sot.length, (i, o) => {
    o.position.set(sot[i][0], 0.135, sot[i][1])
    o.rotation.y = sot[i][2]
  }))
  pcb.add(inst(boxG(0.04, 0.03, 0.12), solder, sot.length * 3, (i, o) => {
    const [x, z, r] = sot[Math.floor(i / 3)]
    const k = i % 3
    const lx = k === 2 ? 0 : k ? 0.09 : -0.09
    const lz = k === 2 ? -0.12 : 0.12
    o.position.set(x + Math.cos(r) * lx + Math.sin(r) * lz, 0.1, z - Math.sin(r) * lx + Math.cos(r) * lz)
    o.rotation.y = r
  }))
  // crystal oscillators in metal cans
  XTAL.forEach(([x, z]) => pcb.add(mesh(rbox(0.5, 0.14, 0.24, 0.03), aluminium, x, 0.15, z)))

  // live GPU ↔ memory buses and power feeds: warm light travelling along the copper
  const busPaths: TracePath[] = []
  const bus = (a: THREE.Vector3, b: THREE.Vector3, n: number, gap: number, hot: number) => {
    const d = b.clone().sub(a).setY(0).normalize()
    const nrm = new THREE.Vector3(-d.z, 0, d.x)
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap
      busPaths.push({ pts: route(a.clone().addScaledVector(nrm, o), b.clone().addScaledVector(nrm, o), 0.8), hot })
    }
  }
  VRAM.forEach(([x, z]) => {
    const side = Math.abs(z) > 3.5 ? 'row' : 'col'
    if (side === 'col') bus(new THREE.Vector3(PKG_X + Math.sign(x - PKG_X) * 2.85, 0, z * 0.7), new THREE.Vector3(x - Math.sign(x - PKG_X) * 0.72, 0, z), 6, 0.07, 0)
    else bus(new THREE.Vector3(x * 0.6 + PKG_X * 0.4, 0, Math.sign(z) * 2.85), new THREE.Vector3(x, 0, z - Math.sign(z) * 0.62), 6, 0.07, 0)
  })
  ;[-3.25, 3.25].forEach((z) => bus(new THREE.Vector3(4.3, 0, z * 0.8), new THREE.Vector3(PKG_X + 2.85, 0, z * 0.45), 3, 0.16, 1))
  const busMat = traceMaterial({ baseAlpha: 0, data: '#ffd27a' })
  const busMesh = new THREE.Mesh(T(traceGeometry(busPaths, 0.035, 0.083, rnd)), T(busMat))
  busMesh.frustumCulled = false
  pcb.add(busMesh)

  // ───────────── 3 · power delivery ─────────────
  const vrm = layer(1.6)
  const chokeTop = phys({ map: T(labelTexture('R22', '#5a646d')), metalness: 0.6, roughness: 0.45 })
  const chokeSide = phys({ color: '#5a646d', metalness: 0.6, roughness: 0.45 })
  const phases: [number, number][] = []
  ;[-4.1, 4.1].forEach((z) => PHASE_X.forEach((x) => phases.push([x, z])))
  vrm.add(inst(rbox(0.72, 0.5, 0.72, 0.04), [chokeSide, chokeSide, chokeTop, chokeSide, chokeSide, chokeSide], phases.length, (i, o) => o.position.set(phases[i][0], 0.33, phases[i][1])))
  vrm.add(inst(boxG(0.5, 0.09, 0.55), blackPlastic, phases.length, (i, o) => o.position.set(phases[i][0], 0.125, Math.sign(phases[i][1]) * 3.25)))
  vrm.add(inst(boxG(0.3, 0.03, 0.2), aluminium, phases.length, (i, o) => o.position.set(phases[i][0], 0.175, Math.sign(phases[i][1]) * 3.25)))
  const capBody = phys({ color: '#1d2b3b', roughness: 0.35, metalness: 0.3, clearcoat: 0.8 })
  const capTop = phys({ map: T(capTopTexture()), metalness: 1, roughness: 0.3 })
  const caps: [number, number, number][] = []
  ;[-2.4, 2.4].forEach((z) => PHASE_X.forEach((x) => caps.push([x, z, 0.22])))
  ;[[10.9, -0.95], [10.9, -0.32], [10.9, 0.32], [10.9, 0.95], [5.2, 0], [9.3, 0]].forEach(([x, z]) => caps.push([x, z, 0.26]))
  const capGeo = T(new THREE.CylinderGeometry(1, 1, 1, 24))
  vrm.add(inst(capGeo, [capBody, capTop, capBody], caps.length, (i, o) => {
    o.position.set(caps[i][0], 0.33, caps[i][1])
    o.scale.set(caps[i][2], 0.5, caps[i][2])
  }))
  vrm.add(mesh(rbox(0.75, 0.08, 0.75, 0.01), [blackPlastic, blackPlastic, phys({ map: T(labelTexture('PWM', '#15191d')), roughness: 0.5 }), blackPlastic, blackPlastic, blackPlastic], 7.4, 0.12, 0))
  // memory power stage (chokes + MOSFETs) at the bracket end
  vrm.add(inst(rbox(0.72, 0.5, 0.72, 0.04), [chokeSide, chokeSide, chokeTop, chokeSide, chokeSide, chokeSide], MEM_PH.length, (i, o) => o.position.set(MEM_PH[i], 0.33, -4.4)))
  vrm.add(inst(boxG(0.5, 0.09, 0.55), blackPlastic, MEM_PH.length, (i, o) => o.position.set(MEM_PH[i], 0.125, -3.6)))

  // ───────────── 4 · GPU package ─────────────
  const pkgL = layer(3.0)
  const substrate = phys({ map: T(substrateTexture()), roughness: 0.5, metalness: 0.25, clearcoat: 0.6 })
  pkgL.add(mesh(rbox(PKG, 0.14, PKG, 0.04), [mask, mask, substrate, mask, mask, mask], PKG_X, 0.17, 0))
  const ballGeo = T(new THREE.IcosahedronGeometry(1, 1))
  const nb = low ? 16 : 24
  pkgL.add(inst(ballGeo, solder, nb * nb, (i, o) => {
    o.position.set(PKG_X - 2.5 + (i % nb) * (5 / (nb - 1)), 0.08, -2.5 + Math.floor(i / nb) * (5 / (nb - 1)))
    o.scale.setScalar(0.07)
  }))
  // decoupling capacitors on the substrate, in rows around the die
  const sc: [number, number, number][] = []
  for (let k = 0; k < 18; k++) {
    const t = -2.3 + k * (4.6 / 17)
    sc.push([PKG_X + t, 2.35, 0], [PKG_X + t, -2.35, 0], [PKG_X - 2.35, t, 1], [PKG_X + 2.35, t, 1])
  }
  pkgL.add(inst(boxG(0.14, 0.06, 0.08), smdMat, sc.length, (i, o) => {
    o.position.set(sc[i][0], 0.27, sc[i][1])
    o.rotation.y = sc[i][2] ? Math.PI / 2 : 0
  }, () => tan))
  // flip-chip micro-bumps (visible when the die lifts)
  const mb = low ? 16 : 30
  pkgL.add(inst(ballGeo, solder, mb * mb, (i, o) => {
    o.position.set(PKG_X - DIE_W / 2 + 0.1 + (i % mb) * ((DIE_W - 0.2) / (mb - 1)), 0.255, -DIE_D / 2 + 0.1 + Math.floor(i / mb) * ((DIE_D - 0.2) / (mb - 1)))
    o.scale.setScalar(0.028)
  }))
  const dieEdge = phys({ color: '#3a4652', metalness: 0.9, roughness: 0.3 })
  const dieTop = phys({ map: T(dieTexture(low ? 1024 : 2048)), metalness: 0.92, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.45, iridescenceIOR: 1.7 })
  const die = mesh(rbox(DIE_W, 0.08, DIE_D, 0.01), [dieEdge, dieEdge, dieTop, dieEdge, dieEdge, dieEdge], PKG_X, 0.3, 0)
  pkgL.add(die)

  // ───────────── 5 · memory ─────────────
  const mem = layer(4.4)
  const memTop = phys({ map: T(vramTexture()), metalness: 0.4, roughness: 0.32, clearcoat: 0.8 })
  const memSide = phys({ color: '#1a2026', metalness: 0.4, roughness: 0.4 })
  mem.add(inst(rbox(1.4, 0.11, 1.2, 0.02), [memSide, memSide, memTop, memSide, memSide, memSide], VRAM.length, (i, o) => o.position.set(VRAM[i][0], 0.17, VRAM[i][1])))
  const vb = low ? 5 : 8
  mem.add(inst(ballGeo, solder, VRAM.length * vb * vb, (i, o) => {
    const v = VRAM[Math.floor(i / (vb * vb))]
    const k = i % (vb * vb)
    o.position.set(v[0] - 0.5 + (k % vb) * (1 / (vb - 1)), 0.09, v[1] - 0.42 + Math.floor(k / vb) * (0.84 / (vb - 1)))
    o.scale.setScalar(0.045)
  }))

  // ───────────── 6 · thermal interface ─────────────
  const tim = layer(6.6)
  tim.add(mesh(boxG(DIE_W, 0.025, DIE_D), phys({ map: T(pasteTexture()), roughness: 0.75, metalness: 0.2 }), PKG_X, 0.355, 0))
  const pad = phys({ color: '#9fb6c6', roughness: 0.9, transparent: true, opacity: 0.88 })
  tim.add(inst(boxG(1.45, 0.08, 1.25), pad, VRAM.length, (i, o) => o.position.set(VRAM[i][0], 0.27, VRAM[i][1])))
  ;[-3.25, 3.25].forEach((z) => tim.add(mesh(boxG(7.2, 0.08, 0.7), pad, 7.5, 0.22, z)))

  // ───────────── 7 · cold plate ─────────────
  const plateL = layer(7.8)
  const nickel = phys({ map: T(milledTexture()), metalness: 1, roughness: 0.2 })
  const copperPolish = phys({ color: '#d08a58', metalness: 1, roughness: 0.12 })
  plateL.add(mesh(boxG(12.5, 0.24, 9.6), [nickel, nickel, nickel, nickel, nickel, nickel], -1.5, 0.52, 0))
  plateL.add(mesh(boxG(3.3, 0.1, 2.9), copperPolish, PKG_X, 0.36, 0))
  const springGeo = T(new THREE.TubeGeometry(new HelixCurve(0.16, 0.5, 6), 120, 0.025, 6))
  const screwGeo = T(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 12))
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    plateL.add(mesh(springGeo, aluminium, PKG_X + sx * 3.4, 0.64, sz * 3.4))
    plateL.add(mesh(screwGeo, aluminium, PKG_X + sx * 3.4, 0.9, sz * 3.4))
  })

  // ───────────── 8 · heat pipes + transfer block ─────────────
  const pipesL = layer(9.2)
  const pipeMat = phys({ color: '#c98d5c', metalness: 1, roughness: 0.26 })
  ;[-1.8, -0.9, 0, 0.9, 1.8].forEach((z, i) => {
    const l = i % 2 ? -11.6 : -10.6
    const r = i % 2 ? 10.2 : 11.2
    const curve = new THREE.CatmullRomCurve3(
      [[l, 2.6, z], [l + 0.7, 1.15, z], [l + 2.2, 0.78, z], [PKG_X, 0.74, z * 0.85], [r - 2.2, 0.78, z], [r - 0.7, 1.15, z], [r, 2.6, z]].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    )
    pipesL.add(mesh(T(new THREE.TubeGeometry(curve, low ? 60 : 120, 0.17, 12)), pipeMat))
  })
  pipesL.add(mesh(rbox(3.6, 0.36, 4.6, 0.04), nickel, PKG_X, 0.86, 0))

  // ───────────── 9 · fin-stack heatsink + shroud ─────────────
  const sink = layer(11)
  const nf = low ? 70 : 120
  sink.add(inst(boxG(0.035, 2.7, 9.6), aluminium, nf, (i, o) => o.position.set(-12.1 + i * (23.6 / (nf - 1)), 2.08, 0)))
  ;[-4.95, 4.95].forEach((z) => sink.add(mesh(rbox(24.8, 2.95, 0.14, 0.04), graphite, -0.4, 2.08, z)))
  const grille = phys({ map: T(ventTexture()), metalness: 0.8, roughness: 0.4 })
  ;[-12.75, 11.95].forEach((x) => sink.add(mesh(boxG(0.14, 2.95, 10), [grille, grille, graphite, graphite, graphite, graphite], x, 2.08, 0)))
  ;[-8, 0, 8].forEach((x) => sink.add(mesh(rbox(0.5, 0.12, 10, 0.03), graphite, x, 3.6, 0)))
  // restrained tricolour inlay on the outer rail
  ;['#ff9a3c', '#f4f6f5', '#2c9a46'].forEach((c, i) => sink.add(mesh(boxG(5, 0.07, 0.02), phys({ color: c, roughness: 0.35, metalness: 0.2 }), 7.5, 3.2 - i * 0.12, 5.03)))

  function update(e: number, time: number, signal: number) {
    layers.forEach(({ g, dy }) => (g.position.y = dy * e))
    pcbSub.forEach((m, i) => (m.position.y = pcbBase[i] - i * 0.32 * e))
    die.position.y = 0.3 + 0.75 * e
    busMat.uniforms.uReveal.value = 1
    busMat.uniforms.uFlow.value = time * 0.35
    busMat.uniforms.uPulse.value = signal
  }

  /** world-space position of the die (for camera targeting) */
  const dieWorld = (out: THREE.Vector3) => die.getWorldPosition(out)

  return { group: root, update, dieWorld, layers: layers.map((l) => l.g) }
}

/* ───────────── shared trace rendering ───────────── */

export interface TracePath {
  pts: THREE.Vector3[]
  hot: number // 0 = data (teal pulses), 1 = power (saffron pulses)
}

/** Manhattan / 45° routing between two points on a board */
export function route(a: THREE.Vector3, b: THREE.Vector3, bias: number) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const diag = Math.min(Math.abs(dx), Math.abs(dz)) * bias
  const m1 = a.clone().add(new THREE.Vector3(Math.abs(dx) > Math.abs(dz) ? (Math.abs(dx) - diag) * Math.sign(dx) * 0.5 : 0, 0, Math.abs(dz) >= Math.abs(dx) ? (Math.abs(dz) - diag) * Math.sign(dz) * 0.5 : 0))
  return [a.clone(), m1, m1.clone().add(new THREE.Vector3(diag * Math.sign(dx), 0, diag * Math.sign(dz))), b.clone()]
}

/** flat ribbons with distance-along-path attributes for the pulse shader */
export function traceGeometry(paths: TracePath[], width: number, y: number, rnd: () => number) {
  const pos: number[] = []
  const sA: number[] = []
  const lenA: number[] = []
  const seedA: number[] = []
  const hotA: number[] = []
  const idx: number[] = []
  paths.forEach(({ pts, hot }) => {
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
      const n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(width / 2)
      const base = pos.length / 3
      ;[a.clone().add(n), a.clone().sub(n), b.clone().add(n), b.clone().sub(n)].forEach((v, j) => {
        pos.push(v.x, y, v.z)
        sA.push(j < 2 ? s : s + l)
        lenA.push(total)
        seedA.push(seed)
        hotA.push(hot)
      })
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      s += l
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aS', new THREE.Float32BufferAttribute(sA, 1))
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(lenA, 1))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seedA, 1))
  g.setAttribute('aHot', new THREE.Float32BufferAttribute(hotA, 1))
  g.setIndex(idx)
  return g
}

export function traceMaterial(opts: { baseAlpha?: number; data?: string } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uReveal: { value: 0 },
      uFlow: { value: 0 },
      uPulse: { value: 0 },
      uBase: { value: new THREE.Color('#2b5f78') },
      uTeal: { value: new THREE.Color(opts.data ?? '#2fb8c0') },
      uBaseAlpha: { value: opts.baseAlpha ?? 0.42 },
      uSaff: { value: new THREE.Color('#ff9a3c') },
    },
    vertexShader: /* glsl */ `
      attribute float aS; attribute float aLen; attribute float aSeed; attribute float aHot;
      varying float vS; varying float vLen; varying float vSeed; varying float vHot; varying float vFade;
      void main(){ vS = aS; vLen = aLen; vSeed = aSeed; vHot = aHot;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFade = 1.0 - smoothstep(30.0, 62.0, -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal; uniform float uFlow; uniform float uPulse; uniform float uBaseAlpha; uniform vec3 uBase; uniform vec3 uTeal; uniform vec3 uSaff;
      varying float vS; varying float vLen; varying float vSeed; varying float vHot; varying float vFade;
      void main(){
        float drawn = 1.0 - smoothstep(-0.4, 0.0, vS - uReveal * (vLen + 0.5));
        if (drawn < 0.01) discard;
        // data packets travelling along each trace
        float ph = fract(vS * 0.09 - uFlow * (0.6 + vSeed * 0.6) - vSeed * 7.0);
        float pkt = smoothstep(0.0, 0.025, ph) * (1.0 - smoothstep(0.025, 0.11, ph)) * uPulse;
        vec3 col = mix(uBase, mix(uTeal, uSaff, vHot), pkt);
        gl_FragColor = vec4(col, (uBaseAlpha + pkt * (1.0 - uBaseAlpha)) * drawn * vFade);
        #include <colorspace_fragment>
      }`,
  })
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  r: number
  h: number
  turns: number
  constructor(r: number, h: number, turns: number) {
    super()
    this.r = r
    this.h = h
    this.turns = turns
  }
  getPoint(t: number, out = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * this.turns
    return out.set(Math.cos(a) * this.r, (t - 0.5) * this.h, Math.sin(a) * this.r)
  }
}

/* ───────────── procedural textures ───────────── */

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, linear = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

interface BoardArt {
  smd: [number, number, number][]
  sot: [number, number, number][]
  pins: IcPin[]
}

/**
 * Component side of the PCB. Drawn twice from the same seed: once as albedo
 * (navy solder mask, gold copper routing, tinned pads, silkscreen) and once
 * as a metal/roughness map (G = roughness, B = metalness) so the copper and
 * pads catch real reflections while the mask stays satin.
 */
function pcbTexture(s: number, art: BoardArt, mr: boolean) {
  const W = 26 * s
  const H = 11 * s
  return canvasTex(
    W,
    H,
    (g) => {
      const X = (x: number) => (x + 13) * s
      const Z = (z: number) => (z + 5.5) * s
      const C = mr
        ? { bg: 'rgb(0,150,25)', pour: 'rgb(0,120,70)', cu: 'rgb(0,75,255)', cuDim: 'rgb(0,95,235)', pad: 'rgb(0,55,255)', hole: 'rgb(0,220,0)', silk: 'rgb(0,175,0)' }
        : { bg: '#0d1c28', pour: '#15303b', cu: '#cf9f4e', cuDim: '#a07a3e', pad: '#d9dcdf', hole: '#060c11', silk: 'rgba(232,238,242,0.85)' }
      const r = mulberry(5)
      g.fillStyle = C.bg
      g.fillRect(0, 0, W, H)
      g.lineCap = 'round'
      g.lineJoin = 'round'
      const circle = (x: number, z: number, rad: number) => {
        g.beginPath()
        g.arc(X(x), Z(z), Math.max(0.6, rad * s), 0, Math.PI * 2)
        g.fill()
      }
      const rect = (x: number, z: number, w: number, d: number) => g.fillRect(X(x - w / 2), Z(z - d / 2), Math.max(1, w * s), Math.max(1, d * s))
      const line = (pts: number[][], w: number, col: string) => {
        g.strokeStyle = col
        g.lineWidth = Math.max(1, w * s)
        g.beginPath()
        pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))))
        g.stroke()
      }
      const via = (x: number, z: number, rad = 0.032) => {
        g.fillStyle = C.cu
        circle(x, z, rad)
        g.fillStyle = C.hole
        circle(x, z, rad * 0.45)
      }
      // 45° jog route between two points
      const jog = (ax: number, az: number, bx: number, bz: number) => {
        const dx = bx - ax
        const dz = bz - az
        const d = Math.min(Math.abs(dx), Math.abs(dz))
        if (Math.abs(dx) > Math.abs(dz)) {
          const run = (Math.abs(dx) - d) / 2
          return [[ax, az], [ax + Math.sign(dx) * run, az], [ax + Math.sign(dx) * (run + d), bz], [bx, bz]]
        }
        const run = (Math.abs(dz) - d) / 2
        return [[ax, az], [ax, az + Math.sign(dz) * run], [bx, az + Math.sign(dz) * (run + d)], [bx, bz]]
      }
      const bus = (ax: number, az: number, bx: number, bz: number, n: number, gap: number, w: number, col = C.cu) => {
        const len = Math.hypot(bx - ax, bz - az) || 1
        const nx = -(bz - az) / len
        const nz = (bx - ax) / len
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * gap
          const pts = jog(ax + nx * o, az + nz * o, bx + nx * o * 0.8, bz + nz * o * 0.8)
          line(pts, w, col)
          if (i % 2 === 0) via(pts[3][0], pts[3][1], 0.026)
        }
      }

      // copper pours: power planes under the power stages and around the package
      g.fillStyle = C.pour
      rect(7.6, -3.7, 7.6, 1.8)
      rect(7.6, 3.7, 7.6, 1.8)
      rect(-10.8, -4.0, 3.6, 1.6)
      rect(PKG_X, 0, 6.6, 6.6)

      // fine background routing: branching tracks weaving between the parts
      for (let i = 0; i < 2600; i++) {
        let x = -12.8 + r() * 25.6
        let z = -5.3 + r() * 10.6
        const pts = [[x, z]]
        const segs = 2 + Math.floor(r() * 3)
        for (let k = 0; k < segs; k++) {
          const l = 0.2 + r() * 1.4
          const dir = Math.floor(r() * 6)
          if (dir < 2) x += dir ? l : -l
          else if (dir < 4) z += dir === 2 ? l : -l
          else {
            x += l * 0.7 * (r() > 0.5 ? 1 : -1)
            z += l * 0.7 * (dir === 4 ? 1 : -1)
          }
          pts.push([x, z])
        }
        line(pts, 0.012 + r() * 0.02, r() > 0.35 ? C.cuDim : C.cu)
        via(x, z, 0.022 + r() * 0.012)
      }

      // GPU ↔ memory: 16-bit-wide matched buses
      VRAM.forEach(([x, z]) => {
        if (Math.abs(z) > 3.5) bus(x * 0.6 + PKG_X * 0.4, Math.sign(z) * 2.85, x, z - Math.sign(z) * 0.62, 16, 0.042, 0.02)
        else bus(PKG_X + Math.sign(x - PKG_X) * 2.85, z * 0.7, x - Math.sign(x - PKG_X) * 0.72, z, 16, 0.042, 0.02)
      })
      // GPU → PCIe edge connector: differential pairs fanning out to the fingers
      for (let i = 0; i < 28; i++) {
        const sx = PKG_X - 2.4 + i * (4.8 / 27)
        const tx = -8.2 + i * (10.4 / 27)
        line([[sx, 2.85], [sx, 3.2 + (i % 2) * 0.04], [tx, 3.2 + Math.abs(tx - sx) + (i % 2) * 0.04], [tx, 5.45]], 0.018, C.cu)
      }
      // power: wide feeds from each phase into the package, plus memory power
      ;[-1, 1].forEach((sz) => {
        PHASE_X.forEach((x, i) => {
          line([[x, sz * 3.25], [x, sz * 2.8], [PKG_X + 3.0, sz * (1.2 + i * 0.18)]], 0.12, C.cu)
          line([[x, sz * 4.1], [x, sz * 3.4]], 0.22, C.cu)
        })
      })
      MEM_PH.forEach((x) => line([[x, -4.4], [x, -3.6], [-6.3, -2.4 - (x + 12) * 0.2]], 0.1, C.cu))
      // IC breakouts: each part routes a bus to the package or a neighbour
      ICS.forEach((c, i) => {
        const tgt = i % 3 === 0 ? [PKG_X + (c.x < PKG_X ? -2.9 : 2.9), c.z * 0.5] : [ICS[(i + 1) % ICS.length].x, ICS[(i + 1) % ICS.length].z]
        bus(c.x + (tgt[0] > c.x ? c.w / 2 + 0.2 : -c.w / 2 - 0.2), c.z, tgt[0], tgt[1], 8, 0.05, 0.018)
      })

      // pads and solder lands under every part
      g.fillStyle = C.pad
      const nb = 24
      for (let i = 0; i < nb * nb; i++) circle(PKG_X - 2.5 + (i % nb) * (5 / (nb - 1)), -2.5 + Math.floor(i / nb) * (5 / (nb - 1)), 0.065)
      VRAM.forEach(([vx, vz]) => {
        for (let k = 0; k < 64; k++) circle(vx - 0.5 + (k % 8) * (1 / 7), vz - 0.42 + Math.floor(k / 8) * (0.84 / 7), 0.04)
      })
      art.smd.forEach(([x, z, rot]) => {
        ;[-1, 1].forEach((sd) => {
          const d = sd * 0.05
          if (rot) rect(x, z - d, 0.065, 0.045)
          else rect(x + d, z, 0.045, 0.065)
        })
      })
      art.sot.forEach(([x, z, rot]) => {
        ;[[-0.09, 0.14], [0.09, 0.14], [0, -0.14]].forEach(([lx, lz]) => {
          const px = rot ? lz : lx
          const pz = rot ? -lx : lz
          rect(x + px, z + pz, 0.07, 0.07)
        })
      })
      art.pins.forEach((p) => {
        const ox = Math.sin(p.r) * 0.03
        const oz = Math.cos(p.r) * 0.03
        if (p.r) rect(p.x + ox, p.z + oz, 0.16, 0.05)
        else rect(p.x + ox, p.z + oz, 0.05, 0.16)
      })
      ;[...PHASE_X.flatMap((x) => [[x, -4.1], [x, 4.1]]), ...MEM_PH.map((x) => [x, -4.4])].forEach(([x, z]) => {
        rect(x - 0.24, z, 0.22, 0.6)
        rect(x + 0.24, z, 0.22, 0.6)
      })
      ;[...PHASE_X.flatMap((x) => [[x, -3.25], [x, 3.25]]), ...MEM_PH.map((x) => [x, -3.6])].forEach(([x, z]) => rect(x, z, 0.56, 0.6))

      // silkscreen: outlines and reference designators
      g.strokeStyle = C.silk
      g.fillStyle = C.silk
      g.lineWidth = Math.max(1, s * 0.016)
      g.font = `${Math.round(s * 0.17)}px monospace`
      g.strokeRect(X(PKG_X - 3), Z(-3), 6 * s, 6 * s)
      g.fillText('GPU1', X(PKG_X - 2.9), Z(-3.08))
      VRAM.forEach(([x, z], i) => {
        g.strokeRect(X(x - 0.8), Z(z - 0.7), 1.6 * s, 1.4 * s)
        g.fillText(`M${i + 1}`, X(x - 0.78), Z(z - 0.76))
      })
      PHASE_X.forEach((x, i) => {
        ;[-4.1, 4.1].forEach((z, j) => {
          g.strokeRect(X(x - 0.4), Z(z - 0.4), 0.8 * s, 0.8 * s)
          g.fillText(`L${i + 1 + j * 8}`, X(x - 0.38), Z(z + (z < 0 ? 0.62 : -0.46)))
        })
      })
      ICS.forEach((c, i) => {
        g.strokeRect(X(c.x - c.w / 2 - 0.12), Z(c.z - c.d / 2 - 0.12), (c.w + 0.24) * s, (c.d + 0.24) * s)
        g.fillText(`U${i + 2}`, X(c.x - c.w / 2), Z(c.z - c.d / 2 - 0.18))
      })
      for (let i = 0; i < 160; i++) {
        const p = art.smd[Math.floor(r() * art.smd.length)]
        g.fillText(`${r() > 0.4 ? 'C' : 'R'}${100 + Math.floor(r() * 900)}`, X(p[0] + 0.07), Z(p[1] - 0.06))
      }
      g.font = `${Math.round(s * 0.24)}px monospace`
      g.fillText('REV A02', X(-12.2), Z(5.0))
      g.fillText('PCIe x16', X(-6), Z(5.25))
      // plated mounting holes
      ;[[PKG_X - 3.4, -3.4], [PKG_X + 3.4, -3.4], [PKG_X - 3.4, 3.4], [PKG_X + 3.4, 3.4], [-12.3, -5], [-12.3, 5], [12.3, -5], [12.3, 5]].forEach(([x, z]) => {
        g.fillStyle = C.cu
        circle(x, z, 0.22)
        g.fillStyle = C.hole
        circle(x, z, 0.12)
      })
    },
    mr,
  )
}

function icTexture(label: string) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#15191d'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(205,214,222,0.65)'
    g.font = 'bold 44px monospace'
    g.textAlign = 'center'
    g.fillText(label, 128, 120)
    g.font = '24px monospace'
    g.fillText('2611 A7', 128, 160)
    g.beginPath()
    g.arc(34, 34, 10, 0, Math.PI * 2)
    g.fill()
  })
}

function copperPlaneTexture() {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = '#b8743f'
    g.fillRect(0, 0, 512, 256)
    const r = mulberry(14)
    g.fillStyle = 'rgba(40,24,12,0.55)'
    for (let i = 0; i < 260; i++) g.fillRect(r() * 512, r() * 256, 2 + r() * 3, 2 + r() * 3) // anti-pads
    g.strokeStyle = 'rgba(40,24,12,0.5)'
    g.lineWidth = 2
    for (let i = 0; i < 30; i++) {
      g.beginPath()
      const y = r() * 256
      g.moveTo(0, y)
      g.lineTo(512, y + (r() - 0.5) * 30)
      g.stroke()
    }
  })
}

/** GPU die: graphics processing clusters of SM tiles, central L2, memory PHYs on the edges */
function dieTexture(N: number) {
  return canvasTex(N, N, (g) => {
    const s = N / 1024
    g.fillStyle = '#18232d'
    g.fillRect(0, 0, N, N)
    const r = mulberry(8)
    const m = 70 * s
    // memory PHY strips on all four edges
    g.fillStyle = 'rgba(214,180,120,0.55)'
    for (let k = m; k < N - m; k += 9 * s) {
      g.fillRect(k, 20 * s, 5 * s, 30 * s)
      g.fillRect(k, N - 50 * s, 5 * s, 30 * s)
      g.fillRect(20 * s, k, 30 * s, 5 * s)
      g.fillRect(N - 50 * s, k, 30 * s, 5 * s)
    }
    // 8 GPCs in a 4×2 grid, L2 band between the rows
    const gw = (N - 2 * m) / 4
    const gh = (N - 2 * m - 110 * s) / 2
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 4; i++) {
        const gx = m + i * gw
        const gy = m + j * (gh + 110 * s)
        g.fillStyle = '#20303c'
        g.fillRect(gx + 5 * s, gy + 5 * s, gw - 10 * s, gh - 10 * s)
        // SM tiles: 3 × 6
        const cw = (gw - 20 * s) / 3
        const ch = (gh - 20 * s) / 6
        for (let b = 0; b < 6; b++) {
          for (let a = 0; a < 3; a++) {
            const x = gx + 10 * s + a * cw
            const y = gy + 10 * s + b * ch
            g.fillStyle = `hsl(${196 + r() * 14}, 28%, ${24 + r() * 6}%)`
            g.fillRect(x + 2 * s, y + 2 * s, cw - 4 * s, ch - 4 * s)
            // four processing partitions + tensor block + L1 strip
            for (let q = 0; q < 4; q++) {
              g.fillStyle = 'rgba(130,205,215,0.25)'
              g.fillRect(x + 5 * s + q * ((cw - 10 * s) / 4), y + 5 * s, (cw - 10 * s) / 4 - 2 * s, ch * 0.42)
            }
            g.fillStyle = 'rgba(240,170,96,0.28)'
            g.fillRect(x + 5 * s, y + ch * 0.55, cw - 10 * s, ch * 0.16)
            g.fillStyle = 'rgba(210,225,235,0.18)'
            g.fillRect(x + 5 * s, y + ch * 0.76, cw - 10 * s, ch * 0.1)
          }
        }
      }
    }
    // L2 cache: two banks with fine SRAM texture
    const ly = m + gh + 10 * s
    g.fillStyle = '#35505f'
    g.fillRect(m + 5 * s, ly, N - 2 * m - 10 * s, 90 * s)
    g.fillStyle = 'rgba(220,235,240,0.22)'
    for (let x = m + 8 * s; x < N - m - 8 * s; x += 6 * s) g.fillRect(x, ly + 4 * s, 3 * s, 82 * s)
    g.fillStyle = '#1b2a35'
    g.fillRect(N / 2 - 30 * s, ly, 60 * s, 90 * s) // crossbar
    // top metal: very fine horizontal routing over everything
    g.fillStyle = 'rgba(200,220,230,0.05)'
    for (let y = 0; y < N; y += 3 * s) g.fillRect(0, y, N, Math.max(1, s))
    g.strokeStyle = 'rgba(214,180,120,0.5)'
    g.lineWidth = 6 * s
    g.strokeRect(10 * s, 10 * s, N - 20 * s, N - 20 * s)
  })
}

function substrateTexture() {
  return canvasTex(2048, 2048, (g) => {
    g.fillStyle = '#10232b'
    g.fillRect(0, 0, 2048, 2048)
    const r = mulberry(12)
    g.lineCap = 'round'
    // dense gold fan-out from the die edge to the substrate's ball field
    for (let i = 0; i < 1400; i++) {
      g.strokeStyle = `rgba(${r() > 0.3 ? '214,168,88' : '168,132,72'},${0.45 + r() * 0.45})`
      g.lineWidth = 1 + r() * 2.5
      const side = Math.floor(r() * 4)
      const k = 260 + r() * 1528
      const out = 40 + r() * 200
      const bend = (r() - 0.5) * 160
      const [x0, y0] = side === 0 ? [k, 330] : side === 1 ? [k, 1718] : side === 2 ? [330, k] : [1718, k]
      const [dx, dy] = side === 0 ? [0, -1] : side === 1 ? [0, 1] : side === 2 ? [-1, 0] : [1, 0]
      const x1 = x0 + dx * out
      const y1 = y0 + dy * out
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
      g.lineTo(x1 + (dx ? 0 : bend) + dx * Math.abs(bend), y1 + (dy ? 0 : bend) + dy * Math.abs(bend))
      g.stroke()
      g.fillStyle = 'rgba(220,180,104,0.9)'
      g.beginPath()
      g.arc(x1 + (dx ? 0 : bend) + dx * Math.abs(bend), y1 + (dy ? 0 : bend) + dy * Math.abs(bend), 3.5, 0, Math.PI * 2)
      g.fill()
    }
    g.scale(2, 2) // edge pads and marker below are laid out on a 1024 grid
    g.fillStyle = 'rgba(214,176,108,0.85)'
    for (let k = 24; k < 1000; k += 24) {
      g.fillRect(k, 12, 10, 10)
      g.fillRect(k, 1002, 10, 10)
      g.fillRect(12, k, 10, 10)
      g.fillRect(1002, k, 10, 10)
    }
    g.fillStyle = 'rgba(230,236,240,0.7)'
    g.beginPath()
    g.arc(60, 60, 12, 0, Math.PI * 2)
    g.fill() // pin-1 marker
  })
}

function vramTexture() {
  return canvasTex(256, 220, (g) => {
    g.fillStyle = '#1a2026'
    g.fillRect(0, 0, 256, 220)
    g.fillStyle = 'rgba(200,212,220,0.7)'
    g.font = 'bold 30px monospace'
    g.fillText('D7 24Gb', 34, 92)
    g.font = '20px monospace'
    g.fillText('4LB12 X9K', 34, 130)
    g.fillText('2611  B3', 34, 160)
    g.beginPath()
    g.arc(26, 26, 8, 0, Math.PI * 2)
    g.fill()
  })
}

function labelTexture(text: string, bg: string) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = 'rgba(225,232,238,0.75)'
    g.font = 'bold 34px monospace'
    g.textAlign = 'center'
    g.fillText(text, 64, 76)
  })
}

function capTopTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#c3c9ce'
    g.fillRect(0, 0, 128, 128)
    g.strokeStyle = 'rgba(70,78,86,0.7)'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(30, 64)
    g.lineTo(98, 64)
    g.moveTo(64, 30)
    g.lineTo(64, 98)
    g.stroke()
  })
}

function fingerTexture() {
  return canvasTex(1024, 64, (g) => {
    g.fillStyle = '#0f1e2b'
    g.fillRect(0, 0, 1024, 64)
    g.fillStyle = '#d6a84e'
    for (let x = 4; x < 1020; x += 12) g.fillRect(x, 6, 8, 52)
  })
}

function pasteTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#9ea4aa'
    g.fillRect(0, 0, 256, 256)
    const r = mulberry(3)
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${r() > 0.5 ? 255 : 60},${r() > 0.5 ? 255 : 66},${r() > 0.5 ? 255 : 72},0.12)`
      g.lineWidth = 2 + r() * 4
      g.beginPath()
      g.arc(128, 128, 10 + r() * 140, r() * 6, r() * 6 + 1.5)
      g.stroke()
    }
  })
}

function milledTexture() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#c5cbd0'
    g.fillRect(0, 0, 1024, 1024)
    // fly-cut arcs from machining
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${i % 2 ? 255 : 90},${i % 2 ? 255 : 98},${i % 2 ? 255 : 106},0.08)`
      g.lineWidth = 2
      g.beginPath()
      g.arc(-600, 512, 700 + i * 4, -0.9, 0.9)
      g.stroke()
    }
  })
}

export function brushedTexture(base: string) {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, 512, 512)
    const r = mulberry(17)
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 255 : 90},${r() > 0.5 ? 255 : 100},${r() > 0.5 ? 255 : 110},${r() * 0.06})`
      g.fillRect(0, r() * 512, 512, 1)
    }
  })
}

function ventTexture() {
  return canvasTex(1024, 512, (g) => {
    g.fillStyle = '#272e35'
    g.fillRect(0, 0, 1024, 512)
    g.fillStyle = '#12171b'
    for (let y = 60; y < 460; y += 34) {
      for (let x = 60; x < 980; x += 120) {
        g.beginPath()
        g.roundRect(x, y, 96, 14, 7)
        g.fill()
      }
    }
  })
}

function bracketTexture() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#b9c0c6'
    g.fillRect(0, 0, 512, 512)
    g.fillStyle = '#1a1f24'
    for (let i = 0; i < 4; i++) {
      g.beginPath()
      g.roundRect(70 + i * 96, 300, 70, 34, 8)
      g.fill()
    }
    for (let y = 60; y < 260; y += 26) for (let x = 60; x < 460; x += 26) {
      g.beginPath()
      g.arc(x, y, 7, 0, Math.PI * 2)
      g.fill()
    }
  })
}

export function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
