import * as THREE from 'three'
import { CHARACTERS } from './data.js'

const DURATION = 4.2
const IMPACT = 2.35

const basic = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...opts })
const glow = (color, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })

function add(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(...pos)
  m.rotation.set(...rot)
  m.scale.set(...scale)
  m.castShadow = true
  parent.add(m)
  return m
}

function group(parent, pos = [0, 0, 0]) {
  const g = new THREE.Group()
  g.position.set(...pos)
  parent.add(g)
  return g
}

function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic(color, opts)) }
function cyl(rt, rb, h, color, seg = 16) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), basic(color)) }
function sph(r, color, seg = 20) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), basic(color)) }

export function createSuperSequence({ scene, rigs, side, charId, audio, fx, fighters }) {
  const caster = rigs[side]
  const target = rigs[1 - side]
  const casterX = caster?.root.position.x ?? (side === 0 ? -3 : 3)
  const targetX = target?.root.position.x ?? (side === 0 ? 3 : -3)
  const dir = side === 0 ? 1 : -1
  const char = CHARACTERS[charId]
  const root = group(scene)
  const props = []
  const timeline = []
  let t = 0
  let done = false
  let impacted = false

  const mid = (casterX + targetX) / 2

  const camera = {
    position: new THREE.Vector3(mid + dir * 4.2, 2.8, 8.8),
    lookAt: new THREE.Vector3(mid, 1.2, 0),
    fov: 46,
  }

  const addProp = (m) => { root.add(m); props.push(m); return m }

  /* ---------------- per-character build-up ---------------- */
  let updateBuild = () => {}
  let onImpact = () => {}

  if (charId === 'modi') {
    const chakraGroup = group(root, [casterX, 2.5, 0])
    const chakraMat = glow(0xffa030, 2.4)
    const chakra = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 10, 40), chakraMat)
    chakraGroup.add(chakra)
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.18, 0.035), chakraMat)
      spoke.rotation.z = (i / 8) * Math.PI * 2
      chakraGroup.add(spoke)
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), glow(0xffd070, 2))
    chakraGroup.add(hub)
    const aura = addProp(new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.15 })))
    aura.position.set(casterX, 1.2, 0)
    let flung = false
    updateBuild = (dt) => {
      const k = Math.min(1, t / 1.6)
      chakraGroup.scale.setScalar(0.3 + k * 0.85)
      chakraGroup.rotation.z += dt * (5 + k * 14)
      chakraGroup.position.y = 2.35 + Math.sin(t * 4) * 0.15 + k * 0.55
      aura.scale.setScalar(1 + Math.sin(t * 8) * 0.08)
      aura.material.opacity = 0.12 + k * 0.12
      if (t > 1.9 && !flung) {
        flung = true
        audio.play('chakra')
      }
      if (flung) {
        const p = Math.min(1, (t - 1.9) / 0.45)
        chakraGroup.position.x = casterX + (targetX - casterX) * p
        chakraGroup.position.y = 2.4 + Math.sin(p * Math.PI) * 0.4
      }
    }
    onImpact = () => {
      fx.burst(new THREE.Vector3(targetX, 1.5, 0), 'gold', 34, 6)
      fx.ring(new THREE.Vector3(targetX, 1.2, 0), 0xff8a00)
      chakraGroup.visible = false
      aura.visible = false
      audio.play('boom')
    }
  }

  if (charId === 'rahul') {
    const machine = group(root, [casterX - dir * 1.6, 0, 0])
    add(machine, new THREE.BoxGeometry(1.2, 1.0, 0.9), basic(0x9aa4b0, { metalness: 0.6, roughness: 0.35 }), [0, 0.55, 0])
    add(machine, new THREE.CylinderGeometry(0.28, 0.38, 0.7, 16), basic(0x2a3038, { metalness: 0.8 }), [0, 1.35, 0])
    add(machine, new THREE.TorusGeometry(0.3, 0.06, 8, 24), glow(0x66ccff, 1.2), [0, 1.72, 0], [Math.PI / 2, 0, 0])
    const lamp = add(machine, new THREE.SphereGeometry(0.09, 10, 10), glow(0xff3300, 2), [0.35, 1.15, 0.42])
    const potato = addProp(sph(0.42, 0xb98a4a, 16))
    potato.scale.set(1, 0.75, 0.8)
    potato.position.set(targetX, 1.1, 0)
    const beam = addProp(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.75 })))
    beam.position.set((casterX - dir * 1.6 + targetX) / 2, 1.8, 0)
    beam.rotation.z = Math.PI / 2
    const gold = addProp(box(0.7, 0.3, 0.35, 0xffd24a, { metalness: 0.9, roughness: 0.2 }))
    gold.position.set(casterX - dir * 1.6, 0.8, 0)
    gold.visible = false
    let zapped = false
    updateBuild = () => {
      lamp.material.emissiveIntensity = 1.2 + Math.sin(t * 22) * 1
      if (t > 1.2 && !zapped) { zapped = true; audio.play('charge') }
      if (t > 1.2 && t < 1.9) {
        beam.visible = true
        beam.material.opacity = 0.5 + Math.random() * 0.5
        potato.scale.setScalar(0.85 + Math.sin(t * 30) * 0.08)
      } else if (t >= 1.9) {
        beam.visible = false
        potato.position.y = Math.max(0.3, potato.position.y - 0.02)
        potato.scale.multiplyScalar(0.98)
        gold.visible = t > 2.1
      }
    }
    onImpact = () => {
      fx.burst(new THREE.Vector3(targetX, 1.2, 0), 'gold', 30, 5)
      fx.ring(new THREE.Vector3(casterX - dir * 1.6, 1, 0), 0xffd24a)
      audio.play('coins')
      audio.play('boom')
      gold.visible = true
      gold.scale.setScalar(1.6)
    }
  }

  if (charId === 'didi') {
    const pot = group(root, [casterX - dir * 1.2, 0, 0])
    add(pot, new THREE.CylinderGeometry(0.55, 0.4, 0.7, 18), basic(0x1a1a1a, { roughness: 0.9 }), [0, 0.35, 0])
    add(pot, new THREE.TorusGeometry(0.56, 0.08, 8, 24), basic(0x2a2a2a), [0, 0.7, 0], [Math.PI / 2, 0, 0])
    const brew = add(pot, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 18), glow(0x66ff66, 1.2), [0, 0.68, 0])
    const bubbles = []
    for (let i = 0; i < 6; i++) {
      const b = addProp(sph(0.07 + Math.random() * 0.08, 0x88ff88))
      b.material = glow(0x66ff66, 1.5)
      b.position.set(casterX - dir * 1.2 + (Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.5)
      bubbles.push(b)
    }
    const frog = group(root, [targetX, 0.35, 0])
    const body = add(frog, new THREE.SphereGeometry(0.35, 16, 16), basic(0x3aa83a), [0, 0.25, 0], [0, 0, 0], [1, 0.7, 1.2])
    for (const s of [-1, 1]) {
      add(frog, new THREE.SphereGeometry(0.1, 10, 10), basic(0xffffff), [s * 0.18, 0.48, 0.22])
      add(frog, new THREE.SphereGeometry(0.05, 8, 8), basic(0x111111), [s * 0.18, 0.5, 0.3])
    }
    frog.visible = false
    let transformed = false
    updateBuild = () => {
      brew.scale.y = 1 + Math.sin(t * 9) * 0.3
      brew.material.emissiveIntensity = 1 + Math.sin(t * 12) * 0.5
      for (const b of bubbles) {
        b.position.y += 0.008
        if (b.position.y > 1.4) b.position.y = 0.75
      }
      if (t > 1.6 && !transformed) { transformed = true; audio.play('poof') }
      if (transformed) {
        frog.visible = true
        frog.scale.setScalar(Math.min(1, (t - 1.6) * 3))
        frog.position.y = 0.35 + Math.abs(Math.sin(t * 8)) * 0.18
      }
    }
    onImpact = () => {
      fx.burst(new THREE.Vector3(targetX, 1, 0), 'gold', 26, 4)
      audio.play('poof')
      audio.play('boom')
    }
  }

  if (charId === 'trump') {
    const order = group(root, [casterX + dir * 1.1, 0, 0])
    const paper = add(order, new THREE.BoxGeometry(0.5, 0.03, 0.7), glow(0xffd24a, 0.4), [0, 1.2, 0], [0, 0.3, 0])
    add(order, new THREE.BoxGeometry(0.9, 0.04, 0.04), basic(0x8a6a20), [0, 0.9, 0])
    const crates = []
    for (let i = 0; i < 8; i++) {
      const c = addProp(box(0.4, 0.4, 0.4, 0xa8743a))
      crates.push({ mesh: c, a: (i / 8) * Math.PI * 2, r: 1.1 + Math.random() * 0.5 })
    }
    const stamp = group(root, [targetX, 0, 0])
    add(stamp, new THREE.BoxGeometry(1.1, 0.8, 1.1), basic(0x7a1a1a, { metalness: 0.4 }), [0, 0.4, 0])
    add(stamp, new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), basic(0x3a2a1a), [0, 1.25, 0])
    add(stamp, new THREE.BoxGeometry(1.3, 0.1, 1.3), basic(0x5a1010), [0, 0.05, 0])
    stamp.position.y = 8
    let dropped = false
    updateBuild = () => {
      paper.rotation.z += 0.02
      paper.position.y = 1.2 + Math.sin(t * 3) * 0.06
      for (const c of crates) {
        const a = c.a + t * 3
        c.mesh.position.set(mid + Math.cos(a) * c.r, 1.2 + Math.sin(t * 5 + c.a) * 0.4, Math.sin(a) * c.r)
        c.mesh.rotation.x += 0.08
        c.mesh.rotation.y += 0.06
      }
      if (t > 1.7 && !dropped) { dropped = true; audio.play('whoosh') }
      if (dropped) stamp.position.y = Math.max(0.1, stamp.position.y - 0.55)
    }
    onImpact = () => {
      fx.burst(new THREE.Vector3(targetX, 0.8, 0), 'gold', 34, 5)
      fx.ring(new THREE.Vector3(targetX, 0.2, 0), 0xffd24a)
      audio.play('stamp')
      audio.play('boom')
      for (const c of crates) c.mesh.visible = false
    }
  }

  if (charId === 'yogi') {
    const dozer = group(root, [casterX - dir * 6, 0, 0])
    add(dozer, new THREE.BoxGeometry(1.8, 0.8, 1.1), basic(0xf0a020, { metalness: 0.3 }), [0, 0.7, 0])
    add(dozer, new THREE.BoxGeometry(0.9, 0.7, 0.9), basic(0x2a2a2a, { metalness: 0.5 }), [-0.2, 1.4, 0])
    const bucket = add(dozer, new THREE.BoxGeometry(0.9, 0.6, 1.2), basic(0x8a8a8a, { metalness: 0.7 }), [1.2, 0.5, 0], [0, 0, -0.2])
    add(dozer, new THREE.BoxGeometry(0.3, 0.3, 1.2), basic(0x6a6a6a), [0.9, 0.7, 0], [0, 0, 0.4])
    for (const s of [-1, 1]) {
      for (const z of [-0.55, 0.55]) {
        const wheel = add(dozer, new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14), basic(0x111111), [s * 0.6, 0.34, z], [Math.PI / 2, 0, 0])
        wheel.castShadow = true
      }
    }
    const pool = addProp(new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: 0x8a0a0a, transparent: true, opacity: 0.85 })))
    pool.rotation.x = -Math.PI / 2
    pool.position.set(targetX, 0.02, 0)
    pool.visible = false
    let arrived = false
    let slams = 0
    updateBuild = () => {
      const p = Math.min(1, t / 1.8)
      dozer.position.x = casterX - dir * 6 + (targetX - (casterX - dir * 6)) * p * 0.75
      if (p >= 1) arrived = true
      if (arrived) {
        const k = Math.sin(t * 9)
        bucket.position.y = 0.5 + Math.max(0, k) * 0.5
        bucket.rotation.z = -0.2 - Math.max(0, k) * 0.5
        if (k > 0.9 && slams < 3) {
          slams++
          audio.play('bulldozer')
          appShake()
        }
      }
    }
    const appShake = () => { fx.burst(new THREE.Vector3(targetX, 0.4, 0), 'red', 14, 3) }
    onImpact = () => {
      pool.visible = true
      fx.burst(new THREE.Vector3(targetX, 1, 0), 'red', 36, 5)
      audio.play('boom')
    }
  }

  if (charId === 'nitin') {
    const hole = addProp(new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: 0x050505 })))
    hole.rotation.x = -Math.PI / 2
    hole.position.set(targetX, 0.02, 0)
    hole.scale.setScalar(0.1)
    const cane = group(root, [casterX + dir * 1.3, 0, 0])
    for (let i = 0; i < 3; i++) {
      add(cane, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), basic(0x6a9a3a), [i * 0.16 - 0.16, 0.75, 0], [0, 0, 0.12 * (i - 1)])
    }
    const machine = add(cane, new THREE.BoxGeometry(0.8, 0.7, 0.7), basic(0x8a8a8a, { metalness: 0.6 }), [0.7, 0.45, 0])
    const flame = addProp(new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 12), glow(0xff7a00, 2)))
    flame.position.set(targetX, 0.7, 0)
    flame.visible = false
    const match = addProp(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), basic(0xd8c090)))
    match.position.set(targetX + 0.4, 1.2, 0)
    match.visible = false
    let lit = false
    updateBuild = () => {
      const p = Math.min(1, t / 1.5)
      hole.scale.setScalar(0.1 + p * 0.9)
      if (t > 1.6) match.visible = true
      if (t > 1.9 && !lit) { lit = true; audio.play('whoosh') }
      if (lit) {
        flame.visible = true
        flame.scale.setScalar(0.8 + Math.random() * 0.5)
        flame.position.y = 0.7 + Math.random() * 0.2
      }
    }
    onImpact = () => {
      fx.burst(new THREE.Vector3(targetX, 1, 0), 'red', 34, 5)
      fx.ring(new THREE.Vector3(targetX, 0.2, 0), 0xff6a00)
      audio.play('boom')
    }
  }

  /* ---------------- timeline ---------------- */
  const camStart = camera.position.clone()
  const camMid = new THREE.Vector3(casterX + dir * 1.4, 2.2, 6.6)
  const camEnd = new THREE.Vector3(mid - dir * 1.2, 2.5, 7.6)

  function step(dt) {
    t += dt
    const k = Math.min(1, t / DURATION)
    updateBuild(dt)

    // camera choreography
    if (t < 1.6) {
      camera.position.lerpVectors(camStart, camMid, t / 1.6)
      camera.lookAt.set(casterX, 1.35, 0)
      camera.fov = 46 + (t / 1.6) * 2
    } else if (t < IMPACT) {
      camera.position.copy(camMid)
      camera.lookAt.lerp(new THREE.Vector3(targetX, 1.3, 0), 1 - Math.exp(-4 * dt))
      camera.fov = 48
    } else if (t < IMPACT + 0.8) {
      camera.position.set(mid + dir * 2.2, 1.5, 4.6)
      camera.lookAt.set(targetX, 1.4, 0)
      camera.fov = 50
    } else {
      const p = (t - IMPACT - 0.8) / (DURATION - IMPACT - 0.8)
      camera.position.lerpVectors(new THREE.Vector3(mid + dir * 2.2, 1.5, 4.6), camEnd, p)
      camera.lookAt.set(targetX, 1.3, 0)
      camera.fov = 50 - p * 6
    }

    if (!impacted && t >= IMPACT) {
      impacted = true
      onImpact()
    }

    // rig poses
    const casterY = charId === 'modi' && t < 2.4 ? Math.min(2.6, t * 1.3) : 0
    const casterPose = {
      state: 'super', stateTime: t, facing: dir, x: casterX, y: casterY, vx: 0, vy: 0,
      airborne: charId === 'modi' && t < 2.3, blocking: false, ko: false, victory: false,
    }
    const targetPose = {
      state: t < IMPACT ? 'frozen' : 'knockdown', stateTime: t - IMPACT, facing: -dir,
      x: targetX, y: t < IMPACT ? 0 : Math.max(0, 1.5 - (t - IMPACT) * 1.6), vx: 0, vy: 0,
      airborne: t > IMPACT && t < IMPACT + 0.6, blocking: false, ko: false, victory: false,
    }
    if (caster) {
      caster.update(casterPose, dt)
    }
    if (target) target.update(targetPose, dt)

    if (t >= DURATION) done = true
    return done
  }

  function updateRig(i, dt) {
    const rig = i === side ? caster : target
    if (!rig) return
    // step() already animates both; this is a no-op hook for the main loop
  }

  function dispose() {
    scene.remove(root)
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material.dispose()
      }
    })
    props.length = 0
    if (caster) { caster.root.position.y = 0 }
  }

  return { step, done: () => done, camera, updateRig, dispose, get t() { return t } }
}
