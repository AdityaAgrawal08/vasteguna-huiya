// Procedural 3D fighter rigs for Sansad Showdown.
//
// Every character is built from primitives (spheres, capsules, cylinders,
// boxes and tori) around a small named skeleton. There are no external
// models or animation clips: all motion is generated from the pose object
// supplied by the match renderer.
//
// Skeleton (all children of root):
//   hips -> torso -> chest -> head
//                       -> armL -> elbowL
//                       -> armR -> elbowR
//        -> legL -> kneeL
//        -> legR -> kneeR
//
// The model faces +Z in local space; setFacing() rotates root around Y so
// that local +Z points along the fighter's world facing direction.

import * as THREE from 'three'
import { CHARACTERS } from './data.js'

const PI = Math.PI
const TAU = PI * 2

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mix = (a, b, t) => a + (b - a) * t
const smoothstep = (t) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
const damp = (a, b, lambda, dt) => mix(a, b, 1 - Math.exp(-lambda * dt))

const ROT_KEYS = [
  'hipsRot', 'torso', 'chest', 'head',
  'armL', 'armR', 'elbowL', 'elbowR',
  'legL', 'legR', 'kneeL', 'kneeR',
]

function makePose() {
  const r = () => ({ x: 0, y: 0, z: 0 })
  return {
    hipsPos: { x: 0, y: 0, z: 0 },
    hipsRot: r(),
    torso: r(),
    chest: r(),
    head: r(),
    armL: r(),
    armR: r(),
    elbowL: r(),
    elbowR: r(),
    legL: r(),
    legR: r(),
    kneeL: r(),
    kneeR: r(),
  }
}

export function createFighterRig(charId) {
  const char = CHARACTERS[charId] || CHARACTERS.modi
  const look = char.look
  const H = 1.85 * (look.scale || 1)
  const accentHex = new THREE.Color(char.accent || '#ff9933').getHex()

  // -----------------------------------------------------------------------
  // Resource tracking / small construction helpers
  // -----------------------------------------------------------------------
  const geoms = []
  const mats = []
  const trackGeo = (g) => { geoms.push(g); return g }

  const makeMat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.02,
      ...opts,
    })
    mats.push(m)
    return m
  }

  const boxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1))
  const sphereCache = new Map()
  function sphereGeo(w = 10, h = 8) {
    const key = `${w}:${h}`
    let g = sphereCache.get(key)
    if (!g) {
      g = trackGeo(new THREE.SphereGeometry(1, w, h))
      sphereCache.set(key, g)
    }
    return g
  }
  function capsuleGeo(radius, totalLen, capSegments = 3, radialSegments = 8) {
    const cyl = Math.max(0.001, totalLen - radius * 2)
    return trackGeo(new THREE.CapsuleGeometry(radius, cyl, capSegments, radialSegments))
  }
  function cylinderGeo(top, bottom, height, radial = 10, open = false) {
    return trackGeo(new THREE.CylinderGeometry(top, bottom, height, radial, 1, open))
  }
  function torusGeo(radius, tube, radial = 6, tubular = 12) {
    return trackGeo(new THREE.TorusGeometry(radius, tube, radial, tubular))
  }

  function addMesh(parent, geometry, material, opts = {}) {
    const m = new THREE.Mesh(geometry, material)
    if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2])
    if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2])
    if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2])
    m.castShadow = true
    m.receiveShadow = false
    parent.add(m)
    return m
  }

  // -----------------------------------------------------------------------
  // Palette
  // -----------------------------------------------------------------------
  const skinMat = makeMat(look.skin, { roughness: 0.58 })
  const skinShadeMat = makeMat(look.skinShade, { roughness: 0.68 })
  const hairMat = makeMat(look.hair, { roughness: 0.9 })
  const beardMat = makeMat(look.beard, { roughness: 0.95 })
  const stubbleMat = makeMat(look.beard, {
    roughness: 0.95, transparent: true, opacity: 0.42, depthWrite: false,
  })
  const browMat = makeMat(look.brows, { roughness: 0.9 })
  const topMat = makeMat(look.top, { roughness: 0.9 })
  const jacketMat = makeMat(look.jacket, { roughness: 0.86 })
  const pantsMat = makeMat(look.pants, { roughness: 0.9 })
  const shoeMat = makeMat(look.shoes, { roughness: 0.55 })
  const accentMat = makeMat(accentHex, { roughness: 0.55 })
  const darkMat = makeMat(0x241d19, { roughness: 0.7 })
  const whiteMat = makeMat(0xf8f5ef, { roughness: 0.35 })
  const pupilMat = makeMat(0x231a16, { roughness: 0.4 })
  const mouthMat = makeMat(0x6a3a2c, { roughness: 0.8 })
  const glassMat = makeMat(0x2b2620, { roughness: 0.3, metalness: 0.5 })
  const goldMat = makeMat(0xd8a83a, { roughness: 0.4, metalness: 0.4 })
  const bindiMat = makeMat(0x9e2a2a, { roughness: 0.7 })
  const beadMat = makeMat(0x6b4328, { roughness: 0.8 })

  // -----------------------------------------------------------------------
  // Proportions
  // -----------------------------------------------------------------------
  const shoulders = look.shoulders || 1
  const belly = look.belly || 1
  const hipY = 0.50 * H
  const thighLen = 0.24 * H
  const shinLen = 0.225 * H
  const footH = 0.04 * H
  const chestY = 0.17 * H
  const shoulderY = 0.13 * H
  const shoulderX = 0.108 * H * shoulders
  const upperArmLen = 0.155 * H
  const foreArmLen = 0.145 * H
  const headY = 0.185 * H
  const legX = 0.072 * H
  const torsoTopR = 0.10 * H * shoulders
  const torsoBottomR = 0.086 * H * belly
  const frontZ = torsoBottomR * 0.84 + 0.01 * H

  // -----------------------------------------------------------------------
  // Root / skeleton groups
  // -----------------------------------------------------------------------
  const root = new THREE.Group()
  root.name = `fighter-${charId}`
  root.userData.charId = charId
  root.userData.name = char.name
  root.position.set(0, 0, 0)

  const hips = new THREE.Group()
  hips.name = 'hips'
  hips.position.y = hipY
  root.add(hips)

  const torso = new THREE.Group()
  torso.name = 'torso'
  hips.add(torso)

  const chest = new THREE.Group()
  chest.name = 'chest'
  chest.position.y = chestY
  torso.add(chest)

  const head = new THREE.Group()
  head.name = 'head'
  head.position.y = headY
  chest.add(head)

  // -----------------------------------------------------------------------
  // Pelvis and legs
  // -----------------------------------------------------------------------
  addMesh(hips, cylinderGeo(0.082 * H * shoulders, 0.088 * H * belly, 0.12 * H, 10), pantsMat, {
    pos: [0, -0.005 * H, 0],
    scale: [1, 1, 0.82],
  })

  const thighGeo = capsuleGeo(0.047 * H, thighLen)
  const shinGeo = capsuleGeo(0.038 * H, shinLen)

  function buildLeg(side) {
    const leg = new THREE.Group()
    leg.name = side < 0 ? 'legL' : 'legR'
    leg.position.set(side * legX, -0.015 * H, 0)
    hips.add(leg)

    addMesh(leg, thighGeo, pantsMat, { pos: [0, -thighLen * 0.5, 0] })

    const knee = new THREE.Group()
    knee.name = side < 0 ? 'kneeL' : 'kneeR'
    knee.position.y = -thighLen
    leg.add(knee)

    addMesh(knee, sphereGeo(8, 6), pantsMat, {
      scale: [0.046 * H, 0.046 * H, 0.046 * H],
    })
    addMesh(knee, shinGeo, pantsMat, { pos: [0, -shinLen * 0.5, 0] })

    // The ankle is kept level relative to the body so the foot does not
    // rotate through the floor when the knee is bent.
    const ankle = new THREE.Group()
    ankle.name = side < 0 ? 'ankleL' : 'ankleR'
    ankle.position.y = -shinLen
    knee.add(ankle)

    addMesh(ankle, boxGeo, shoeMat, {
      pos: [0, 0, 0.032 * H],
      scale: [0.085 * H, footH, 0.14 * H],
    })
    addMesh(ankle, boxGeo, darkMat, {
      pos: [0, -footH * 0.44, 0.032 * H],
      scale: [0.088 * H, footH * 0.14, 0.142 * H],
    })

    return { leg, knee, ankle }
  }

  const legL = buildLeg(-1)
  const legR = buildLeg(1)

  // -----------------------------------------------------------------------
  // Torso / clothing
  // -----------------------------------------------------------------------
  const torsoBaseMat = look.topStyle === 'sari' ? jacketMat : topMat

  addMesh(torso, cylinderGeo(torsoTopR, torsoBottomR, 0.24 * H, 10), torsoBaseMat, {
    pos: [0, 0.12 * H, 0],
    scale: [1, 1, 0.82],
  })
  addMesh(chest, sphereGeo(12, 8), torsoBaseMat, {
    pos: [0, 0.015 * H, 0],
    scale: [torsoTopR * 0.95, 0.075 * H, torsoBottomR * 0.72],
  })

  if (look.topStyle === 'tshirt' && belly > 1.05) {
    addMesh(torso, sphereGeo(12, 8), topMat, {
      pos: [0, 0.045 * H, 0.018 * H],
      scale: [0.085 * H * belly, 0.09 * H, 0.074 * H * belly],
    })
  }

  // Neck
  addMesh(chest, cylinderGeo(0.028 * H, 0.032 * H, 0.055 * H, 8), skinMat, {
    pos: [0, 0.165 * H, 0],
  })

  const topStyle = look.topStyle
  const isTrump = charId === 'trump'
  let skirtGroup = null

  if (topStyle === 'kurta-jacket') {
    // Long inner tunic.
    addMesh(torso, cylinderGeo(torsoTopR * 0.98, torsoBottomR * 1.08, 0.36 * H, 10), topMat, {
      pos: [0, 0.05 * H, 0],
      scale: [1, 1, 0.84],
    })
    // Contrasting sleeveless jacket.
    addMesh(torso, cylinderGeo(torsoTopR * 1.06, torsoBottomR * 1.03, 0.255 * H, 10), jacketMat, {
      pos: [0, 0.105 * H, 0],
      scale: [1, 1, 0.84],
    })
    // Open front panel.
    addMesh(torso, boxGeo, topMat, {
      pos: [0, 0.10 * H, frontZ],
      scale: [0.048 * H, 0.245 * H, 0.012 * H],
    })
    for (let i = 0; i < 3; i++) {
      addMesh(torso, sphereGeo(8, 6), accentMat, {
        pos: [0, (0.175 - i * 0.055) * H, frontZ + 0.008 * H],
        scale: [0.009 * H, 0.009 * H, 0.006 * H],
      })
    }
    addMesh(chest, cylinderGeo(0.038 * H, 0.042 * H, 0.035 * H, 8), isTrump ? whiteMat : jacketMat, {
      pos: [0, 0.165 * H, 0],
    })

    if (isTrump) {
      // White shirt collar / lapels / long red tie / pocket square.
      addMesh(chest, boxGeo, whiteMat, {
        pos: [-0.028 * H, 0.145 * H, frontZ + 0.002 * H],
        scale: [0.045 * H, 0.028 * H, 0.01 * H],
        rot: [0, 0, 0.45],
      })
      addMesh(chest, boxGeo, whiteMat, {
        pos: [0.028 * H, 0.145 * H, frontZ + 0.002 * H],
        scale: [0.045 * H, 0.028 * H, 0.01 * H],
        rot: [0, 0, -0.45],
      })
      addMesh(chest, boxGeo, jacketMat, {
        pos: [-0.056 * H, 0.095 * H, frontZ + 0.003 * H],
        scale: [0.045 * H, 0.19 * H, 0.009 * H],
        rot: [0, 0, 0.22],
      })
      addMesh(chest, boxGeo, jacketMat, {
        pos: [0.056 * H, 0.095 * H, frontZ + 0.003 * H],
        scale: [0.045 * H, 0.19 * H, 0.009 * H],
        rot: [0, 0, -0.22],
      })
      addMesh(chest, boxGeo, accentMat, {
        pos: [0, 0.065 * H, frontZ + 0.014 * H],
        scale: [0.026 * H, 0.175 * H, 0.012 * H],
      })
      addMesh(chest, sphereGeo(8, 6), accentMat, {
        pos: [0, 0.155 * H, frontZ + 0.016 * H],
        scale: [0.018 * H, 0.018 * H, 0.012 * H],
      })
      addMesh(chest, boxGeo, accentMat, {
        pos: [0, -0.026 * H, frontZ + 0.014 * H],
        scale: [0.036 * H, 0.036 * H, 0.012 * H],
        rot: [0, 0, PI / 4],
      })
      addMesh(chest, boxGeo, accentMat, {
        pos: [0.068 * H, 0.105 * H, frontZ + 0.006 * H],
        scale: [0.026 * H, 0.014 * H, 0.006 * H],
      })
    }

    if (charId === 'yogi') {
      // Orange sash + waistband + rudraksha beads + forehead tilak.
      addMesh(chest, boxGeo, accentMat, {
        pos: [0, -0.02 * H, frontZ + 0.004 * H],
        scale: [0.055 * H, 0.34 * H, 0.012 * H],
        rot: [0, 0, 0.7],
      })
      addMesh(torso, cylinderGeo(torsoBottomR * 1.05, torsoBottomR * 1.05, 0.035 * H, 10), accentMat, {
        pos: [0, 0.025 * H, 0],
        scale: [1, 1, 0.86],
      })
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * (1.8 / 6)
        addMesh(chest, sphereGeo(8, 6), beadMat, {
          pos: [Math.sin(a) * 0.052 * H, 0.145 * H - Math.cos(a) * 0.018 * H, frontZ + 0.005 * H],
          scale: [0.009 * H, 0.009 * H, 0.009 * H],
        })
      }
      addMesh(head, boxGeo, accentMat, {
        pos: [0, 0.09 * H, 0.074 * H],
        scale: [0.008 * H, 0.032 * H, 0.004 * H],
      })
    }
  } else if (topStyle === 'tshirt') {
    addMesh(torso, cylinderGeo(torsoTopR, torsoBottomR, 0.30 * H, 10), topMat, {
      pos: [0, 0.08 * H, 0],
      scale: [1, 1, 0.82],
    })
    addMesh(torso, cylinderGeo(torsoBottomR * 1.01, torsoBottomR * 1.03, 0.025 * H, 10), topMat, {
      pos: [0, -0.065 * H, 0],
      scale: [1, 1, 0.82],
    })
    addMesh(chest, cylinderGeo(0.036 * H, 0.04 * H, 0.025 * H, 8), topMat, {
      pos: [0, 0.163 * H, 0],
    })
    addMesh(hips, cylinderGeo(0.086 * H * shoulders, 0.09 * H * belly, 0.03 * H, 10), darkMat, {
      pos: [0, 0.035 * H, 0],
      scale: [1, 1, 0.82],
    })
    if (charId === 'nitin') {
      // Light kurta-style tee: mandarin collar, front placket, chest pocket.
      addMesh(chest, cylinderGeo(0.034 * H, 0.04 * H, 0.035 * H, 8), topMat, {
        pos: [0, 0.168 * H, 0],
      })
      addMesh(torso, boxGeo, topMat, {
        pos: [0, 0.10 * H, frontZ - 0.004 * H],
        scale: [0.018 * H, 0.16 * H, 0.008 * H],
      })
      for (let i = 0; i < 2; i++) {
        addMesh(torso, sphereGeo(8, 6), accentMat, {
          pos: [0, (0.145 - i * 0.06) * H, frontZ + 0.002 * H],
          scale: [0.007 * H, 0.007 * H, 0.005 * H],
        })
      }
      addMesh(torso, boxGeo, topMat, {
        pos: [0.055 * H, 0.15 * H, frontZ - 0.005 * H],
        scale: [0.045 * H, 0.04 * H, 0.008 * H],
      })
    }
  } else {
    // Sari: blouse, flared skirt, accent border and diagonal drape.
    addMesh(torso, cylinderGeo(torsoTopR, torsoBottomR * 0.95, 0.23 * H, 10), jacketMat, {
      pos: [0, 0.12 * H, 0],
      scale: [1, 1, 0.8],
    })

    const skirtTop = 0.085 * H * shoulders
    const skirtBottom = 0.17 * H * belly
    skirtGroup = new THREE.Group()
    skirtGroup.name = 'skirt'
    hips.add(skirtGroup)
    addMesh(skirtGroup, cylinderGeo(skirtTop, skirtBottom, 0.43 * H, 12, true), topMat, {
      pos: [0, -0.225 * H, 0],
      scale: [1, 1, 0.9],
    })
    addMesh(skirtGroup, cylinderGeo(skirtBottom * 0.995, skirtBottom * 1.01, 0.045 * H, 12, true), jacketMat, {
      pos: [0, -0.415 * H, 0],
      scale: [1, 1, 0.9],
    })
    addMesh(skirtGroup, cylinderGeo(skirtBottom * 1.005, skirtBottom * 1.02, 0.018 * H, 12, true), accentMat, {
      pos: [0, -0.435 * H, 0],
      scale: [1, 1, 0.9],
    })

    addMesh(chest, boxGeo, jacketMat, {
      pos: [0.015 * H, -0.015 * H, frontZ + 0.003 * H],
      scale: [0.075 * H, 0.34 * H, 0.014 * H],
      rot: [0, 0, 0.62],
    })
    addMesh(chest, boxGeo, accentMat, {
      pos: [-0.012 * H, -0.015 * H, frontZ + 0.012 * H],
      scale: [0.012 * H, 0.34 * H, 0.014 * H],
      rot: [0, 0, 0.62],
    })

    // Simple gold necklace.
    addMesh(chest, torusGeo(0.043 * H, 0.003 * H, 6, 12), goldMat, {
      pos: [0, 0.16 * H, 0.018 * H],
      rot: [PI / 2, 0, 0],
    })
  }

  // -----------------------------------------------------------------------
  // Arms
  // -----------------------------------------------------------------------
  const upperArmGeo = capsuleGeo(0.033 * H, upperArmLen)
  const foreArmGeo = capsuleGeo(0.028 * H, foreArmLen)
  const sleeveFull = topStyle === 'kurta-jacket' && !isTrump
  const upperArmMat = sleeveFull ? topMat : (isTrump ? jacketMat : skinMat)

  function buildArm(side) {
    const arm = new THREE.Group()
    arm.name = side < 0 ? 'armL' : 'armR'
    arm.position.set(side * shoulderX, shoulderY, 0)
    chest.add(arm)

    const shoulderMat = sleeveFull ? topMat : (isTrump ? jacketMat : (topStyle === 'sari' ? jacketMat : skinMat))
    addMesh(arm, sphereGeo(8, 6), shoulderMat, {
      scale: [0.045 * H, 0.045 * H, 0.045 * H],
    })
    addMesh(arm, upperArmGeo, upperArmMat, { pos: [0, -upperArmLen * 0.5, 0] })

    if (!sleeveFull && !isTrump) {
      addMesh(arm, cylinderGeo(0.042 * H, 0.044 * H, 0.07 * H, 8), topStyle === 'sari' ? jacketMat : topMat, {
        pos: [0, -0.045 * H, 0],
      })
    }

    // Accent armband on the right upper arm.
    if (side > 0) {
      addMesh(arm, torusGeo(0.041 * H, 0.0065 * H, 6, 12), accentMat, {
        pos: [0, -0.085 * H, 0],
        rot: [PI / 2, 0, 0],
      })
    }

    const elbow = new THREE.Group()
    elbow.name = side < 0 ? 'elbowL' : 'elbowR'
    elbow.position.y = -upperArmLen
    arm.add(elbow)

    addMesh(elbow, sphereGeo(8, 6), skinMat, {
      scale: [0.034 * H, 0.034 * H, 0.034 * H],
    })
    addMesh(elbow, foreArmGeo, skinMat, { pos: [0, -foreArmLen * 0.5, 0] })
    addMesh(elbow, sphereGeo(10, 8), skinMat, {
      pos: [0, -foreArmLen - 0.012 * H, 0.006 * H],
      scale: [0.036 * H, 0.046 * H, 0.028 * H],
    })

    if (isTrump) {
      addMesh(elbow, cylinderGeo(0.031 * H, 0.033 * H, 0.028 * H, 8), whiteMat, {
        pos: [0, -foreArmLen + 0.02 * H, 0],
      })
    }

    return { arm, elbow }
  }

  const armL = buildArm(-1)
  const armR = buildArm(1)

  if (charId === 'nitin') {
    // Small wristwatch.
    addMesh(armL.elbow, boxGeo, darkMat, {
      pos: [0, -foreArmLen + 0.025 * H, 0.02 * H],
      scale: [0.042 * H, 0.018 * H, 0.042 * H],
    })
    addMesh(armL.elbow, boxGeo, accentMat, {
      pos: [0, -foreArmLen + 0.025 * H, 0.045 * H],
      scale: [0.018 * H, 0.014 * H, 0.008 * H],
    })
  }

  // -----------------------------------------------------------------------
  // Head, face, hair, beard
  // -----------------------------------------------------------------------
  const blinkEyes = []

  addMesh(head, sphereGeo(16, 12), skinMat, {
    pos: [0, 0.055 * H, 0],
    scale: [0.072 * H, 0.081 * H, 0.076 * H],
  })

  // Ears
  addMesh(head, sphereGeo(8, 6), skinShadeMat, {
    pos: [-0.073 * H, 0.052 * H, -0.005 * H],
    scale: [0.015 * H, 0.027 * H, 0.012 * H],
  })
  addMesh(head, sphereGeo(8, 6), skinShadeMat, {
    pos: [0.073 * H, 0.052 * H, -0.005 * H],
    scale: [0.015 * H, 0.027 * H, 0.012 * H],
  })

  // Nose
  addMesh(head, sphereGeo(8, 6), skinMat, {
    pos: [0, 0.043 * H, 0.076 * H],
    scale: [0.016 * H, 0.022 * H, 0.018 * H],
  })

  // Eyes (groups are squashed vertically for a simple blink).
  function buildEye(side) {
    const g = new THREE.Group()
    g.position.set(side * 0.028 * H, 0.066 * H, 0.069 * H)
    head.add(g)
    addMesh(g, sphereGeo(8, 6), whiteMat, {
      scale: [0.018 * H, 0.013 * H, 0.009 * H],
    })
    addMesh(g, sphereGeo(8, 6), pupilMat, {
      pos: [side * 0.001 * H, 0, 0.0085 * H],
      scale: [0.0075 * H, 0.0095 * H, 0.005 * H],
    })
    blinkEyes.push(g)
  }
  buildEye(-1)
  buildEye(1)

  // Brows
  const browTilt = isTrump ? 0.28 : (charId === 'didi' ? -0.05 : 0.1)
  addMesh(head, boxGeo, browMat, {
    pos: [-0.028 * H, 0.089 * H, 0.073 * H],
    scale: [0.032 * H, 0.007 * H, 0.008 * H],
    rot: [0, 0, -browTilt],
  })
  addMesh(head, boxGeo, browMat, {
    pos: [0.028 * H, 0.089 * H, 0.073 * H],
    scale: [0.032 * H, 0.007 * H, 0.008 * H],
    rot: [0, 0, browTilt],
  })

  // Mouth
  addMesh(head, boxGeo, mouthMat, {
    pos: [0, 0.026 * H, 0.077 * H],
    scale: [0.03 * H, 0.005 * H, 0.006 * H],
  })

  // Glasses
  if (look.glasses) {
    const lensGeo = torusGeo(0.026 * H, 0.0035 * H, 6, 12)
    for (const side of [-1, 1]) {
      addMesh(head, lensGeo, glassMat, {
        pos: [side * 0.028 * H, 0.066 * H, 0.083 * H],
      })
      addMesh(head, boxGeo, glassMat, {
        pos: [side * 0.063 * H, 0.072 * H, 0.04 * H],
        scale: [0.0035 * H, 0.0035 * H, 0.08 * H],
      })
    }
    addMesh(head, boxGeo, glassMat, {
      pos: [0, 0.066 * H, 0.083 * H],
      scale: [0.022 * H, 0.0035 * H, 0.0035 * H],
    })
  }

  // Hair
  const hairStyle = look.hairStyle || 'side-part'
  const hairCapGeo = trackGeo(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, PI * 0.43))

  if (hairStyle === 'receding') {
    // Bald crown with side/back fringe.
    addMesh(head, sphereGeo(8, 6), hairMat, {
      pos: [-0.065 * H, 0.055 * H, -0.005 * H],
      scale: [0.018 * H, 0.045 * H, 0.035 * H],
      rot: [0, 0, 0.12],
    })
    addMesh(head, sphereGeo(8, 6), hairMat, {
      pos: [0.065 * H, 0.055 * H, -0.005 * H],
      scale: [0.018 * H, 0.045 * H, 0.035 * H],
      rot: [0, 0, -0.12],
    })
    addMesh(head, sphereGeo(10, 8), hairMat, {
      pos: [0, 0.055 * H, -0.045 * H],
      scale: [0.064 * H, 0.05 * H, 0.025 * H],
    })
    addMesh(head, sphereGeo(8, 6), hairMat, {
      pos: [0, 0.095 * H, -0.025 * H],
      scale: [0.045 * H, 0.018 * H, 0.035 * H],
    })
  } else if (hairStyle === 'bun') {
    addMesh(head, hairCapGeo, hairMat, {
      pos: [0, 0.055 * H, -0.005 * H],
      scale: [0.078 * H, 0.084 * H, 0.08 * H],
    })
    addMesh(head, sphereGeo(10, 8), hairMat, {
      pos: [0, 0.055 * H, -0.04 * H],
      scale: [0.065 * H, 0.06 * H, 0.04 * H],
    })
    addMesh(head, sphereGeo(10, 8), hairMat, {
      pos: [0, 0.10 * H, -0.06 * H],
      scale: [0.046 * H, 0.046 * H, 0.04 * H],
    })
    addMesh(head, sphereGeo(8, 6), hairMat, {
      pos: [0, 0.13 * H, -0.052 * H],
      scale: [0.028 * H, 0.028 * H, 0.026 * H],
    })
    addMesh(head, torusGeo(0.043 * H, 0.005 * H, 6, 12), accentMat, {
      pos: [0, 0.10 * H, -0.06 * H],
      rot: [PI / 2, 0, 0],
    })
  } else {
    // Side part / swept hair. Trump gets a much larger blond quiff.
    addMesh(head, hairCapGeo, hairMat, {
      pos: [0, 0.055 * H, -0.005 * H],
      scale: [0.078 * H, 0.084 * H, 0.08 * H],
    })
    addMesh(head, sphereGeo(10, 8), hairMat, {
      pos: [0, 0.055 * H, -0.04 * H],
      scale: [0.065 * H, 0.06 * H, 0.04 * H],
    })
    addMesh(head, sphereGeo(10, 8), hairMat, {
      pos: [isTrump ? 0.018 * H : 0.012 * H, isTrump ? 0.105 * H : 0.098 * H, isTrump ? 0.052 * H : 0.045 * H],
      scale: [isTrump ? 0.072 * H : 0.052 * H, isTrump ? 0.036 * H : 0.025 * H, isTrump ? 0.05 * H : 0.038 * H],
      rot: [isTrump ? -0.3 : -0.2, 0, isTrump ? -0.35 : -0.22],
    })
    if (isTrump) {
      addMesh(head, sphereGeo(10, 8), hairMat, {
        pos: [-0.02 * H, 0.115 * H, 0.025 * H],
        scale: [0.05 * H, 0.026 * H, 0.04 * H],
        rot: [0, 0, 0.3],
      })
    }
    for (const side of [-1, 1]) {
      addMesh(head, boxGeo, hairMat, {
        pos: [side * 0.066 * H, 0.05 * H, 0.025 * H],
        scale: [0.008 * H, 0.035 * H, 0.012 * H],
      })
    }
  }

  // Beard / stubble
  if (look.beardStyle === 'full-white') {
    addMesh(head, sphereGeo(12, 8), beardMat, {
      pos: [0, 0.012 * H, 0.025 * H],
      scale: [0.062 * H, 0.05 * H, 0.042 * H],
    })
    addMesh(head, sphereGeo(8, 6), beardMat, {
      pos: [-0.042 * H, 0.03 * H, 0.035 * H],
      scale: [0.026 * H, 0.045 * H, 0.035 * H],
    })
    addMesh(head, sphereGeo(8, 6), beardMat, {
      pos: [0.042 * H, 0.03 * H, 0.035 * H],
      scale: [0.026 * H, 0.045 * H, 0.035 * H],
    })
    addMesh(head, sphereGeo(8, 6), beardMat, {
      pos: [-0.016 * H, 0.035 * H, 0.077 * H],
      scale: [0.022 * H, 0.008 * H, 0.01 * H],
    })
    addMesh(head, sphereGeo(8, 6), beardMat, {
      pos: [0.016 * H, 0.035 * H, 0.077 * H],
      scale: [0.022 * H, 0.008 * H, 0.01 * H],
    })
    addMesh(head, sphereGeo(8, 6), beardMat, {
      pos: [0, -0.015 * H, 0.055 * H],
      scale: [0.032 * H, 0.03 * H, 0.03 * H],
    })
  } else if (look.beardStyle === 'stubble-grey') {
    addMesh(head, sphereGeo(12, 8), stubbleMat, {
      pos: [0, 0.018 * H, 0.025 * H],
      scale: [0.06 * H, 0.04 * H, 0.04 * H],
    })
    addMesh(head, boxGeo, stubbleMat, {
      pos: [0, 0.034 * H, 0.077 * H],
      scale: [0.03 * H, 0.004 * H, 0.006 * H],
    })
    for (const side of [-1, 1]) {
      addMesh(head, boxGeo, stubbleMat, {
        pos: [side * 0.062 * H, 0.045 * H, 0.02 * H],
        scale: [0.008 * H, 0.035 * H, 0.012 * H],
      })
    }
  }

  if (charId === 'didi') {
    addMesh(head, sphereGeo(8, 6), bindiMat, {
      pos: [0, 0.092 * H, 0.073 * H],
      scale: [0.007 * H, 0.007 * H, 0.004 * H],
    })
    for (const side of [-1, 1]) {
      addMesh(head, sphereGeo(8, 6), goldMat, {
        pos: [side * 0.076 * H, 0.03 * H, 0.0],
        scale: [0.009 * H, 0.014 * H, 0.006 * H],
      })
    }
  }

  // -----------------------------------------------------------------------
  // Pose targets
  // -----------------------------------------------------------------------
  const cur = makePose()
  const target = makePose()

  function resetTarget() {
    for (const key of ROT_KEYS) {
      const r = target[key]
      r.x = 0
      r.y = 0
      r.z = 0
    }
    target.hipsPos.x = 0
    target.hipsPos.y = 0
    target.hipsPos.z = 0
  }

  function setGuard(P, side) {
    if (side < 0) {
      P.armL.x = -0.85
      P.armL.z = -0.2
      P.elbowL.x = -1.75
    } else {
      P.armR.x = -0.85
      P.armR.z = 0.2
      P.elbowR.x = -1.75
    }
  }

  function setGuardBoth(P) {
    setGuard(P, -1)
    setGuard(P, 1)
  }

  // -----------------------------------------------------------------------
  // State poses
  // -----------------------------------------------------------------------
  function applyIdle(P, t) {
    const breathe = Math.sin(t * 1.7)
    const sway = Math.sin(t * 0.8)
    P.hipsPos.y = 0.003 * H * breathe
    P.hipsPos.x = 0.004 * H * sway
    P.hipsRot.y = 0.02 * sway
    P.torso.x = 0.012 + 0.008 * breathe
    P.torso.y = 0.02 * sway
    P.chest.x = 0.006 - 0.01 * breathe
    P.chest.y = -0.015 * sway
    P.head.x = -0.02 + 0.012 * breathe
    P.head.y = 0.05 * Math.sin(t * 0.33)
    P.head.z = 0.01 * Math.sin(t * 0.5)
    P.armL.x = -0.05 + 0.03 * Math.sin(t * 1.4)
    P.armR.x = -0.05 + 0.03 * Math.sin(t * 1.4 + 0.7)
    P.armL.z = -0.12
    P.armR.z = 0.12
    P.elbowL.x = -0.28
    P.elbowR.x = -0.28
    P.legL.x = 0.02
    P.legR.x = -0.02
    P.kneeL.x = 0.07
    P.kneeR.x = 0.07
  }

  function applyWalk(P, pose, crouching) {
    if (crouching) {
      applyCrouch(P, 0)
      return
    }
    const vx = Number.isFinite(pose.vx) ? pose.vx : 0
    const dir = Math.sign(vx * facingTarget) || 1
    const s = Math.sin(walkPhase) * dir
    const c = Math.cos(walkPhase)
    P.hipsPos.y = -0.006 * H * Math.abs(c)
    P.hipsPos.x = 0.008 * H * s
    P.hipsRot.y = 0.06 * s
    P.torso.x = 0.04
    P.torso.y = -0.1 * s
    P.chest.y = 0.05 * s
    P.head.x = -0.03
    P.head.y = 0.03 * s
    P.legL.x = -0.55 * s
    P.legR.x = 0.55 * s
    P.kneeL.x = 0.08 + 0.6 * Math.max(0, -s)
    P.kneeR.x = 0.08 + 0.6 * Math.max(0, s)
    P.armL.x = 0.35 * s
    P.armR.x = -0.35 * s
    P.armL.z = -0.1
    P.armR.z = 0.1
    P.elbowL.x = -0.35
    P.elbowR.x = -0.35
  }

  function applyCrouch(P, t) {
    const bob = Math.sin(t * 2.2) * 0.004 * H
    P.hipsPos.y = -0.14 * H + bob
    P.hipsPos.z = 0.008 * H
    P.hipsRot.x = 0.03
    P.torso.x = 0.2
    P.chest.x = 0.06
    P.head.x = -0.16
    P.legL.x = -0.9
    P.legR.x = -0.9
    P.legL.z = -0.08
    P.legR.z = 0.08
    P.kneeL.x = 1.65
    P.kneeR.x = 1.65
    P.armL.x = -1.0
    P.armR.x = -1.0
    P.armL.z = -0.25
    P.armR.z = 0.25
    P.elbowL.x = -1.85
    P.elbowR.x = -1.85
    P.head.y = 0.03 * Math.sin(t * 0.7)
  }

  function applyJump(P, pose) {
    const falling = (pose.vy || 0) < 0
    P.hipsPos.y = 0.008 * H
    P.torso.x = 0.1
    P.head.x = -0.1
    P.legL.x = falling ? -0.4 : -0.95
    P.legR.x = falling ? -0.3 : -0.75
    P.legL.z = -0.08
    P.legR.z = 0.08
    P.kneeL.x = falling ? 0.7 : 1.5
    P.kneeR.x = falling ? 0.5 : 1.3
    P.armL.x = falling ? -0.9 : -2.4
    P.armR.x = falling ? -0.9 : -2.4
    P.armL.z = falling ? -0.8 : -0.35
    P.armR.z = falling ? 0.8 : 0.35
    P.elbowL.x = -0.5
    P.elbowR.x = -0.5
  }

  function applyBlock(P, t, crouching) {
    P.hipsPos.y = crouching ? -0.11 * H : -0.02 * H
    P.hipsPos.z = -0.02 * H
    P.torso.x = crouching ? -0.18 : -0.14
    P.chest.x = -0.02
    P.head.x = 0.06
    P.legL.x = crouching ? -0.8 : -0.32
    P.legR.x = crouching ? -0.8 : 0.25
    P.kneeL.x = crouching ? 1.5 : 0.55
    P.kneeR.x = crouching ? 1.5 : 0.4
    P.armL.x = -1.15
    P.armR.x = -1.15
    P.armL.z = 0.45
    P.armR.z = -0.45
    P.elbowL.x = -2.0
    P.elbowR.x = -2.0

    const shake = Math.sin(t * 55) * 0.006 * H * Math.exp(-t * 6)
    P.hipsPos.x += shake
    P.head.x += shake * 2
  }

  function applyHitstun(P, t) {
    const k = Math.exp(-t * 6)
    const shake = Math.sin(t * 50) * 0.05 * k
    P.hipsPos.z = -0.045 * H * k
    P.hipsPos.y = -0.02 * H * k
    P.hipsRot.y = 0.12 * k
    P.torso.x = 0.03 - 0.28 * k
    P.chest.x = -0.1 * k
    P.head.x = -0.3 * k + shake
    P.head.y = 0.1 * k
    P.armL.x = -0.05 + 0.55 * k
    P.armL.z = -0.12 - 0.45 * k
    P.elbowL.x = -0.6
    P.armR.x = -0.05 + 0.45 * k
    P.armR.z = 0.12 + 0.45 * k
    P.elbowR.x = -0.6
    P.legL.x = -0.2 * k
    P.legR.x = 0.25 * k
    P.kneeL.x = 0.2 + 0.4 * k
    P.kneeR.x = 0.2 + 0.4 * k
  }

  function applyKnockdown(P, t) {
    const twitch = Math.min(1, Math.max(0, (t - 0.6) * 1.5))
    const tw = Math.sin(t * 3.5) * 0.02 * twitch
    const bounce = Math.sin(t * 14) * 0.008 * H * Math.exp(-t * 4)

    P.hipsPos.y = -0.32 * H + bounce
    P.hipsPos.z = -0.1 * H
    P.hipsRot.x = -1.45
    P.hipsRot.y = 0.15
    P.hipsRot.z = 0.08
    P.torso.x = 0.05
    P.chest.x = 0.02
    P.head.x = 0.15
    P.head.y = 0.2
    P.armL.x = 0.4
    P.armL.z = -1.25
    P.elbowL.x = -0.4
    P.armR.x = 0.5 + tw
    P.armR.z = 1.25
    P.elbowR.x = -0.5
    P.legL.x = -0.02
    P.legL.z = -0.18
    P.kneeL.x = 0.4 + tw * 0.8
    P.legR.x = -0.06
    P.legR.z = 0.18
    P.kneeR.x = 0.4
  }

  function applyGetup(P, t) {
    const e = smoothstep(t / 0.38)
    P.hipsPos.y = mix(-0.34 * H, 0, e)
    P.hipsPos.z = mix(-0.08 * H, 0, e)
    P.hipsPos.x = Math.sin(t * 8) * 0.01 * H * (1 - e)
    P.hipsRot.x = mix(-1.45, 0, e)
    P.hipsRot.y = mix(0.15, 0, e)
    P.hipsRot.z = mix(0.08, 0, e)
    P.torso.x = mix(0.1, 0.18, e)
    P.chest.x = mix(0.05, 0.05, e)
    P.head.x = mix(0.25, -0.1, e)
    P.legL.x = mix(-0.25, -0.5, e)
    P.legR.x = mix(0.15, -0.3, e)
    P.kneeL.x = mix(0.5, 0.9, e)
    P.kneeR.x = mix(0.7, 0.9, e)
    P.armL.x = mix(0.4, -0.6, e)
    P.armL.z = mix(-1.25, -0.25, e)
    P.elbowL.x = mix(-0.4, -1.2, e)
    P.armR.x = mix(0.5, -0.6, e)
    P.armR.z = mix(1.25, 0.25, e)
    P.elbowR.x = mix(-0.5, -1.2, e)
  }

  function applyVictory(P, t) {
    const pump = Math.sin(t * 3.5)
    const sway = Math.sin(t * 1.8)
    P.hipsPos.y = Math.abs(Math.sin(t * 3.5)) * 0.025 * H
    P.hipsPos.x = sway * 0.02 * H
    P.hipsRot.y = sway * 0.15
    P.hipsRot.z = sway * 0.05
    P.torso.x = -0.08 + pump * 0.03
    P.torso.y = -sway * 0.08
    P.chest.x = -0.02
    P.head.x = -0.18 + Math.sin(t * 3.5 + 0.5) * 0.04
    P.head.y = sway * 0.15
    P.legL.x = 0.08 + Math.sin(t * 3.5) * 0.08
    P.legR.x = -0.08 - Math.sin(t * 3.5) * 0.08
    P.kneeL.x = 0.15
    P.kneeR.x = 0.15

    switch (charId) {
      case 'modi': {
        // Garba: arms up, clapping side to side.
        const clap = Math.sin(t * 6)
        P.armL.x = -2.25 + clap * 0.18
        P.armR.x = -2.25 - clap * 0.18
        P.armL.z = -0.75 + clap * 0.45
        P.armR.z = 0.75 - clap * 0.45
        P.elbowL.x = -1.15
        P.elbowR.x = -1.15
        P.hipsRot.y = sway * 0.3
        P.head.y = sway * 0.28
        break
      }
      case 'rahul': {
        // Balle balle: wide open arms, hip sway and little kicks.
        P.armL.x = -2.7 + Math.sin(t * 4) * 0.2
        P.armR.x = -2.7 - Math.sin(t * 4) * 0.2
        P.armL.z = -1.15
        P.armR.z = 1.15
        P.elbowL.x = -0.35
        P.elbowR.x = -0.35
        P.hipsRot.y = Math.sin(t * 3) * 0.35
        P.legR.x = -0.5 + Math.sin(t * 6) * 0.3
        P.kneeR.x = 0.4
        break
      }
      case 'didi': {
        // Khela hobe: alternating fist pumps.
        const alt = Math.sin(t * 5)
        P.armL.x = -2.5 + alt * 0.35
        P.armR.x = -2.5 - alt * 0.35
        P.armL.z = -0.35
        P.armR.z = 0.35
        P.elbowL.x = -1.5
        P.elbowR.x = -1.5
        P.hipsPos.y = Math.abs(Math.sin(t * 5)) * 0.045 * H
        P.head.y = alt * 0.12
        break
      }
      case 'trump': {
        // Tremendous strut: arms out, chin up, shoulders rolling.
        P.armL.x = -0.9 + pump * 0.1
        P.armR.x = -0.9 - pump * 0.1
        P.armL.z = -0.9
        P.armR.z = 0.9
        P.elbowL.x = -1.1
        P.elbowR.x = -1.1
        P.hipsRot.y = sway * 0.25
        P.hipsPos.x = sway * 0.04 * H
        P.head.x = -0.3
        P.head.y = sway * 0.2
        break
      }
      case 'yogi': {
        // Baba ka swag: arms folded, slow sway.
        P.armL.x = -1.15
        P.armR.x = -1.15
        P.armL.z = 0.75
        P.armR.z = -0.75
        P.elbowL.x = -2.1
        P.elbowR.x = -2.1
        P.hipsRot.y = sway * 0.22
        P.head.x = -0.12
        P.head.y = sway * 0.12
        break
      }
      case 'nitin': {
        // Zingaat: bouncing with alternating high arms.
        const alt = Math.sin(t * 7)
        P.armL.x = -2.2 + alt * 0.7
        P.armR.x = -2.2 - alt * 0.7
        P.armL.z = -0.5
        P.armR.z = 0.5
        P.elbowL.x = -0.8
        P.elbowR.x = -0.8
        P.hipsPos.y = Math.abs(Math.sin(t * 7)) * 0.05 * H
        P.legL.x = Math.sin(t * 7) * 0.35
        P.legR.x = -Math.sin(t * 7) * 0.35
        P.kneeL.x = 0.25
        P.kneeR.x = 0.25
        break
      }
    }
  }

  function applyIntro(P, t) {
    const wave = Math.sin(t * 4) * 0.2
    P.hipsPos.x = Math.sin(t * 1.5) * 0.01 * H
    P.hipsRot.y = 0.05 * Math.sin(t * 1.5)
    P.torso.x = -0.04
    P.torso.y = 0.1
    P.head.x = -0.05
    P.head.y = 0.15 * Math.sin(t * 2)
    P.legL.x = 0.05
    P.legR.x = -0.05
    P.kneeL.x = 0.1
    P.kneeR.x = 0.1

    switch (charId) {
      case 'modi': {
        // Namaste, with a small bow.
        P.armL.x = -1.15
        P.armL.z = 0.38
        P.elbowL.x = -1.75
        P.armR.x = -1.15
        P.armR.z = -0.38
        P.elbowR.x = -1.75
        P.torso.x = -0.16
        P.head.x = 0.16
        P.hipsPos.y = -0.012 * H
        break
      }
      case 'rahul': {
        // Friendly wave.
        P.armR.x = -2.55
        P.armR.z = 0.55
        P.elbowR.x = -0.9 + wave * 0.3
        P.armL.x = -0.35
        P.armL.z = -0.5
        P.elbowL.x = -1.4
        break
      }
      case 'didi': {
        // Arms folded, chin up.
        P.armL.x = -1.0
        P.armL.z = 0.9
        P.elbowL.x = -2.2
        P.armR.x = -1.0
        P.armR.z = -0.9
        P.elbowR.x = -2.2
        P.hipsRot.y = 0.1 * Math.sin(t * 1.5)
        P.head.z = 0.05
        break
      }
      case 'trump': {
        // Thumbs-up showman pose.
        P.armR.x = -1.5
        P.armR.z = 0.4
        P.elbowR.x = -1.85
        P.armL.x = -0.4
        P.armL.z = -0.9
        P.elbowL.x = -2.0
        P.hipsRot.y = 0.08 * Math.sin(t * 1.2)
        P.head.x = -0.12
        break
      }
      case 'yogi': {
        // Respectful namaste.
        P.armL.x = -1.1
        P.armL.z = 0.42
        P.elbowL.x = -1.85
        P.armR.x = -1.1
        P.armR.z = -0.42
        P.elbowR.x = -1.85
        P.torso.x = -0.1
        P.head.x = 0.1
        break
      }
      case 'nitin': {
        // Highway salute.
        P.armR.x = -2.35
        P.armR.z = 0.22
        P.elbowR.x = -1.95
        P.armL.x = -0.3
        P.armL.z = -0.4
        P.elbowL.x = -1.2
        P.head.x = -0.08
        break
      }
    }
  }

  function applySuper(P, t) {
    P.hipsPos.y = 0.015 * H + Math.sin(t * 2) * 0.01 * H
    P.hipsRot.y = Math.sin(t * 1.2) * 0.1
    P.torso.x = 0.06
    P.chest.x = 0.03
    P.head.x = -0.25
    P.head.y = Math.sin(t * 1.5) * 0.1
    P.armL.x = -0.5
    P.armR.x = -0.5
    P.armL.z = -1.1
    P.armR.z = 1.1
    P.elbowL.x = -0.35
    P.elbowR.x = -0.35
    P.legL.x = -0.05
    P.legR.x = 0.05
    P.legL.z = -0.18
    P.legR.z = 0.18
    P.kneeL.x = 0.25
    P.kneeR.x = 0.25
  }

  function applyFrozen(P, t) {
    const tremble = Math.sin(t * 40) * 0.003 * H
    P.hipsPos.x = tremble
    P.hipsPos.y = -0.01 * H
    P.torso.x = 0.03
    P.head.x = 0.12
    P.head.y = Math.sin(t * 3) * 0.03
    P.armL.x = -0.1
    P.armR.x = -0.1
    P.armL.z = -0.25
    P.armR.z = 0.25
    P.elbowL.x = -0.3
    P.elbowR.x = -0.3
    P.legL.x = 0.02
    P.legR.x = -0.02
    P.kneeL.x = 0.08
    P.kneeR.x = 0.08
  }

  // -----------------------------------------------------------------------
  // Attacks
  // -----------------------------------------------------------------------
  function applyAttack(P, id, phase, t, pose) {
    const wind = phase === 'startup'
    const hit = phase === 'active'
    const rec = phase === 'recovery'

    switch (id) {
      case 'jab':
      case 'lowJab': {
        const low = id === 'lowJab'
        P.hipsPos.y = low ? -0.12 * H : -0.01 * H
        P.hipsPos.z = low ? 0.008 * H : 0
        P.hipsRot.x = low ? 0.03 : 0
        P.legL.x = low ? -0.85 : -0.25
        P.legR.x = low ? -0.85 : 0.18
        P.kneeL.x = low ? 1.55 : 0.35
        P.kneeR.x = low ? 1.55 : 0.28
        P.torso.x = low ? 0.18 : 0.03
        P.chest.x = low ? 0.05 : 0.01
        P.head.x = low ? -0.12 : -0.03

        if (wind) {
          P.torso.y = -0.32
          P.chest.y = -0.12
          P.hipsRot.y = -0.12
          P.armL.x = 0.35
          P.armL.z = -0.28
          P.elbowL.x = -1.85
          P.armR.x = -0.7
          P.armR.z = 0.3
          P.elbowR.x = -1.8
          P.head.y = 0.1
        } else if (hit) {
          P.torso.y = 0.38
          P.chest.y = 0.16
          P.hipsRot.y = 0.18
          P.armL.x = low ? -1.45 : -1.55
          P.armL.z = -0.06
          P.elbowL.x = -0.06
          P.armR.x = -0.7
          P.armR.z = 0.25
          P.elbowR.x = -1.85
          P.hipsPos.z += 0.025 * H
          P.head.y = -0.05
        } else if (rec) {
          P.torso.y = 0.14
          P.chest.y = 0.06
          P.hipsRot.y = 0.06
          P.armL.x = -0.75
          P.armL.z = -0.2
          P.elbowL.x = -0.9
          P.armR.x = -0.75
          P.armR.z = 0.22
          P.elbowR.x = -1.7
        }
        break
      }

      case 'cross': {
        P.hipsPos.y = -0.01 * H
        P.legL.x = -0.2
        P.legR.x = 0.2
        P.kneeL.x = 0.3
        P.kneeR.x = 0.3
        if (wind) {
          P.torso.x = 0.05
          P.torso.y = 0.38
          P.chest.y = 0.15
          P.hipsRot.y = -0.22
          P.armR.x = 0.4
          P.armR.z = 0.3
          P.elbowR.x = -1.85
          setGuard(P, -1)
          P.head.y = -0.1
        } else if (hit) {
          P.torso.x = 0.08
          P.torso.y = -0.45
          P.chest.y = -0.2
          P.hipsRot.y = 0.24
          P.armR.x = -1.6
          P.armR.z = 0.08
          P.elbowR.x = -0.05
          setGuard(P, -1)
          P.hipsPos.z = 0.03 * H
          P.head.y = 0.08
        } else if (rec) {
          P.torso.x = 0.02
          P.torso.y = -0.15
          P.hipsRot.y = 0.08
          P.armR.x = -0.8
          P.armR.z = 0.2
          P.elbowR.x = -1.0
          setGuard(P, -1)
        }
        break
      }

      case 'kick': {
        P.hipsPos.y = -0.02 * H
        P.legR.x = 0.15
        P.kneeR.x = 0.35
        P.torso.x = 0.08
        if (wind) {
          P.legL.x = -0.6
          P.kneeL.x = 1.35
          P.legL.z = -0.1
          P.torso.x = 0.1
          P.hipsRot.y = -0.08
          setGuardBoth(P)
        } else if (hit) {
          P.legL.x = -1.55
          P.kneeL.x = 0.12
          P.legL.z = -0.15
          P.legR.x = 0.05
          P.kneeR.x = 0.2
          P.hipsPos.y = 0
          P.hipsPos.z = 0.02 * H
          P.hipsRot.y = 0.12
          P.torso.x = -0.22
          P.torso.y = -0.12
          P.armL.x = -0.4
          P.armL.z = -0.75
          P.elbowL.x = -0.7
          P.armR.x = -0.55
          P.armR.z = 0.65
          P.elbowR.x = -0.9
          P.head.x = 0.05
        } else if (rec) {
          P.legL.x = -0.55
          P.kneeL.x = 0.95
          P.legL.z = -0.08
          P.torso.x = 0.08
          setGuardBoth(P)
        }
        break
      }

      case 'airKick': {
        P.legR.x = -0.7
        P.kneeR.x = 1.3
        P.legR.z = 0.08
        P.armL.x = -0.7
        P.armL.z = -0.8
        P.elbowL.x = -0.8
        P.armR.x = -0.5
        P.armR.z = 0.8
        P.elbowR.x = -0.8
        P.head.x = -0.05
        if (wind) {
          P.legL.x = -0.8
          P.kneeL.x = 1.2
          P.torso.x = 0.1
        } else if (hit) {
          P.legL.x = -1.55
          P.kneeL.x = 0.12
          P.legL.z = -0.1
          P.torso.x = -0.2
          P.torso.y = -0.1
          P.hipsRot.y = 0.1
          P.head.x = 0.1
        } else if (rec) {
          P.legL.x = -0.7
          P.kneeL.x = 0.9
          P.torso.x = 0.02
        }
        break
      }

      case 'airPunch': {
        P.legL.x = -0.95
        P.kneeL.x = 1.45
        P.legR.x = -0.7
        P.kneeR.x = 1.2
        P.legL.z = -0.12
        P.legR.z = 0.12
        P.torso.x = 0.1
        P.head.x = -0.08
        if (wind) {
          P.torso.y = -0.2
          P.armR.x = 0.2
          P.armR.z = 0.25
          P.elbowR.x = -1.6
          setGuard(P, -1)
        } else if (hit) {
          P.torso.x = 0.2
          P.torso.y = 0.3
          P.hipsRot.y = 0.1
          P.armR.x = -1.45
          P.armR.z = 0.1
          P.elbowR.x = -0.05
          P.armL.x = -0.5
          P.armL.z = -0.7
          P.elbowL.x = -1.2
          P.head.x = 0.05
        } else if (rec) {
          P.armR.x = -0.9
          P.armR.z = 0.2
          P.elbowR.x = -0.9
          setGuard(P, -1)
        }
        break
      }

      case 'uppercut': {
        P.hipsPos.y = -0.08 * H
        P.legL.x = -0.35
        P.legR.x = 0.15
        P.kneeL.x = 0.7
        P.kneeR.x = 0.4
        P.torso.x = 0.12
        if (wind) {
          P.hipsPos.y = -0.08 * H
          P.legL.x = -0.6
          P.legR.x = -0.4
          P.kneeL.x = 1.3
          P.kneeR.x = 1.2
          P.torso.x = 0.18
          P.torso.y = 0.2
          P.hipsRot.y = -0.1
          P.armR.x = 0.55
          P.armR.z = 0.25
          P.elbowR.x = -1.55
          setGuard(P, -1)
          P.head.x = 0.1
        } else if (hit) {
          P.hipsPos.y = 0.02 * H
          P.hipsPos.z = 0.02 * H
          P.legL.x = -0.05
          P.legR.x = 0.05
          P.kneeL.x = 0.08
          P.kneeR.x = 0.08
          P.torso.x = 0.08
          P.torso.y = -0.38
          P.hipsRot.y = 0.2
          P.armR.x = -2.55
          P.armR.z = 0.18
          P.elbowR.x = -0.25
          P.armL.x = -0.75
          P.armL.z = -0.3
          P.elbowL.x = -1.2
          P.head.x = -0.18
          P.head.y = 0.08
        } else if (rec) {
          P.hipsPos.y = -0.01 * H
          P.legL.x = -0.15
          P.legR.x = 0.1
          P.kneeL.x = 0.35
          P.kneeR.x = 0.35
          P.torso.x = 0.04
          P.torso.y = -0.1
          P.armR.x = -1.1
          P.armR.z = 0.2
          P.elbowR.x = -0.9
          setGuard(P, -1)
        }
        break
      }

      case 'special1': {
        P.hipsPos.y = -0.1 * H
        P.legL.x = -0.6
        P.legR.x = -0.6
        P.kneeL.x = 1.4
        P.kneeR.x = 1.4
        P.torso.x = 0.22
        if (wind) {
          P.hipsPos.y = -0.14 * H
          P.legL.x = -0.75
          P.legR.x = -0.75
          P.kneeL.x = 1.7
          P.kneeR.x = 1.7
          P.torso.x = 0.28
          P.head.x = 0.15
          P.armL.x = 0.5
          P.armR.x = 0.5
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -1.6
          P.elbowR.x = -1.6
        } else if (hit) {
          P.hipsPos.y = 0.05 * H
          P.hipsPos.z = 0.04 * H
          P.legL.x = -0.7
          P.kneeL.x = 1.2
          P.legR.x = -0.05
          P.kneeR.x = 0.1
          P.torso.x = -0.15
          P.torso.y = -0.15
          P.hipsRot.y = 0.15
          P.armL.x = -2.5
          P.armR.x = -2.65
          P.armL.z = -0.35
          P.armR.z = 0.35
          P.elbowL.x = -0.2
          P.elbowR.x = -0.2
          P.head.x = -0.25
        } else if (rec) {
          P.hipsPos.y = -0.02 * H
          P.legL.x = -0.3
          P.legR.x = 0.05
          P.kneeL.x = 0.4
          P.kneeR.x = 0.4
          P.torso.x = 0.02
          P.armL.x = -1.1
          P.armR.x = -1.1
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -0.8
          P.elbowR.x = -0.8
        }
        break
      }

      case 'roundhouse': {
        P.hipsPos.y = -0.02 * H
        P.legL.x = 0.1
        P.kneeL.x = 0.35
        if (wind) {
          P.hipsPos.y = -0.04 * H
          P.hipsRot.y = -0.55
          P.torso.y = 0.55
          P.torso.x = 0.12
          P.legL.x = -0.3
          P.kneeL.x = 0.8
          P.legR.x = -0.95
          P.kneeR.x = 1.65
          P.legR.z = 0.15
          setGuardBoth(P)
        } else if (hit) {
          P.hipsRot.y = 0.65
          P.torso.y = -0.45
          P.torso.x = -0.35
          P.chest.y = -0.15
          P.legR.x = -1.65
          P.kneeR.x = 0.15
          P.legR.z = 0.55
          P.legL.x = 0.05
          P.kneeL.x = 0.3
          P.hipsPos.z = 0.02 * H
          P.armL.x = -0.3
          P.armL.z = -1.0
          P.elbowL.x = -0.5
          P.armR.x = -0.5
          P.armR.z = 0.9
          P.elbowR.x = -0.7
        } else if (rec) {
          P.hipsRot.y = 0.2
          P.torso.y = -0.1
          P.legR.x = -0.6
          P.kneeR.x = 0.9
          setGuardBoth(P)
        }
        break
      }

      case 'special2': {
        P.hipsPos.y = -0.02 * H
        P.legL.x = 0.1
        P.kneeL.x = 0.3
        if (wind) {
          P.hipsPos.y = -0.03 * H
          P.hipsRot.y = -0.5
          P.torso.y = 0.55
          P.torso.x = 0.15
          P.legL.x = -0.3
          P.kneeL.x = 0.8
          P.legR.x = -0.9
          P.kneeR.x = 1.7
          P.legR.z = 0.2
          setGuardBoth(P)
        } else if (hit) {
          P.hipsPos.y = 0.01 * H
          P.hipsPos.z = 0.04 * H
          P.hipsRot.y = 0.7
          P.torso.y = -0.55
          P.torso.x = -0.4
          P.chest.y = -0.2
          P.legR.x = -1.8
          P.kneeR.x = 0.05
          P.legR.z = 0.7
          P.legL.x = 0.05
          P.kneeL.x = 0.15
          P.armL.x = -0.2
          P.armL.z = -1.0
          P.elbowL.x = -0.4
          P.armR.x = -0.4
          P.armR.z = 0.9
          P.elbowR.x = -0.6
          P.head.x = 0.1
        } else if (rec) {
          P.hipsRot.y = 0.2
          P.torso.y = -0.15
          P.legR.x = -0.7
          P.kneeR.x = 0.9
          P.legR.z = 0.2
          setGuardBoth(P)
        }
        break
      }

      case 'finisher': {
        P.hipsPos.y = -0.015 * H
        P.legL.x = -0.3
        P.legR.x = 0.2
        P.kneeL.x = 0.5
        P.kneeR.x = 0.35
        if (wind) {
          P.hipsPos.y = -0.06 * H
          P.legL.x = -0.4
          P.legR.x = -0.2
          P.kneeL.x = 1.0
          P.kneeR.x = 1.0
          P.torso.x = -0.25
          P.head.x = -0.15
          P.armL.x = -2.9
          P.armR.x = -2.9
          P.armL.z = -0.3
          P.armR.z = 0.3
          P.elbowL.x = -0.6
          P.elbowR.x = -0.6
        } else if (hit) {
          P.hipsPos.y = -0.09 * H
          P.hipsPos.z = 0.05 * H
          P.legL.x = -0.6
          P.legR.x = -0.3
          P.kneeL.x = 1.3
          P.kneeR.x = 1.2
          P.torso.x = 0.45
          P.chest.x = 0.15
          P.head.x = 0.25
          P.armL.x = -0.9
          P.armR.x = -0.9
          P.armL.z = 0.15
          P.armR.z = -0.15
          P.elbowL.x = -0.12
          P.elbowR.x = -0.12
        } else if (rec) {
          P.torso.x = 0.05
          P.armL.x = -0.6
          P.armR.x = -0.6
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -0.8
          P.elbowR.x = -0.8
        }
        break
      }

      case 'sweep': {
        P.hipsPos.y = -0.18 * H
        P.hipsPos.z = 0.02 * H
        P.hipsRot.x = 0.05
        P.legL.x = -0.9
        P.kneeL.x = 1.9
        P.legL.z = -0.1
        P.legR.x = -1.4
        P.kneeR.x = 0.12
        P.legR.z = 0.3
        P.torso.x = 0.3
        P.head.x = 0.05
        if (wind) {
          P.hipsRot.y = -0.35
          P.torso.y = 0.35
          P.legR.x = -1.2
          P.kneeR.x = 0.5
          P.legR.z = 0.2
          P.armL.x = 0.3
          P.armL.z = -0.8
          P.elbowL.x = -0.5
          P.armR.x = 0.4
          P.armR.z = 0.8
          P.elbowR.x = -0.5
        } else if (hit) {
          P.hipsRot.y = 0.9
          P.torso.y = -0.8
          P.chest.y = -0.2
          P.torso.x = 0.38
          P.legL.x = -0.95
          P.kneeL.x = 1.95
          P.legR.x = -1.4
          P.kneeR.x = 0.12
          P.legR.z = 0.55
          P.armL.x = 0.3
          P.armL.z = -0.9
          P.elbowL.x = -0.4
          P.armR.x = 0.4
          P.armR.z = 0.9
          P.elbowR.x = -0.4
          P.head.x = 0.1
        } else if (rec) {
          P.hipsPos.y = -0.18 * H
          P.hipsRot.y = 0.3
          P.torso.y = -0.25
          P.legR.x = -1.2
          P.kneeR.x = 0.35
          P.legR.z = 0.3
          P.armL.x = 0.1
          P.armL.z = -0.5
          P.elbowL.x = -0.6
          P.armR.x = 0.2
          P.armR.z = 0.5
          P.elbowR.x = -0.6
        }
        break
      }

      case 'grab': {
        P.hipsPos.y = -0.005 * H
        P.legL.x = -0.2
        P.legR.x = 0.15
        P.kneeL.x = 0.35
        P.kneeR.x = 0.3
        if (wind) {
          P.torso.x = 0.1
          P.armL.x = 0.3
          P.armR.x = 0.3
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -1.2
          P.elbowR.x = -1.2
          P.head.x = -0.05
        } else if (hit) {
          P.torso.x = 0.25
          P.chest.x = 0.1
          P.hipsPos.z = 0.04 * H
          P.armL.x = -1.55
          P.armR.x = -1.55
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -0.15
          P.elbowR.x = -0.15
          P.kneeL.x = 0.5
          P.kneeR.x = 0.5
          P.head.x = -0.1
        } else if (rec) {
          P.torso.x = 0.05
          P.armL.x = -1.0
          P.armR.x = -1.0
          P.armL.z = -0.2
          P.armR.z = 0.2
          P.elbowL.x = -0.8
          P.elbowR.x = -0.8
        }
        break
      }

      default: {
        // Unknown move: treat as a straight punch.
        P.armR.x = hit ? -1.55 : wind ? 0.35 : -0.8
        P.elbowR.x = hit ? -0.05 : -1.6
        P.torso.y = hit ? -0.35 : 0.2
        P.hipsRot.y = hit ? 0.18 : -0.1
        break
      }
    }

    // Air attacks keep the tucked-airborne silhouette even on the ground
    // for a frame or two while the fighter settles.
    if (pose && pose.airborne && (id === 'airPunch' || id === 'airKick')) {
      P.hipsPos.y += 0.01 * H
    }
  }

  // -----------------------------------------------------------------------
  // Animation state
  // -----------------------------------------------------------------------
  const stateRef = { state: 'idle', stateT: 0 }
  let time = 0
  let walkPhase = 0
  let facingTarget = 1
  let lastPoseX = null
  let wasFlashing = false

  root.rotation.y = PI / 2

  function setFacing(dir) {
    facingTarget = dir >= 0 ? 1 : -1
  }

  function update(pose = {}, dt = 1 / 60) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 1 / 60
    time += dt

    let st = pose.state || 'idle'
    if (pose.ko) st = 'ko'
    else if (pose.victory) st = 'victory'

    if (st !== stateRef.state) {
      stateRef.state = st
      stateRef.stateT = 0
    } else {
      stateRef.stateT += dt
    }
    const state = stateRef.state
    const stateT = stateRef.stateT

    if (pose.facing !== undefined) setFacing(pose.facing)

    if (Number.isFinite(pose.y)) root.position.y = pose.y

    const vx = Number.isFinite(pose.vx) ? pose.vx : 0
    if (state === 'walk') {
      const dx = Number.isFinite(pose.x) && lastPoseX !== null ? Math.abs(pose.x - lastPoseX) : 0
      walkPhase += Math.max(Math.abs(vx) * dt, dx) * 3.1
    }
    if (Number.isFinite(pose.x)) lastPoseX = pose.x

    const attackId = pose.attackId || null
    const phase = pose.phase || (state === 'attack' ? 'active' : null)

    root.rotation.y = damp(root.rotation.y, facingTarget * PI / 2, 16, dt)

    resetTarget()
    applyIdle(target, time)

    const crouching = !!pose.crouching
    if (state === 'ko' || state === 'knockdown') {
      applyKnockdown(target, stateT)
    } else if (state === 'getup') {
      applyGetup(target, stateT)
    } else if (state === 'victory') {
      applyVictory(target, stateT)
    } else if (state === 'hitstun') {
      applyHitstun(target, stateT)
    } else if (state === 'blockstun' || (pose.blocking && (state === 'idle' || state === 'walk' || state === 'crouch'))) {
      applyBlock(target, stateT, crouching)
    } else if (state === 'attack') {
      applyAttack(target, attackId || 'jab', phase || 'active', stateT, pose)
    } else if (state === 'jump') {
      applyJump(target, pose)
    } else if (state === 'crouch') {
      applyCrouch(target, stateT)
    } else if (state === 'walk') {
      applyWalk(target, pose, crouching)
    } else if (state === 'intro') {
      applyIntro(target, stateT)
    } else if (state === 'super') {
      applySuper(target, stateT)
    } else if (state === 'frozen') {
      applyFrozen(target, stateT)
    }

    if (pose.airborne && (state === 'idle' || state === 'walk')) {
      applyJump(target, pose)
    }

    let rate = 9
    if (state === 'attack') {
      rate = phase === 'active' ? 34 : phase === 'startup' ? 26 : 16
    } else if (state === 'hitstun' || state === 'blockstun') {
      rate = 22
    } else if (state === 'knockdown' || state === 'ko') {
      rate = 9
    } else if (state === 'getup') {
      rate = 16
    } else if (state === 'jump') {
      rate = 12
    } else if (state === 'crouch') {
      rate = 14
    } else if (state === 'victory') {
      rate = 10
    } else if (state === 'super') {
      rate = 8
    }

    for (const key of ROT_KEYS) {
      const c = cur[key]
      const t = target[key]
      c.x = damp(c.x, t.x, rate, dt)
      c.y = damp(c.y, t.y, rate, dt)
      c.z = damp(c.z, t.z, rate, dt)
    }
    cur.hipsPos.x = damp(cur.hipsPos.x, target.hipsPos.x, rate, dt)
    cur.hipsPos.y = damp(cur.hipsPos.y, target.hipsPos.y, rate, dt)
    cur.hipsPos.z = damp(cur.hipsPos.z, target.hipsPos.z, rate, dt)

    hips.position.set(cur.hipsPos.x, hipY + cur.hipsPos.y, cur.hipsPos.z)
    hips.rotation.set(cur.hipsRot.x, cur.hipsRot.y, cur.hipsRot.z)
    torso.rotation.set(cur.torso.x, cur.torso.y, cur.torso.z)
    chest.rotation.set(cur.chest.x, cur.chest.y, cur.chest.z)
    head.rotation.set(cur.head.x, cur.head.y, cur.head.z)
    armL.arm.rotation.set(cur.armL.x, cur.armL.y, cur.armL.z)
    armR.arm.rotation.set(cur.armR.x, cur.armR.y, cur.armR.z)
    armL.elbow.rotation.set(cur.elbowL.x, cur.elbowL.y, cur.elbowL.z)
    armR.elbow.rotation.set(cur.elbowR.x, cur.elbowR.y, cur.elbowR.z)
    legL.leg.rotation.set(cur.legL.x, cur.legL.y, cur.legL.z)
    legR.leg.rotation.set(cur.legR.x, cur.legR.y, cur.legR.z)
    legL.knee.rotation.set(cur.kneeL.x, cur.kneeL.y, cur.kneeL.z)
    legR.knee.rotation.set(cur.kneeR.x, cur.kneeR.y, cur.kneeR.z)
    legL.ankle.rotation.x = -(cur.hipsRot.x + cur.legL.x + cur.kneeL.x)
    legR.ankle.rotation.x = -(cur.hipsRot.x + cur.legR.x + cur.kneeR.x)

    // A long sari skirt bunches up instead of clipping through the floor.
    if (skirtGroup) {
      const sy = clamp(1 + cur.hipsPos.y / (0.44 * H), 0.4, 1)
      const sr = mix(0.72, 1, sy)
      skirtGroup.scale.set(sr, sy, sr)
    }

    // Blink: quick squash of both eye groups.
    const bt = time % 4.7
    const blink = bt > 4.62 ? 0.15 : bt > 4.54 ? 0.55 : 1
    for (const e of blinkEyes) e.scale.y = blink

    // Hit flash.
    const flashing = (pose.flash || 0) > 0
    if (flashing !== wasFlashing) {
      wasFlashing = flashing
      for (const m of mats) {
        m.emissive.setHex(flashing ? 0xffffff : 0x000000)
        m.emissiveIntensity = flashing ? 0.45 : 1
      }
    }
  }

  function dispose() {
    if (root.parent) root.parent.remove(root)
    const geoSet = new Set(geoms)
    for (const g of geoSet) g.dispose()
    const matSet = new Set(mats)
    for (const m of matSet) m.dispose()
    geoms.length = 0
    mats.length = 0
    root.clear()
  }

  return {
    root,
    head,
    height: H,
    update,
    setFacing,
    dispose,
    joints: {
      hips,
      torso,
      chest,
      head,
      armL: armL.arm,
      elbowL: armL.elbow,
      armR: armR.arm,
      elbowR: armR.elbow,
      legL: legL.leg,
      kneeL: legL.knee,
      ankleL: legL.ankle,
      legR: legR.leg,
      kneeR: legR.knee,
      ankleR: legR.ankle,
    },
  }
}
