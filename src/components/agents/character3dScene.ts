import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createVaaniCharacter } from './vaaniCharacter'
import type { SpeechState, AudioTelemetry } from './vaaniAudioEngine'

export interface CharacterSceneApi {
  selectAgent(id: string): void
  setVaaniState(state: SpeechState): void
  updateAudioTelemetry(telemetry: AudioTelemetry): void
  setVisible(visible: boolean): void
  dispose(): void
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

export function createCharacterScene(
  canvas: HTMLCanvasElement,
  opts: {
    reducedMotion?: boolean
    initialAgentId?: string
    onAgentSelected?: (id: string) => void
  }
): CharacterSceneApi {
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(obj: T): T => {
    disposables.push(obj)
    return obj
  }

  // 1. Renderer Setup
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // 2. Scene & Environment
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.05).texture
  scene.environment = envTexture
  track(envTexture)
  track(pmrem)

  // 3. Camera Framing (Elevated three-quarter portrait perspective)
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  camera.position.set(0, 1.2, 4.4)
  const cameraTarget = new THREE.Vector3(0, 1.05, 0)
  camera.lookAt(cameraTarget)

  // 4. Studio Lighting
  const hemiLight = new THREE.HemisphereLight('#f8fafc', '#0f2334', 0.85)
  scene.add(hemiLight)

  // Key light: crisp, casting soft shadow on ground
  const keyLight = new THREE.DirectionalLight('#ffffff', 2.0)
  keyLight.position.set(2.8, 5.5, 4.2)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  keyLight.shadow.camera.near = 0.5
  keyLight.shadow.camera.far = 15
  keyLight.shadow.bias = -0.0008
  scene.add(keyLight)

  // Rim lights: define the silhouette contours against the background
  const rimLightLeft = new THREE.DirectionalLight('#9ad5e5', 2.2)
  rimLightLeft.position.set(-4.5, 3.2, -3.5)
  scene.add(rimLightLeft)

  const rimLightRight = new THREE.DirectionalLight('#f5dcb7', 1.2)
  rimLightRight.position.set(4.5, 2.5, -3.0)
  scene.add(rimLightRight)

  // Ground bounce & active character accent light
  const accentLight = new THREE.PointLight('#1d6a80', 5.0, 8, 1.6)
  accentLight.position.set(0, 0.3, 0.8)
  scene.add(accentLight)

  const cursorLight = new THREE.PointLight('#e0f2fe', 2.0, 7, 2)
  scene.add(cursorLight)

  // 5. Materials Factory
  const rbox = (w: number, h: number, d: number, r = 0.03, seg = 3) =>
    track(new RoundedBoxGeometry(w, h, d, seg, r))
  const phys = (p: THREE.MeshPhysicalMaterialParameters) =>
    track(new THREE.MeshPhysicalMaterial(p))

  // Core material palette
  const matCeramicWhite = phys({ color: '#f8fafc', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1 })
  const matNavyArmor = phys({ color: '#13283a', metalness: 0.75, roughness: 0.25, clearcoat: 0.8 })
  const matGraphite = phys({ color: '#1e293b', metalness: 0.85, roughness: 0.3 })
  const matGoldTrim = phys({ color: '#d5b68a', metalness: 0.95, roughness: 0.22, clearcoat: 0.5 })
  const matFrostedGlass = phys({ color: '#dceef5', transmission: 0.82, thickness: 0.7, roughness: 0.08, transparent: true, opacity: 0.88 })
  const matGlow = (c: string, i = 2.8) =>
    phys({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.2 })

  // 6. Refined Minimal Pedestal (Low profile floor reflector)
  const pedestalGroup = new THREE.Group()
  scene.add(pedestalGroup)

  const floorDiscGeo = track(new THREE.CylinderGeometry(1.65, 1.75, 0.04, 64))
  const floorDiscMat = phys({ color: '#0d1d2b', metalness: 0.8, roughness: 0.25 })
  const floorDisc = new THREE.Mesh(floorDiscGeo, floorDiscMat)
  floorDisc.position.y = -0.02
  floorDisc.receiveShadow = true
  pedestalGroup.add(floorDisc)

  const glowRingGeo = track(new THREE.RingGeometry(1.4, 1.6, 64))
  const glowRingMat = phys({ color: '#1d6a80', emissive: '#1d6a80', emissiveIntensity: 1.5, roughness: 0.3, transparent: true, opacity: 0.75 })
  const glowRingMesh = new THREE.Mesh(glowRingGeo, glowRingMat)
  glowRingMesh.rotation.x = -Math.PI / 2
  glowRingMesh.position.y = 0.003
  pedestalGroup.add(glowRingMesh)

  // 7. Characters Setup
  const charactersRoot = new THREE.Group()
  scene.add(charactersRoot)

  interface AgentCharacter {
    id: string
    group: THREE.Group
    accentColor: string
    update: (time: number, dt: number, isSelected: boolean) => void
  }

  const agents: AgentCharacter[] = []

  // Shared Helper: Builds articulated stylized humanoid legs & boots
  const buildHumanoidLegs = (parent: THREE.Group, pantsMat: THREE.Material, armorMat: THREE.Material, bootMat: THREE.Material) => {
    const legsGroup = new THREE.Group()
    parent.add(legsGroup)

    ;([-0.16, 0.16] as const).forEach((xOffset) => {
      // Upper leg (Thigh)
      const thigh = new THREE.Mesh(rbox(0.15, 0.44, 0.16, 0.04), pantsMat)
      thigh.position.set(xOffset, 0.75, 0)
      thigh.castShadow = true
      legsGroup.add(thigh)

      // Knee Guard
      const knee = new THREE.Mesh(rbox(0.13, 0.12, 0.14, 0.03), armorMat)
      knee.position.set(xOffset, 0.52, 0.04)
      knee.castShadow = true
      legsGroup.add(knee)

      // Lower leg (Shin / Greave)
      const shin = new THREE.Mesh(rbox(0.14, 0.42, 0.15, 0.03), armorMat)
      shin.position.set(xOffset, 0.28, 0.01)
      shin.castShadow = true
      legsGroup.add(shin)

      // Stylized Boot
      const boot = new THREE.Mesh(rbox(0.15, 0.12, 0.26, 0.03), bootMat)
      boot.position.set(xOffset, 0.06, 0.04)
      boot.castShadow = true
      legsGroup.add(boot)
    })

    return legsGroup
  }

  // ─── 01. VAANI — VOICE AI AGENT (High-Fidelity Humanoid Prototype) ────────
  let currentTelemetry: AudioTelemetry = {
    isMicActive: false,
    isSpeaking: false,
    decibels: 0,
    peakFrequency: 0,
    waveform: [0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4, 0.2],
  }

  const vaani = createVaaniCharacter(track)
  charactersRoot.add(vaani.group)

  agents.push({
    id: 'vaani',
    group: vaani.group,
    accentColor: '#1d6a80',
    update: (time, dt, isSelected) => {
      vaani.update(time, dt, currentTelemetry, isSelected)
    },
  })

  // ─── 02. AI TUTOR AGENT ─────────────────────────────────────────────────
  {
    const tutor = new THREE.Group()
    charactersRoot.add(tutor)

    buildHumanoidLegs(tutor, matNavyArmor, matGraphite, matNavyArmor)

    // Flowing Scholastic Robe / Mantle (Extends over legs)
    const robeLower = new THREE.Mesh(rbox(0.56, 0.7, 0.32, 0.08), phys({ color: '#163856', roughness: 0.4, clearcoat: 0.5 }))
    robeLower.position.set(0, 0.65, -0.02)
    robeLower.castShadow = true
    tutor.add(robeLower)

    // Torso with Scholarly Sash
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 1.08
    tutor.add(torsoGroup)

    const torso = new THREE.Mesh(rbox(0.48, 0.56, 0.28, 0.06), phys({ color: '#2c64a0', metalness: 0.5, roughness: 0.3 }))
    torso.position.y = 0.28
    torso.castShadow = true
    torsoGroup.add(torso)

    const sash = new THREE.Mesh(rbox(0.18, 0.58, 0.32, 0.04), matGoldTrim)
    sash.position.set(-0.08, 0.28, 0.02)
    torsoGroup.add(sash)

    // Left Arm holding floating knowledge tablet
    const armL = new THREE.Group()
    armL.position.set(-0.3, 0.46, 0)
    torsoGroup.add(armL)

    const upperArmL = new THREE.Mesh(rbox(0.12, 0.28, 0.12, 0.03), matNavyArmor)
    upperArmL.position.set(-0.06, -0.14, 0.05)
    upperArmL.rotation.z = 0.25
    upperArmL.rotation.x = -0.2
    armL.add(upperArmL)

    const forearmL = new THREE.Mesh(rbox(0.11, 0.28, 0.11, 0.03), matCeramicWhite)
    forearmL.position.set(-0.08, -0.26, 0.2)
    forearmL.rotation.x = -0.9
    armL.add(forearmL)

    // Floating Holographic Tablet in Left Hand
    const tabletMesh = new THREE.Mesh(rbox(0.26, 0.36, 0.02, 0.01), matFrostedGlass)
    tabletMesh.position.set(-0.1, -0.2, 0.38)
    tabletMesh.rotation.x = -0.4
    armL.add(tabletMesh)

    // Right Arm (Outstretched in open teaching/explanatory gesture)
    const armR = new THREE.Group()
    armR.position.set(0.3, 0.46, 0)
    torsoGroup.add(armR)

    const upperArmR = new THREE.Mesh(rbox(0.12, 0.3, 0.12, 0.03), matNavyArmor)
    upperArmR.position.set(0.1, -0.12, 0.08)
    upperArmR.rotation.z = -0.4
    upperArmR.rotation.x = -0.3
    armR.add(upperArmR)

    const forearmR = new THREE.Mesh(rbox(0.11, 0.3, 0.11, 0.03), matCeramicWhite)
    forearmR.position.set(0.26, -0.16, 0.28)
    forearmR.rotation.x = -0.6
    forearmR.rotation.z = -0.2
    armR.add(forearmR)

    const handR = new THREE.Mesh(rbox(0.08, 0.09, 0.04, 0.02), matGoldTrim)
    handR.position.set(0.34, -0.12, 0.42)
    armR.add(handR)

    // Scholar Head & Visor
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.74, 0)
    torsoGroup.add(headGroup)

    const head = new THREE.Mesh(rbox(0.28, 0.34, 0.28, 0.08), matCeramicWhite)
    head.castShadow = true
    headGroup.add(head)

    const scholarVisor = new THREE.Mesh(rbox(0.24, 0.09, 0.08, 0.02), matGlow('#3b82f6', 2.8))
    scholarVisor.position.set(0, 0.03, 0.13)
    headGroup.add(scholarVisor)

    // Orbiting Holographic Knowledge Glyphs (Atoms, geometric crystals)
    const glyphsGroup = new THREE.Group()
    glyphsGroup.position.set(0.3, 1.4, 0.3)
    tutor.add(glyphsGroup)

    const glyphNodes: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const gMesh = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.07, 0)), matGlow('#2c64a0', 2.2))
      glyphsGroup.add(gMesh)
      glyphNodes.push(gMesh)
    }

    agents.push({
      id: 'tutor',
      group: tutor,
      accentColor: '#2c64a0',
      update: (time, _dt, _isSelected) => {
        const breath = Math.sin(time * 1.8) * 0.016
        torsoGroup.position.y = 1.08 + breath
        torsoGroup.rotation.y = Math.sin(time * 0.6) * 0.03
        headGroup.rotation.y = Math.sin(time * 0.5) * 0.06

        // Gentle teaching gesture modulation
        armR.position.y = 0.46 + Math.sin(time * 2.0) * 0.02
        armR.rotation.y = Math.sin(time * 1.2) * 0.06

        // Floating knowledge glyphs
        glyphNodes.forEach((g, i) => {
          const a = time * 1.2 + (i / 3) * Math.PI * 2
          g.position.set(Math.cos(a) * 0.32, Math.sin(time * 2 + i) * 0.1, Math.sin(a) * 0.32)
          g.rotation.x = time * 1.5
          g.rotation.y = time * 2.0
        })
      },
    })
  }

  // ─── 03. CHEATING DETECTION AGENT ───────────────────────────────────────
  {
    const sentinel = new THREE.Group()
    charactersRoot.add(sentinel)

    // Heavy Sentinel Armored Legs (Wider stance)
    const legsGroup = new THREE.Group()
    sentinel.add(legsGroup)
    ;([-0.22, 0.22] as const).forEach((xOffset) => {
      const thigh = new THREE.Mesh(rbox(0.18, 0.44, 0.18, 0.04), matNavyArmor)
      thigh.position.set(xOffset, 0.74, 0)
      thigh.castShadow = true
      legsGroup.add(thigh)

      const knee = new THREE.Mesh(rbox(0.16, 0.14, 0.16, 0.03), matGraphite)
      knee.position.set(xOffset, 0.52, 0.04)
      knee.castShadow = true
      legsGroup.add(knee)

      const shin = new THREE.Mesh(rbox(0.16, 0.42, 0.16, 0.03), matNavyArmor)
      shin.position.set(xOffset, 0.28, 0.01)
      shin.castShadow = true
      legsGroup.add(shin)

      const boot = new THREE.Mesh(rbox(0.18, 0.13, 0.28, 0.04), matGraphite)
      boot.position.set(xOffset, 0.065, 0.04)
      boot.castShadow = true
      legsGroup.add(boot)
    })

    // Heavy Plated Torso
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 1.08
    sentinel.add(torsoGroup)

    const chestArmor = new THREE.Mesh(rbox(0.56, 0.54, 0.34, 0.08), matNavyArmor)
    chestArmor.position.y = 0.3
    chestArmor.castShadow = true
    torsoGroup.add(chestArmor)

    // Security Core Badge
    const securityInsignia = new THREE.Mesh(rbox(0.2, 0.24, 0.06, 0.02), matGlow('#b84848', 2.8))
    securityInsignia.position.set(0, 0.36, 0.18)
    torsoGroup.add(securityInsignia)

    // Heavy Reinforced Shoulders
    ;([-0.36, 0.36] as const).forEach((x) => {
      const pauldron = new THREE.Mesh(rbox(0.2, 0.18, 0.22, 0.04), matGraphite)
      pauldron.position.set(x, 0.5, 0)
      pauldron.castShadow = true
      torsoGroup.add(pauldron)
    })

    // Left Arm holding Hexagonal Telemetry Shield
    const armL = new THREE.Group()
    armL.position.set(-0.36, 0.46, 0)
    torsoGroup.add(armL)

    const forearmL = new THREE.Mesh(rbox(0.13, 0.3, 0.13, 0.03), matNavyArmor)
    forearmL.position.set(-0.06, -0.22, 0.18)
    forearmL.rotation.x = -0.7
    armL.add(forearmL)

    // Projected Hexagonal Holographic Integrity Shield
    const shieldMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 6)), matFrostedGlass)
    shieldMesh.rotation.x = Math.PI / 2
    shieldMesh.position.set(-0.1, -0.2, 0.38)
    armL.add(shieldMesh)

    const shieldBorder = new THREE.Mesh(track(new THREE.TorusGeometry(0.36, 0.015, 6, 6)), matGlow('#b84848', 2.2))
    shieldBorder.position.set(-0.1, -0.2, 0.39)
    armL.add(shieldBorder)

    // Right Arm (Vigilant sentinel grip)
    const armR = new THREE.Group()
    armR.position.set(0.36, 0.46, 0)
    torsoGroup.add(armR)

    const forearmR = new THREE.Mesh(rbox(0.13, 0.32, 0.13, 0.03), matNavyArmor)
    forearmR.position.set(0.04, -0.28, 0.06)
    forearmR.rotation.x = 0.2
    armR.add(forearmR)

    // Sentinel Head & Scanning Visor
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.74, 0.02)
    torsoGroup.add(headGroup)

    const head = new THREE.Mesh(rbox(0.32, 0.34, 0.32, 0.08), matCeramicWhite)
    head.castShadow = true
    headGroup.add(head)

    const scanVisor = new THREE.Mesh(rbox(0.3, 0.08, 0.09, 0.02), matGlow('#ef4444', 3.5))
    scanVisor.position.set(0, 0.04, 0.16)
    headGroup.add(scanVisor)

    // Volumetric Laser Sweep Fan
    const sweepFanGroup = new THREE.Group()
    sweepFanGroup.position.set(0, 0.74, 0.16)
    torsoGroup.add(sweepFanGroup)

    const sweepGeo = track(new THREE.ConeGeometry(1.4, 2.4, 32, 1, true, 0, Math.PI / 3.5))
    const sweepMat = phys({
      color: '#b84848',
      emissive: '#b84848',
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
    const sweepCone = new THREE.Mesh(sweepGeo, sweepMat)
    sweepCone.rotation.x = Math.PI / 2
    sweepCone.position.set(0, -0.8, 1.2)
    sweepFanGroup.add(sweepCone)

    agents.push({
      id: 'cheating-detection',
      group: sentinel,
      accentColor: '#b84848',
      update: (time, _dt, isSelected) => {
        // Deep sentinel breathing
        const breath = Math.sin(time * 2.0) * 0.015
        torsoGroup.position.y = 1.08 + breath

        // Measured surveillance sweep
        const sweepAngle = Math.sin(time * 1.6) * 0.45
        headGroup.rotation.y = sweepAngle
        sweepFanGroup.rotation.y = sweepAngle

        // Shield hover and rotation
        shieldMesh.rotation.z = time * 0.3
        shieldBorder.rotation.z = time * 0.3
        sweepMat.opacity = isSelected ? 0.25 : 0.12
      },
    })
  }

  // ─── 04. AI ASSESSMENT AGENT ────────────────────────────────────────────
  {
    const assessment = new THREE.Group()
    charactersRoot.add(assessment)

    buildHumanoidLegs(assessment, matNavyArmor, matCeramicWhite, matNavyArmor)

    // Tailored Asymmetric Evaluator Chassis
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 1.08
    assessment.add(torsoGroup)

    const torso = new THREE.Mesh(rbox(0.46, 0.54, 0.26, 0.06), matNavyArmor)
    torso.position.y = 0.28
    torso.castShadow = true
    torsoGroup.add(torso)

    // Rubric Metric Graduation Bar on Chest
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(rbox(0.18, 0.02, 0.02, 0.005), matGlow('#3f7d58', 2.5))
      bar.position.set(0, 0.42 - i * 0.06, 0.14)
      torsoGroup.add(bar)
    }

    // Left Arm holding Evaluation Pad
    const armL = new THREE.Group()
    armL.position.set(-0.28, 0.44, 0)
    torsoGroup.add(armL)

    const forearmL = new THREE.Mesh(rbox(0.1, 0.28, 0.1, 0.03), matCeramicWhite)
    forearmL.position.set(-0.06, -0.22, 0.18)
    forearmL.rotation.x = -0.8
    armL.add(forearmL)

    // Holographic Evaluation Slate
    const slate = new THREE.Mesh(rbox(0.28, 0.38, 0.02, 0.01), matCeramicWhite)
    slate.position.set(-0.08, -0.16, 0.36)
    slate.rotation.x = -0.5
    armL.add(slate)

    // Right Arm pointing with Precision Stylus
    const armR = new THREE.Group()
    armR.position.set(0.28, 0.44, 0)
    torsoGroup.add(armR)

    const forearmR = new THREE.Mesh(rbox(0.1, 0.3, 0.1, 0.03), matCeramicWhite)
    forearmR.position.set(0.14, -0.14, 0.24)
    forearmR.rotation.x = -0.5
    forearmR.rotation.y = -0.3
    armR.add(forearmR)

    const stylus = new THREE.Mesh(rbox(0.015, 0.24, 0.015, 0.005), matGoldTrim)
    stylus.position.set(0.22, -0.06, 0.42)
    stylus.rotation.x = -0.8
    armR.add(stylus)

    // Precision Evaluator Head
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.72, 0)
    torsoGroup.add(headGroup)

    const head = new THREE.Mesh(rbox(0.28, 0.34, 0.28, 0.08), matCeramicWhite)
    head.castShadow = true
    headGroup.add(head)

    const evaluatorVisor = new THREE.Mesh(rbox(0.24, 0.08, 0.08, 0.02), matGlow('#10b981', 3.0))
    evaluatorVisor.position.set(0, 0.03, 0.13)
    headGroup.add(evaluatorVisor)

    // Floating Rubric Criteria Slabs (4 Transparent score cards)
    const slabsGroup = new THREE.Group()
    slabsGroup.position.set(0.5, 1.3, 0.2)
    assessment.add(slabsGroup)

    const rubricSlabs: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const slab = new THREE.Mesh(rbox(0.38, 0.11, 0.015, 0.008), matFrostedGlass)
      slab.position.set(0, (i - 1) * 0.2, 0)
      slabsGroup.add(slab)
      rubricSlabs.push(slab)

      // Inner score indicator line
      const scoreLine = new THREE.Mesh(rbox(0.28, 0.02, 0.02, 0.005), matGlow('#3f7d58', 2.0))
      scoreLine.position.set(0, (i - 1) * 0.2, 0.01)
      slabsGroup.add(scoreLine)
    }

    agents.push({
      id: 'assessment',
      group: assessment,
      accentColor: '#3f7d58',
      update: (time, _dt, _isSelected) => {
        const breath = Math.sin(time * 2.1) * 0.018
        torsoGroup.position.y = 1.08 + breath
        headGroup.rotation.y = Math.sin(time * 0.7) * 0.07

        // Stylus micro-movement
        armR.position.y = 0.44 + Math.sin(time * 2.5) * 0.015
        armR.rotation.z = Math.sin(time * 1.8) * 0.04

        // Slabs levitation
        rubricSlabs.forEach((s, idx) => {
          s.position.y = (idx - 1) * 0.2 + Math.sin(time * 2.5 + idx * 0.8) * 0.025
          s.rotation.y = Math.sin(time + idx) * 0.04
        })
      },
    })
  }

  // ─── 05. ORCHESTRATOR AGENT ─────────────────────────────────────────────
  {
    const orchestrator = new THREE.Group()
    charactersRoot.add(orchestrator)

    buildHumanoidLegs(orchestrator, matNavyArmor, matCeramicWhite, matNavyArmor)

    // Grand Commander Torso with Mantle
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 1.08
    orchestrator.add(torsoGroup)

    const torso = new THREE.Mesh(rbox(0.5, 0.58, 0.3, 0.08), matNavyArmor)
    torso.position.y = 0.3
    torso.castShadow = true
    torsoGroup.add(torso)

    // Grand Mantle / Energy Cloak Segments (Drapes on back)
    const cloak = new THREE.Mesh(rbox(0.58, 0.9, 0.08, 0.04), phys({ color: '#102a40', roughness: 0.3, clearcoat: 0.6 }))
    cloak.position.set(0, 0.15, -0.16)
    cloak.castShadow = true
    torsoGroup.add(cloak)

    // Central Spinning Nexus Core in Chest
    const coreHole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 32)), matGraphite)
    coreHole.rotation.x = Math.PI / 2
    coreHole.position.set(0, 0.38, 0.14)
    torsoGroup.add(coreHole)

    const nexusCore = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.08, 1)), matGlow('#8b5cf6', 3.5))
    nexusCore.position.set(0, 0.38, 0.16)
    torsoGroup.add(nexusCore)

    // Conductor Arms (Both arms raised gracefully directing agent flows)
    ;([-1, 1] as const).forEach((dir) => {
      const arm = new THREE.Group()
      arm.position.set(dir * 0.32, 0.48, 0)
      torsoGroup.add(arm)

      const upperArm = new THREE.Mesh(rbox(0.12, 0.3, 0.12, 0.03), matNavyArmor)
      upperArm.position.set(dir * 0.1, -0.1, 0.1)
      upperArm.rotation.z = dir * -0.45
      upperArm.rotation.x = -0.4
      arm.add(upperArm)

      const forearm = new THREE.Mesh(rbox(0.11, 0.3, 0.11, 0.03), matCeramicWhite)
      forearm.position.set(dir * 0.26, -0.06, 0.3)
      forearm.rotation.x = -0.8
      forearm.rotation.z = dir * -0.2
      arm.add(forearm)

      const hand = new THREE.Mesh(rbox(0.08, 0.09, 0.04, 0.02), matGoldTrim)
      hand.position.set(dir * 0.34, 0.02, 0.44)
      arm.add(hand)
    })

    // Commander Head with High Imperial Visor
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.76, 0)
    torsoGroup.add(headGroup)

    const head = new THREE.Mesh(rbox(0.3, 0.36, 0.3, 0.08), matCeramicWhite)
    head.castShadow = true
    headGroup.add(head)

    const commandVisor = new THREE.Mesh(rbox(0.26, 0.1, 0.08, 0.03), matGlow('#6366f1', 3.2))
    commandVisor.position.set(0, 0.04, 0.14)
    headGroup.add(commandVisor)

    const crownTiara = new THREE.Mesh(track(new THREE.TorusGeometry(0.18, 0.016, 8, 32)), matGoldTrim)
    crownTiara.rotation.x = Math.PI / 2
    crownTiara.position.y = 0.18
    headGroup.add(crownTiara)

    // Halo of 4 Satellite Specialist Agent Orbs with Live Laser Links
    const satellitesGroup = new THREE.Group()
    satellitesGroup.position.set(0, 1.45, 0)
    orchestrator.add(satellitesGroup)

    const satellites: { mesh: THREE.Mesh; angle: number; line: THREE.Line }[] = []
    const satColors = ['#2c64a0', '#2a8784', '#3f7d58', '#d5b68a']

    for (let i = 0; i < 4; i++) {
      const satMesh = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 16, 16)), matGlow(satColors[i], 2.6))
      satellitesGroup.add(satMesh)

      // Dynamic vector line connecting satellite to chest nexus
      const lineGeo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.1, 0.16), new THREE.Vector3(0, 0, 0)]))
      const lineMat = track(new THREE.LineBasicMaterial({ color: satColors[i], transparent: true, opacity: 0.65 }))
      const line = new THREE.Line(lineGeo, lineMat)
      satellitesGroup.add(line)

      satellites.push({
        mesh: satMesh,
        angle: (i / 4) * Math.PI * 2,
        line,
      })
    }

    agents.push({
      id: 'orchestrator',
      group: orchestrator,
      accentColor: '#5867a8',
      update: (time, _dt, _isSelected) => {
        // Authoritative breathing
        const breath = Math.sin(time * 1.9) * 0.02
        torsoGroup.position.y = 1.08 + breath
        headGroup.rotation.y = Math.sin(time * 0.6) * 0.07

        // Nexus core dual rotation
        nexusCore.rotation.x = time * 1.5
        nexusCore.rotation.y = time * 2.0

        // Satellite agent orbs orbit and update dynamic laser lines
        satellites.forEach((sat) => {
          const a = sat.angle + time * 0.8
          const sx = Math.cos(a) * 0.95
          const sz = Math.sin(a) * 0.95
          const sy = Math.sin(time * 2.5 + sat.angle) * 0.12
          sat.mesh.position.set(sx, sy, sz)

          const pos = sat.line.geometry.attributes.position as THREE.BufferAttribute
          pos.setXYZ(1, sx, sy, sz)
          pos.needsUpdate = true
        })
      },
    })
  }

  // 8. Selection State & Layout Management
  let currentSelectedId = opts.initialAgentId || 'vaani'
  let targetRotationY = 0
  let isVisible = true
  let rafId = 0
  let lastTime = performance.now()

  const selectAgentInternal = (id: string) => {
    currentSelectedId = id
    const found = agents.find((a) => a.id === id)
    if (found) {
      accentLight.color.set(found.accentColor)
      glowRingMat.color.set(found.accentColor)
      glowRingMat.emissive.set(found.accentColor)
    }
  }

  selectAgentInternal(currentSelectedId)

  // Pointer tracking
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointerMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  canvas.addEventListener('pointermove', onPointerMove, { passive: true })

  // 9. Resize Handler
  const handleResize = () => {
    const parent = canvas.parentElement
    if (!parent) return
    const width = parent.clientWidth
    const height = parent.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height

    // Frame character heroically from floor to head
    if (width < 640) {
      camera.position.z = 5.2
      camera.position.y = 1.15
    } else if (width < 1024) {
      camera.position.z = 4.6
      camera.position.y = 1.18
    } else {
      camera.position.z = 4.3
      camera.position.y = 1.2
    }
    camera.updateProjectionMatrix()
  }
  handleResize()
  window.addEventListener('resize', handleResize)

  // 10. Animation Loop
  const animate = (now: number) => {
    rafId = requestAnimationFrame(animate)
    if (!isVisible) return

    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now
    const time = now * 0.001

    pointer.x = THREE.MathUtils.lerp(pointer.x, pointer.tx, dt * 5)
    pointer.y = THREE.MathUtils.lerp(pointer.y, pointer.ty, dt * 5)

    cursorLight.position.set(pointer.x * 2.2, 1.4 + pointer.y * 1.2, 3.2)

    // Character visibility & transition
    agents.forEach((ag) => {
      const isSelected = ag.id === currentSelectedId
      const targetScale = isSelected ? 1 : 0.001

      ag.group.scale.setScalar(
        THREE.MathUtils.lerp(ag.group.scale.x, targetScale, dt * 8)
      )
      ag.group.visible = ag.group.scale.x > 0.01

      if (ag.group.visible) {
        ag.update(time, dt, isSelected)
      }
    })

    // Responsive character turntable tilt
    if (!opts.reducedMotion) {
      targetRotationY = pointer.x * 0.32
      charactersRoot.rotation.y = THREE.MathUtils.lerp(charactersRoot.rotation.y, targetRotationY, dt * 4)
      pedestalGroup.rotation.y = charactersRoot.rotation.y * 0.4
    }

    renderer.render(scene, camera)
  }

  rafId = requestAnimationFrame(animate)

  // 11. Cleanup
  const dispose = () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', handleResize)
    canvas.removeEventListener('pointermove', onPointerMove)
    renderer.dispose()
    disposables.forEach((d) => d.dispose())
  }

  return {
    selectAgent(id: string) {
      selectAgentInternal(id)
    },
    setVaaniState(state: SpeechState) {
      vaani.setState(state)
    },
    updateAudioTelemetry(telemetry: AudioTelemetry) {
      currentTelemetry = telemetry
    },
    setVisible(v: boolean) {
      isVisible = v
    },
    dispose,
  }
}
