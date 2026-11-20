import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { SpeechState, AudioTelemetry } from './vaaniAudioEngine'

export interface VaaniCharacterController {
  group: THREE.Group
  setState: (state: SpeechState) => void
  update: (time: number, dt: number, telemetry: AudioTelemetry, isSelected: boolean) => void
  dispose: () => void
}

/**
 * Creates the high-fidelity 3D humanoid character for VAANI matching the approved reference turnaround and hero design.
 */
export function createVaaniCharacter(track: <T extends { dispose(): void }>(obj: T) => T): VaaniCharacterController {
  const root = new THREE.Group()

  // 1. Texture Loading from Approved Reference Assets
  const texLoader = new THREE.TextureLoader()
  const waveformTex = track(texLoader.load('/textures/vaani/headset_waveform.png'))
  waveformTex.colorSpace = THREE.SRGBColorSpace

  const faceTex = track(texLoader.load('/textures/vaani/face_texture.jpg'))
  faceTex.colorSpace = THREE.SRGBColorSpace

  const bodysuitTex = track(texLoader.load('/textures/vaani/bodysuit_texture.png'))
  bodysuitTex.wrapS = THREE.RepeatWrapping
  bodysuitTex.wrapT = THREE.RepeatWrapping
  bodysuitTex.repeat.set(2, 4)

  // 2. High-Grade Materials Palette matching Hero Reference
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => track(new THREE.MeshPhysicalMaterial(p))
  const rbox = (w: number, h: number, d: number, r = 0.03, seg = 3) =>
    track(new RoundedBoxGeometry(w, h, d, seg, r))

  // Molded Satin-Silver Armor (Chestplate, Backplate, Shoulder Caps, Forearm Bracers)
  const matSilverArmor = phys({
    color: '#e2e8f0',
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
  })

  // Deep Matte Slate-Navy Bodysuit (Base fabric from reference)
  const matSlateNavy = phys({
    color: '#1a2636',
    map: bodysuitTex,
    roughness: 0.42,
    metalness: 0.25,
    clearcoat: 0.3,
  })

  // Natural Human Skin (Warm South Asian tone matching reference)
  const matHumanSkin = phys({
    color: '#d4a373',
    roughness: 0.38,
    metalness: 0.05,
    clearcoat: 0.2,
  })

  // Chic Black Pixie Hair (Glossy layered hair)
  const matPixieHair = phys({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.2,
    clearcoat: 0.6,
  })

  // Deep Obsidian for Eye Sockets / Details
  const matObsidianVisor = phys({
    color: '#020617',
    metalness: 0.85,
    roughness: 0.05,
    clearcoat: 1.0,
  })

  // Glowing Cyan Telemetry Accents (Headset, Collar Ring, Bodysuit Slits)
  const matCyanGlow = phys({
    color: '#22d3ee',
    emissive: '#06b6d4',
    emissiveIntensity: 2.8,
    roughness: 0.15,
  })

  const matListeningGreen = phys({
    color: '#10b981',
    emissive: '#10b981',
    emissiveIntensity: 3.2,
    roughness: 0.15,
  })

  // Headset Waveform Earcup Material (Features approved waveform badge)
  const matEarcupWaveform = phys({
    map: waveformTex,
    emissiveMap: waveformTex,
    emissive: '#22d3ee',
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.6,
  })

  // 3. Kinematic Skeletal Hierarchy
  // Root -> Hips -> Spine -> Chest -> Neck -> Head
  const hipsNode = new THREE.Group()
  hipsNode.position.y = 0.94
  root.add(hipsNode)

  const spineNode = new THREE.Group()
  spineNode.position.y = 0.12
  hipsNode.add(spineNode)

  const chestNode = new THREE.Group()
  chestNode.position.y = 0.24
  spineNode.add(chestNode)

  const neckNode = new THREE.Group()
  neckNode.position.y = 0.28
  chestNode.add(neckNode)

  const headNode = new THREE.Group()
  headNode.position.y = 0.14
  neckNode.add(headNode)

  // Articulated Mouth / Jaw Node for Lip-Sync
  const jawNode = new THREE.Group()
  jawNode.position.set(0, -0.09, 0.04)
  headNode.add(jawNode)

  // Arms: Shoulders -> UpperArms -> Elbows -> Forearms -> Wrists -> Hands
  const shoulderL = new THREE.Group()
  shoulderL.position.set(-0.24, 0.22, 0)
  chestNode.add(shoulderL)

  const upperArmL = new THREE.Group()
  shoulderL.add(upperArmL)

  const elbowL = new THREE.Group()
  elbowL.position.set(0, -0.28, 0)
  upperArmL.add(elbowL)

  const forearmL = new THREE.Group()
  elbowL.add(forearmL)

  const handL = new THREE.Group()
  handL.position.set(0, -0.26, 0)
  forearmL.add(handL)

  const shoulderR = new THREE.Group()
  shoulderR.position.set(0.24, 0.22, 0)
  chestNode.add(shoulderR)

  const upperArmR = new THREE.Group()
  shoulderR.add(upperArmR)

  const elbowR = new THREE.Group()
  elbowR.position.set(0, -0.28, 0)
  upperArmR.add(elbowR)

  const forearmR = new THREE.Group()
  elbowR.add(forearmR)

  const handR = new THREE.Group()
  handR.position.set(0, -0.26, 0)
  forearmR.add(handR)

  // 4. Anatomical Legs & Boots (Matching Turnaround Sheet Proportions)
  const buildLeg = (side: -1 | 1) => {
    const x = side * 0.14
    const hipJoint = new THREE.Group()
    hipJoint.position.set(x, 0, 0)
    hipsNode.add(hipJoint)

    // Thigh with organic athletic taper
    const thighMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.082, 0.068, 0.44, 24)), matSlateNavy)
    thighMesh.position.y = -0.22
    thighMesh.castShadow = true
    hipJoint.add(thighMesh)

    // Vertical Cyan Accent Slit on lateral thigh (from reference)
    const thighSlit = new THREE.Mesh(rbox(0.008, 0.1, 0.02, 0.002), matCyanGlow)
    thighSlit.position.set(side * 0.084, -0.2, 0.02)
    hipJoint.add(thighSlit)

    // Knee Guard with Cyan Accent
    const kneeJoint = new THREE.Group()
    kneeJoint.position.set(0, -0.44, 0)
    hipJoint.add(kneeJoint)

    const kneeCap = new THREE.Mesh(rbox(0.088, 0.095, 0.1, 0.02), matSlateNavy)
    kneeCap.position.set(0, 0, 0.025)
    kneeJoint.add(kneeCap)

    const kneeSlit = new THREE.Mesh(rbox(0.006, 0.04, 0.02, 0.002), matCyanGlow)
    kneeSlit.position.set(0, 0, 0.075)
    kneeJoint.add(kneeSlit)

    // Calf & Shin
    const calfMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.068, 0.052, 0.42, 24)), matSlateNavy)
    calfMesh.position.y = -0.22
    calfMesh.castShadow = true
    kneeJoint.add(calfMesh)

    // Vertical Cyan Slit on lateral calf (from reference)
    const calfSlit = new THREE.Mesh(rbox(0.006, 0.08, 0.02, 0.002), matCyanGlow)
    calfSlit.position.set(side * 0.066, -0.22, 0.01)
    kneeJoint.add(calfSlit)

    // Integrated Ergonomic Navy Boot
    const bootMesh = new THREE.Mesh(rbox(0.1, 0.13, 0.23, 0.025), matSlateNavy)
    bootMesh.position.set(0, -0.46, 0.035)
    bootMesh.castShadow = true
    kneeJoint.add(bootMesh)

    // Subtle boot sole profile
    const soleMesh = new THREE.Mesh(rbox(0.105, 0.02, 0.235, 0.005), phys({ color: '#0f172a', roughness: 0.6 }))
    soleMesh.position.set(0, -0.525, 0.035)
    kneeJoint.add(soleMesh)
  }

  buildLeg(-1)
  buildLeg(1)

  // 5. Pelvis, Waist & Bodysuit Details
  const pelvisMesh = new THREE.Mesh(rbox(0.35, 0.16, 0.23, 0.05), matSlateNavy)
  pelvisMesh.castShadow = true
  hipsNode.add(pelvisMesh)

  // Vertical Cyan Slits on Hips (exact to reference)
  ;([-0.18, 0.18] as const).forEach((hx) => {
    const hipSlit = new THREE.Mesh(rbox(0.006, 0.06, 0.02, 0.002), matCyanGlow)
    hipSlit.position.set(hx, 0.02, 0.06)
    hipsNode.add(hipSlit)
  })

  // Abdomen
  const abdomenMesh = new THREE.Mesh(rbox(0.3, 0.18, 0.2, 0.04), matSlateNavy)
  spineNode.add(abdomenMesh)

  // 6. Thoracic Torso with Approved Silver Armor Plates
  const chestBase = new THREE.Mesh(rbox(0.36, 0.3, 0.22, 0.05), matSlateNavy)
  chestBase.position.y = 0.12
  chestBase.castShadow = true
  chestNode.add(chestBase)

  // Sculpted Molded Satin-Silver Breastplate (Upper chest/bust armor from Hero reference)
  const breastplate = new THREE.Mesh(rbox(0.38, 0.22, 0.16, 0.06), matSilverArmor)
  breastplate.position.set(0, 0.16, 0.08)
  breastplate.castShadow = true
  chestNode.add(breastplate)

  // Sculpted Silver Backplate (Winged/heart contour from turnaround back view)
  const backplateUpper = new THREE.Mesh(rbox(0.34, 0.18, 0.06, 0.04), matSilverArmor)
  backplateUpper.position.set(0, 0.17, -0.11)
  backplateUpper.castShadow = true
  chestNode.add(backplateUpper)

  const backplateLumbar = new THREE.Mesh(rbox(0.22, 0.035, 0.04, 0.01), matSilverArmor)
  backplateLumbar.position.set(0, -0.02, -0.11)
  chestNode.add(backplateLumbar)

  // High Mandarin Collar in Navy
  const collarMesh = new THREE.Mesh(rbox(0.2, 0.14, 0.18, 0.03), matSlateNavy)
  collarMesh.position.y = 0.02
  neckNode.add(collarMesh)

  // Glowing Cyan Circular Collar Beacon (exact to hero reference)
  const collarBeacon = new THREE.Mesh(track(new THREE.TorusGeometry(0.03, 0.006, 8, 24)), matCyanGlow)
  collarBeacon.position.set(0, 0.04, 0.092)
  neckNode.add(collarBeacon)

  // 7. Human Face, Pixie Hair & Headset
  // Realistic Humanoid Face Mesh
  const faceMesh = new THREE.Mesh(rbox(0.19, 0.24, 0.2, 0.06), matHumanSkin)
  faceMesh.castShadow = true
  headNode.add(faceMesh)

  // Tapered Feminine Chin
  const chinMesh = new THREE.Mesh(rbox(0.1, 0.08, 0.09, 0.02), matHumanSkin)
  chinMesh.position.set(0, -0.1, 0.05)
  headNode.add(chinMesh)

  // Expressive Eyes (Warm dark brown eyes with subtle reflection)
  ;([-0.045, 0.045] as const).forEach((ex) => {
    const eyeSocket = new THREE.Mesh(rbox(0.032, 0.016, 0.01, 0.004), matObsidianVisor)
    eyeSocket.position.set(ex, 0.025, 0.102)
    headNode.add(eyeSocket)

    const eyePupil = new THREE.Mesh(track(new THREE.SphereGeometry(0.007, 12, 12)), phys({ color: '#1e1b18', roughness: 0.1 }))
    eyePupil.position.set(ex, 0.025, 0.108)
    headNode.add(eyePupil)
  })

  // Subtle natural lips
  const lipsMesh = new THREE.Mesh(rbox(0.055, 0.016, 0.02, 0.005), phys({ color: '#b27a64', roughness: 0.4 }))
  lipsMesh.position.set(0, 0, 0.02)
  jawNode.add(lipsMesh)

  // Short Black Pixie Crop Hair (Stylized lock layers matching reference)
  const hairCrown = new THREE.Mesh(rbox(0.22, 0.16, 0.23, 0.06), matPixieHair)
  hairCrown.position.set(0, 0.09, -0.01)
  headNode.add(hairCrown)

  // Side-swept bangs / fringe
  const hairBangs = new THREE.Mesh(rbox(0.18, 0.08, 0.06, 0.02), matPixieHair)
  hairBangs.position.set(0.02, 0.08, 0.1)
  hairBangs.rotation.z = -0.12
  headNode.add(hairBangs)

  // Tapered nape hair
  const hairNape = new THREE.Mesh(rbox(0.16, 0.1, 0.08, 0.03), matPixieHair)
  hairNape.position.set(0, -0.04, -0.08)
  headNode.add(hairNape)

  // Communication Headset: Silver Arched Band over Hair
  const headsetArch = new THREE.Mesh(track(new THREE.TorusGeometry(0.125, 0.014, 8, 36, Math.PI)), matSilverArmor)
  headsetArch.rotation.z = Math.PI
  headsetArch.position.set(0, 0.05, 0.005)
  headNode.add(headsetArch)

  // Earcups with Approved Glowing Cyan Waveform Badge (both ears)
  const earcupWaveforms: THREE.Mesh[] = []
  ;([-0.12, 0.12] as const).forEach((ex) => {
    // Silver earcup casing
    const earcupBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.058, 0.058, 0.032, 24)), matSilverArmor)
    earcupBody.rotation.z = Math.PI / 2
    earcupBody.position.set(ex, 0.01, 0)
    headNode.add(earcupBody)

    // Outer face with waveform emblem
    const earcupFace = new THREE.Mesh(track(new THREE.CircleGeometry(0.052, 24)), matEarcupWaveform)
    earcupFace.rotation.y = ex > 0 ? Math.PI / 2 : -Math.PI / 2
    earcupFace.position.set(ex + (ex > 0 ? 0.017 : -0.017), 0.01, 0)
    headNode.add(earcupFace)
    earcupWaveforms.push(earcupFace)
  })

  // Silver Articulated Boom Mic (extends from left earcup toward mouth)
  const micBoomArm = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 12)), matSilverArmor)
  micBoomArm.rotation.z = -Math.PI / 3.4
  micBoomArm.rotation.y = 0.28
  micBoomArm.position.set(0.1, -0.05, 0.07)
  headNode.add(micBoomArm)

  const micTipLed = new THREE.Mesh(track(new THREE.SphereGeometry(0.014, 16, 16)), matCyanGlow)
  micTipLed.position.set(0.16, -0.11, 0.12)
  headNode.add(micTipLed)

  // 8. Shoulders, Arms, Silver Forearm Bracers & Articulated Hands
  const buildArm = (upperParent: THREE.Group, forearmParent: THREE.Group, handParent: THREE.Group, side: -1 | 1) => {
    // Silver Deltoid Armor Cap (from Hero reference)
    const deltoidCap = new THREE.Mesh(rbox(0.13, 0.12, 0.14, 0.04), matSilverArmor)
    upperParent.add(deltoidCap)

    // Upper Arm in Slate Navy
    const upperArmMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.048, 0.04, 0.24, 20)), matSlateNavy)
    upperArmMesh.position.y = -0.14
    upperArmMesh.castShadow = true
    upperParent.add(upperArmMesh)

    // Sculpted Satin-Silver Forearm Bracer (extends from below elbow to wrist)
    const forearmBracer = new THREE.Mesh(rbox(0.082, 0.22, 0.088, 0.02), matSilverArmor)
    forearmBracer.position.y = -0.12
    forearmBracer.castShadow = true
    forearmParent.add(forearmBracer)

    // Navy Wrist & Hand with Articulated Fingers
    const wristRing = new THREE.Mesh(track(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16)), matSlateNavy)
    wristRing.position.y = -0.24
    forearmParent.add(wristRing)

    const palmMesh = new THREE.Mesh(rbox(0.065, 0.07, 0.032, 0.01), matSlateNavy)
    handParent.add(palmMesh)

    // Slender Articulated Fingers
    ;([-0.02, 0, 0.02] as const).forEach((fx) => {
      const finger = new THREE.Mesh(rbox(0.014, 0.06, 0.014, 0.003), matSlateNavy)
      finger.position.set(fx, -0.055, 0.005)
      finger.rotation.x = -0.25
      handParent.add(finger)
    })

    const thumb = new THREE.Mesh(rbox(0.015, 0.045, 0.015, 0.003), matSlateNavy)
    thumb.position.set(side * 0.032, -0.03, 0.016)
    thumb.rotation.z = side * 0.35
    handParent.add(thumb)
  }

  buildArm(upperArmL, forearmL, handL, -1)
  buildArm(upperArmR, forearmR, handR, 1)

  // 9. Dynamic 3D Audio Hologram Waveform (Curving cyan sound ring around chest)
  const soundWaveRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.75, 0.01, 8, 64)), matCyanGlow)
  soundWaveRing.rotation.x = Math.PI / 2.3
  soundWaveRing.position.set(0, 1.4, 0)
  root.add(soundWaveRing)

  // 10. Kinematic Target Poses across the 4 States
  interface JointPose {
    chestRot: [number, number, number]
    neckRot: [number, number, number]
    headRot: [number, number, number]
    armLRot: [number, number, number]
    elbowLRot: [number, number, number]
    armRRot: [number, number, number]
    elbowRRot: [number, number, number]
  }

  const POSES: Record<SpeechState, JointPose> = {
    idle: {
      chestRot: [0, 0, 0],
      neckRot: [0, 0, 0],
      headRot: [0, 0, 0],
      armLRot: [0.12, 0, 0.16],
      elbowLRot: [-0.25, 0, 0],
      armRRot: [0.1, 0, -0.14],
      elbowRRot: [-0.2, 0, 0],
    },
    listening: {
      chestRot: [0.06, -0.04, 0], // Leans forward attentively
      neckRot: [-0.03, -0.06, 0],
      headRot: [-0.05, -0.1, -0.07], // Attentive tilt listening to caller
      armLRot: [-0.7, 0.15, 0.65], // Left hand raises near earcup
      elbowLRot: [-1.45, 0, 0.35],
      armRRot: [-0.18, 0, -0.08],
      elbowRRot: [-0.45, 0, 0],
    },
    speaking: {
      chestRot: [0.02, 0.04, 0],
      neckRot: [0.02, 0.03, 0],
      headRot: [0.03, 0.06, 0.02],
      armLRot: [0.16, 0, 0.18],
      elbowLRot: [-0.35, 0, 0],
      armRRot: [-0.58, -0.18, -0.38], // Expressive conversational hand gesture
      elbowRRot: [-0.8, 0, -0.25],
    },
    thinking: {
      chestRot: [0, 0.03, 0],
      neckRot: [-0.02, 0.05, 0],
      headRot: [0.1, 0.14, 0.06], // Contemplative upward tilt
      armLRot: [0.1, 0, 0.14],
      elbowLRot: [-0.2, 0, 0],
      armRRot: [-0.8, 0.25, -0.2], // Right hand rises towards collar/chin
      elbowRRot: [-1.5, 0, -0.3],
    },
  }

  let currentState: SpeechState = 'idle'
  const currentJoints: JointPose = JSON.parse(JSON.stringify(POSES.idle))

  return {
    group: root,
    setState(state: SpeechState) {
      currentState = state
    },
    update(time: number, dt: number, telemetry: AudioTelemetry, isSelected: boolean) {
      const targetPose = POSES[currentState]
      const blendSpeed = dt * 6.5

      // Smooth kinematic blend to target state
      const lerp = (cur: number, tgt: number) => THREE.MathUtils.lerp(cur, tgt, blendSpeed)
      for (let i = 0; i < 3; i++) {
        currentJoints.chestRot[i] = lerp(currentJoints.chestRot[i], targetPose.chestRot[i])
        currentJoints.neckRot[i] = lerp(currentJoints.neckRot[i], targetPose.neckRot[i])
        currentJoints.headRot[i] = lerp(currentJoints.headRot[i], targetPose.headRot[i])
        currentJoints.armLRot[i] = lerp(currentJoints.armLRot[i], targetPose.armLRot[i])
        currentJoints.elbowLRot[i] = lerp(currentJoints.elbowLRot[i], targetPose.elbowLRot[i])
        currentJoints.armRRot[i] = lerp(currentJoints.armRRot[i], targetPose.armRRot[i])
        currentJoints.elbowRRot[i] = lerp(currentJoints.elbowRRot[i], targetPose.elbowRRot[i])
      }

      // Natural Human Respiration & Organic Body Weight Shift
      const breathFreq = currentState === 'speaking' ? 2.8 : 1.9
      const breathAmp = 0.014
      const breath = Math.sin(time * breathFreq) * breathAmp

      chestNode.position.y = 0.24 + breath
      chestNode.scale.set(1 + breath * 0.7, 1 + breath, 1 + breath * 0.5)

      // Apply Kinematic Joint Rotations
      chestNode.rotation.set(
        currentJoints.chestRot[0] + breath * 0.4,
        currentJoints.chestRot[1] + Math.sin(time * 0.6) * 0.018,
        currentJoints.chestRot[2]
      )

      neckNode.rotation.set(...currentJoints.neckRot)

      headNode.rotation.set(
        currentJoints.headRot[0] + (currentState === 'speaking' ? Math.sin(time * 5.5) * 0.03 : 0),
        currentJoints.headRot[1],
        currentJoints.headRot[2]
      )

      // Synchronized Mouth / Jaw Movement for Speech (Viseme modulation)
      if (currentState === 'speaking') {
        const speechViseme = Math.max(0, Math.sin(time * 12)) * 0.018 + (telemetry.decibels / 85) * 0.022
        jawNode.position.y = -0.09 - speechViseme
      } else {
        jawNode.position.y = THREE.MathUtils.lerp(jawNode.position.y, -0.09, dt * 10)
      }

      // Left Arm kinematics
      upperArmL.rotation.set(
        currentJoints.armLRot[0],
        currentJoints.armLRot[1],
        currentJoints.armLRot[2]
      )
      elbowL.rotation.set(
        currentJoints.elbowLRot[0],
        currentJoints.elbowLRot[1],
        currentJoints.elbowLRot[2]
      )

      // Right Arm kinematics with speech cadence modulation
      upperArmR.rotation.set(
        currentJoints.armRRot[0] + (currentState === 'speaking' ? Math.sin(time * 3.2) * 0.07 : 0),
        currentJoints.armRRot[1],
        currentJoints.armRRot[2]
      )
      elbowR.rotation.set(
        currentJoints.elbowRRot[0] + (currentState === 'speaking' ? Math.sin(time * 3.2) * 0.09 : 0),
        currentJoints.elbowRRot[1],
        currentJoints.elbowRRot[2]
      )

      // Headset Earcup Waveform & Mic LED State Modulation
      const activeColor = currentState === 'listening' ? matListeningGreen : matCyanGlow
      micTipLed.material = activeColor
      collarBeacon.material = activeColor

      // Earcup waveform pulsation
      const audioPulse = 1.0 + (telemetry.decibels / 85) * 0.45 + (currentState === 'speaking' ? Math.sin(time * 10) * 0.15 : 0)
      earcupWaveforms.forEach((ew) => {
        ew.scale.set(audioPulse, audioPulse, 1)
      })

      // Dynamic Hologram Waveform Rotation & Amplitude
      soundWaveRing.rotation.y = time * 0.3
      const ringScale = isSelected ? 1 + (telemetry.decibels / 85) * 0.3 : 0.88
      soundWaveRing.scale.set(ringScale, ringScale, ringScale)
    },
    dispose() {
      // Disposed automatically via tracking
    },
  }
}
