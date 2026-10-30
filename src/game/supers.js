import * as THREE from 'three'
import { CHARACTERS } from './data.js'
import { SUPER_DURATION } from './engine.js'

// ============================================================================
//  CINEMATIC SUPER-MOVE DIRECTOR
//  Timeline, gestures, camera and props per CINEMATICS.md.
//  The engine stays authoritative: it only waits in `phase = 'super'`, then
//  resolves damage and releases both fighters when DURATION elapses.
// ============================================================================

const DURATION = SUPER_DURATION // seconds, shared with engine.resolveSuper()
const FINGER = 0.175 // fraction of rig height to the fingertip, local Y

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v)
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k) }
const lerp = (a, b, k) => a + (b - a) * k
const seg = (t, a, b) => clamp01((t - a) / Math.max(0.0001, b - a))

function basic(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...opts })
}
function glow(color, intensity = 1.8) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })
}
function mesh(geo, mtl, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mtl)
  m.position.set(...pos)
  m.rotation.set(...rot)
  m.scale.set(...scale)
  m.castShadow = true
  m.receiveShadow = true
  return m
}
function box(w, h, d, color, opts) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic(color, opts)) }
function cyl(rt, rb, h, color, seg = 16, opts) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), basic(color, opts)) }
function sph(r, color, seg = 16, opts) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), basic(color, opts)) }

/** Keyframe list → camera target evaluator. */
function cameraTrack(frames) {
  return (t) => {
    if (t <= frames[0].t) return { pos: new THREE.Vector3(...frames[0].pos), look: new THREE.Vector3(...frames[0].look), fov: frames[0].fov }
    const last = frames[frames.length - 1]
    if (t >= last.t) return { pos: new THREE.Vector3(...last.pos), look: new THREE.Vector3(...last.look), fov: last.fov }
    let i = 0
    while (i < frames.length - 2 && frames[i + 1].t < t) i++
    const a = frames[i]; const b = frames[i + 1]
    const k = ease(seg(t, a.t, b.t))
    return {
      pos: new THREE.Vector3().lerpVectors(new THREE.Vector3(...a.pos), new THREE.Vector3(...b.pos), k),
      look: new THREE.Vector3().lerpVectors(new THREE.Vector3(...a.look), new THREE.Vector3(...b.look), k),
      fov: lerp(a.fov, b.fov, k),
    }
  }
}

// ---------------------------------------------------------------- props ----

function makeChakra() {
  const g = new THREE.Group()
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.075, 8, 36), glow(0xffd27a, 2.6))
  g.add(ring)
  const disc = mesh(new THREE.CircleGeometry(0.45, 28), new THREE.MeshBasicMaterial({ color: 0xffb52a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }))
  g.add(disc)
  for (let i = 0; i < 8; i++) {
    const spoke = box(0.05, 0.95, 0.03, 0xffe6b0, { emissive: 0xffbb44, emissiveIntensity: 1.2 })
    spoke.rotation.z = (i / 8) * Math.PI * 2
    g.add(spoke)
  }
  g.add(sph(0.075, 0xfff4d0, 10, { emissive: 0xffdd88, emissiveIntensity: 1.6 }))
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.16, depthWrite: false }))
  g.add(halo)
  g.userData.ring = ring
  return g
}

function makePotato() {
  const g = new THREE.Group()
  const body = sph(0.42, 0xc98a4a, 18, { roughness: 0.9 })
  body.scale.set(1, 0.74, 0.86)
  g.add(body)
  for (const [x, y, z, r] of [[0.2, 0.14, 0.28, 0.1], [-0.24, -0.06, 0.2, 0.08], [0.05, -0.2, -0.3, 0.09], [-0.1, 0.24, -0.1, 0.07]]) {
    g.add(sph(r, 0xa9713a, 10, { roughness: 0.95 }, ), )
    const b = g.children[g.children.length - 1]
    b.position.set(x, y, z)
  }
  for (const [x, y] of [[-0.1, 0.34], [0.12, 0.32]]) {
    const eye = sph(0.05, 0xfff8e8, 8)
    g.add(eye)
    const p = sph(0.024, 0x1a1210, 8)
    p.position.set(x, y, 0.34)
    g.add(p)
  }
  return g
}

function makeMachine() {
  const g = new THREE.Group()
  const body = box(1.3, 1.05, 1.0, 0x9aa4b0, { metalness: 0.65, roughness: 0.32 })
  body.position.y = 0.62
  g.add(body)
  const hopper = cyl(0.42, 0.24, 0.6, 0x6f7a86, 18, { metalness: 0.6, roughness: 0.4 })
  hopper.position.set(0, 1.4, 0)
  g.add(hopper)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 22), basic(0x4a545e, { metalness: 0.7 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 1.7
  g.add(rim)
  const chute = box(0.5, 0.34, 0.5, 0x6f7a86, { metalness: 0.6 })
  chute.position.set(0.5, 0.9, 0)
  g.add(chute)
  const pipe = cyl(0.1, 0.1, 1.4, 0x5b646e, 10, { metalness: 0.7 })
  pipe.position.set(-0.5, 1.6, -0.3)
  g.add(pipe)
  const gauge = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 20), basic(0xe8e2d0, { roughness: 0.5 }))
  gauge.position.set(0.3, 1.1, 0.52)
  g.add(gauge)
  const needle = box(0.03, 0.16, 0.02, 0xc8102e)
  needle.position.set(0.3, 1.1, 0.54)
  g.add(needle)
  for (const s of [-1, 1]) {
    g.add(box(0.12, 0.55, 0.12, 0x4a545e, { metalness: 0.5 }))
    g.children[g.children.length - 1].position.set(s * 0.5, 0.28, 0.4)
  }
  const lamp = sph(0.09, 0xff5522, 10, { emissive: 0xff4400, emissiveIntensity: 2 })
  lamp.position.set(0.42, 1.28, 0.3)
  g.add(lamp)
  g.userData = { hopper, needle, lamp, rim }
  return g
}

function makeCauldron() {
  const g = new THREE.Group()
  g.add(cyl(0.6, 0.42, 0.7, 0x17171a, 20, { roughness: 0.9 }))
  g.children[0].position.y = 0.4
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 26), basic(0x2a2a30, { roughness: 0.8 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.75
  g.add(rim)
  const brew = mesh(new THREE.CircleGeometry(0.56, 24), glow(0x66ff66, 1.4), [0, 0.76, 0], [-Math.PI / 2, 0, 0])
  g.add(brew)
  for (const [x, z] of [[-0.3, 0.2], [0.3, 0.2], [0, -0.3]]) {
    const leg = cyl(0.05, 0.07, 0.35, 0x0f0f12, 8)
    leg.position.set(x, 0.16, z)
    g.add(leg)
  }
  const ladle = new THREE.Group()
  ladle.add(cyl(0.03, 0.03, 0.9, 0x8a6a40, 8))
  ladle.children[0].position.y = 0.45
  ladle.add(sph(0.13, 0x2a2a30, 10))
  ladle.children[1].position.y = 0.9
  ladle.position.set(0.5, 0.7, 0.2)
  ladle.rotation.z = -0.5
  g.add(ladle)
  const bubbles = []
  for (let i = 0; i < 7; i++) {
    const b = sph(0.055 + Math.random() * 0.07, 0x88ff88, 8, { emissive: 0x44cc44, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 })
    g.add(b)
    bubbles.push({ m: b, x: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 0.7, o: Math.random() * 1.2 })
  }
  g.userData = { ladle, brew, bubbles }
  return g
}

function makeFrog() {
  const g = new THREE.Group()
  const body = sph(0.34, 0x3aa83a, 16, { roughness: 0.7 })
  body.scale.set(1.1, 0.72, 1.25)
  body.position.y = 0.26
  g.add(body)
  for (const s of [-1, 1]) {
    g.add(sph(0.1, 0xffffff, 10, { roughness: 0.3 }), )
    const e = g.children[g.children.length - 1]
    e.position.set(s * 0.17, 0.5, 0.24)
    g.add(sph(0.05, 0x141414, 8, { roughness: 0.2 }))
    const p = g.children[g.children.length - 1]
    p.position.set(s * 0.17, 0.52, 0.32)
    g.add(box(0.14, 0.1, 0.2, 0x2f8a30), )
    const leg = g.children[g.children.length - 1]
    leg.position.set(s * 0.3, 0.1, -0.12)
  }
  return g
}

function makeStamp() {
  const g = new THREE.Group()
  g.add(box(1.4, 0.9, 1.4, 0x8a1f1f, { metalness: 0.35, roughness: 0.5 }), )
  g.children[0].position.y = 0.45
  g.add(cyl(0.1, 0.1, 1.0, 0x2a1a10, 10, { metalness: 0.5 }))
  g.children[1].position.y = 1.3
  g.add(box(1.7, 0.14, 1.7, 0x5c1010, { metalness: 0.4 }))
  g.children[2].position.y = 0.07
  const disc = mesh(new THREE.CircleGeometry(0.6, 24), glow(0xffe08a, 0.8), [0, 0.93, 0], [-Math.PI / 2, 0, 0])
  g.add(disc)
  g.userData.disc = disc
  return g
}

function makeCrates(n = 9) {
  const g = new THREE.Group()
  for (let i = 0; i < n; i++) {
    const size = 0.4 + Math.random() * 0.22
    const c = box(size, size, size, 0xa8743a, { roughness: 0.8 })
    const label = box(size * 0.6, size * 0.34, 0.02, 0xc8102e, { roughness: 0.7 })
    label.position.z = size / 2 + 0.01
    c.add(label)
    g.add(c)
  }
  return g
}

function makeBulldozer() {
  const g = new THREE.Group()
  const body = box(2.2, 0.9, 1.3, 0xf0a020, { metalness: 0.3, roughness: 0.55 })
  body.position.y = 0.8
  g.add(body)
  const cab = box(1.0, 0.8, 1.1, 0x2a2a2a, { metalness: 0.5, roughness: 0.4 })
  cab.position.set(-0.3, 1.6, 0)
  g.add(cab)
  const glass = box(0.8, 0.5, 1.14, 0x9fd4ff, { metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.55 })
  glass.position.set(-0.3, 1.7, 0)
  g.add(glass)
  for (const s of [-1, 1]) {
    for (const z of [-0.6, 0.6]) {
      const w = cyl(0.42, 0.42, 0.26, 0x141414, 14, { roughness: 0.95 })
      w.rotation.x = Math.PI / 2
      w.position.set(s * 0.75, 0.42, z)
      g.add(w)
      const hub = cyl(0.16, 0.16, 0.3, 0x666a6e, 10, { metalness: 0.7 })
      hub.rotation.x = Math.PI / 2
      hub.position.set(s * 0.75, 0.42, z)
      g.add(hub)
    }
  }
  const arm = new THREE.Group()
  arm.position.set(1.0, 1.0, 0)
  arm.add(box(0.7, 0.16, 0.16, 0x6a6f74, { metalness: 0.7 }))
  arm.children[0].position.set(0.35, 0, -0.5)
  const arm2 = arm.children[0].clone()
  arm2.position.z = 0.5
  arm.add(arm2)
  const bucket = new THREE.Group()
  bucket.position.set(0.8, -0.1, 0)
  bucket.add(box(0.7, 0.7, 1.5, 0x9aa2aa, { metalness: 0.7, roughness: 0.35 }))
  bucket.children[0].position.set(0.15, -0.3, 0)
  const teeth = box(0.5, 0.1, 1.5, 0x6f757c, { metalness: 0.8 })
  teeth.position.set(0.5, -0.62, 0)
  bucket.add(teeth)
  arm.add(bucket)
  g.add(arm)
  const exhaust = cyl(0.07, 0.09, 0.6, 0x3a3a3a, 8, { metalness: 0.6 })
  exhaust.position.set(-0.75, 2.1, -0.35)
  g.add(exhaust)
  g.userData = { arm, bucket }
  return g
}

function makePothole() {
  const g = new THREE.Group()
  const hole = mesh(new THREE.CircleGeometry(1.15, 28), new THREE.MeshBasicMaterial({ color: 0x05040a }), [0, 0.02, 0], [-Math.PI / 2, 0, 0])
  g.add(hole)
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 28), basic(0x3a2a1e, { roughness: 1 }))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.03
  g.add(rim)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const slab = box(0.5 + Math.random() * 0.3, 0.1, 0.3, 0x6a5a44, { roughness: 1 })
    slab.position.set(Math.cos(a) * 1.35, 0.06, Math.sin(a) * 1.35)
    slab.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.4)
    g.add(slab)
  }
  const dark = mesh(new THREE.CylinderGeometry(1.05, 0.7, 0.9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x080610, side: THREE.DoubleSide }), [0, -0.42, 0])
  g.add(dark)
  return g
}

function makeGoldBar() {
  const g = new THREE.Group()
  const bar = box(0.36, 0.13, 0.2, 0xffd24a, { metalness: 0.95, roughness: 0.18 })
  g.add(bar)
  const face = mesh(new THREE.PlaneGeometry(0.24, 0.07), glow(0xfff0a0, 0.9), [0, 0.07, 0.101])
  g.add(face)
  return g
}

function makeFlame(scale = 1) {
  const g = new THREE.Group()
  const outer = mesh(new THREE.ConeGeometry(0.42 * scale, 1.3 * scale, 14), glow(0xff7a00, 2.4))
  g.add(outer)
  const inner = mesh(new THREE.ConeGeometry(0.24 * scale, 0.85 * scale, 12), glow(0xffe08a, 2.8))
  g.add(inner)
  const light = new THREE.PointLight(0xff8a22, 3 * scale, 9)
  light.position.y = 0.7 * scale
  g.add(light)
  g.userData.outer = outer
  g.userData.inner = inner
  return g
}

function makeEnergyBeam(color = 0xffd27a) {
  const g = new THREE.Group()
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 20, 14, 1, true), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.42, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  outer.position.y = 10
  g.add(outer)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 20, 10, 1, true), new THREE.MeshBasicMaterial({
    color: 0xfff6d8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  inner.position.y = 10
  g.add(inner)
  g.userData.outer = outer
  g.userData.inner = inner
  return g
}

// ------------------------------------------------------------- directors ----

function buildDirector(charId, ctx) {
  const { casterX, targetX, dir } = ctx
  const root = new THREE.Group()
  ctx.scene.add(root)
  const cues = []
  const at = (t, fn) => cues.push({ t, fn, fired: false })
  const props = []
  const add = (m) => { root.add(m); props.push(m); return m }

  let cameraAt = (t) => ({ pos: new THREE.Vector3(casterX - dir * 3.4, 3.4, 7.6), look: new THREE.Vector3(casterX, 1.4, 0), fov: 46 })
  let poseCaster = (t) => ({ anim: 'charge', y: 0, x: casterX })
  let poseTarget = (t) => ({ state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true })
  let updateProps = (dt, t) => {}
  let onEnd = () => {}

  switch (charId) {
    // ---------------------------------------------------------------- MODI
    case 'modi': {
      const chakra = add(makeChakra())
      chakra.visible = false
      const ignition = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.35, depthWrite: false })))
      ignition.position.set(casterX, 2.6, 0)
      ignition.visible = false

      const track = cameraTrack([
        { t: 0.0, pos: [casterX - dir * 3.4, 3.4, 7.6], look: [casterX, 1.4, 0], fov: 46 },
        { t: 1.1, pos: [casterX - dir * 2.4, 4.6, 6.0], look: [casterX, 3.4, 0], fov: 44 },
        { t: 1.7, pos: [casterX + dir * 1.4, 5.0, 4.4], look: [casterX, 5.2, 0], fov: 38 },
        { t: 2.4, pos: [casterX + dir * 1.0, 4.4, 5.0], look: [lerp(casterX, targetX, 0.45), 3.4, 0], fov: 42 },
        { t: 3.0, pos: [targetX - dir * 1.2, 3.2, 6.2], look: [targetX, 2.2, 0], fov: 44 },
        { t: 3.5, pos: [targetX + dir * 0.4, 2.4, 5.2], look: [targetX, 1.6, 0], fov: 48 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.4) - dir * 2.0, 3.6, 9.4], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        if (t < 1.15) return { anim: 'charge', y: ease(seg(t, 0.1, 1.15)) * 2.9, x: casterX }
        if (t < 2.05) return { anim: 'pointUp', y: 2.9 + Math.sin(t * 3) * 0.05, x: casterX }
        if (t < 2.62) return { anim: 'pointAt', y: 2.9 + Math.sin(t * 3) * 0.05, x: casterX }
        if (t < 3.45) return { anim: 'throw', y: 2.9 - ease(seg(t, 2.9, 3.45)) * 0.7, x: casterX }
        return { anim: 'throw', y: ease(seg(t, 3.5, 4.5)) * -2.4 + 2.2, x: casterX, land: t > 4.45 }
      }
      poseTarget = (t) => {
        if (t < 3.42) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true }
        const k = seg(t, 3.42, 4.6)
        return {
          state: 'knockdown', stateTime: t - 3.42, x: targetX + dir * ease(k) * 1.1,
          y: Math.sin(clamp01(k) * Math.PI) * 1.1, visible: true,
        }
      }

      at(0.18, () => { ignition.visible = true; ctx.audio.play('charge') })
      at(1.15, () => { chakra.visible = true; ignition.visible = false; ctx.audio.play('confirm') })
      at(2.05, () => ctx.audio.play('whoosh'))
      at(2.62, () => { ctx.audio.play('chakra'); ctx.onShake(0.25) })
      at(3.42, () => {
        ctx.audio.play('boom')
        ctx.onFlash('#fff2c0', 320)
        ctx.onShake(0.8)
        ctx.fx.burst(new THREE.Vector3(targetX, 1.8, 0), 'gold', 46, 7)
        ctx.fx.ring(new THREE.Vector3(targetX, 1.4, 0), 0xffa020)
        ctx.fx.ring(new THREE.Vector3(targetX, 1.4, 0), 0xfff0a0)
      })
      at(4.1, () => ctx.fx.burst(new THREE.Vector3(casterX, 0.4, 0), 'blue', 18, 3))

      updateProps = (dt, t) => {
        ignition.visible = t < 1.15 && t > 0.18
        ignition.scale.setScalar(0.6 + Math.sin(t * 12) * 0.12 + t * 0.5)
        ignition.material.opacity = 0.3 + Math.sin(t * 14) * 0.1
        chakra.visible = t >= 1.15 && t < 3.45
        if (chakra.visible) {
          chakra.rotation.z += dt * (6 + t * 5)
          chakra.rotation.y = Math.sin(t * 8) * 0.12
          const grow = ease(seg(t, 1.15, 1.6))
          chakra.scale.setScalar(0.35 + grow * 0.95)
          if (t < 2.05) {
            // lock onto the raised fingertip
            ctx.fingerWorld(0, chakra.position)
            chakra.position.y = Math.max(chakra.position.y, 3.4)
          } else if (t < 2.62) {
            // slide down the pointing arm toward the opponent
            ctx.fingerWorld(0, chakra.position)
          } else {
            const k = ease(seg(t, 2.62, 3.42))
            chakra.position.set(lerp(casterX, targetX, k), lerp(3.2, 2.0, k) + Math.sin(k * Math.PI) * 0.6, 0)
            chakra.scale.setScalar(1.3 + k * 0.5)
          }
        }
      }
      cameraAt = track
      break
    }

    // --------------------------------------------------------------- RAHUL
    case 'rahul': {
      const potato = add(makePotato()); potato.visible = false
      const machine = add(makeMachine())
      machine.position.set(targetX + dir * 2.0, 0, -0.5)
      machine.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2
      // The beam is parented to the machine so it erupts from the chimney.
      const beam = makeEnergyBeam(0xffe08a)
      machine.add(beam)
      beam.position.set(-0.5, 12.3, -0.3)
      beam.visible = false
      const poof = add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false })))
      poof.position.set(targetX, 1.1, 0)
      const bars = []
      for (let i = 0; i < 18; i++) {
        const bar = add(makeGoldBar())
        bar.visible = false
        bar.userData = { state: 'hidden', vx: 0, vy: 0, vz: 0, spin: 3 + Math.random() * 7 }
        bars.push(bar)
      }
      // chute mouth in world space (machine is rotated, so ask it)
      const chuteWorld = new THREE.Vector3(0.5, 1.15, 0)
      const machineX = machine.position.x

      const track = cameraTrack([
        { t: 0.0, pos: [targetX - dir * 2.2, 2.4, 5.6], look: [targetX, 1.7, 0], fov: 44 },
        { t: 0.6, pos: [targetX - dir * 0.6, 2.1, 3.6], look: [targetX, 1.6, 0], fov: 36 },
        { t: 1.4, pos: [targetX + dir * 0.8, 2.0, 4.6], look: [targetX, 1.1, 0], fov: 40 },
        { t: 2.3, pos: [machineX - dir * 1.6, 2.4, 5.0], look: [machineX, 1.3, -0.4], fov: 42 },
        { t: 3.0, pos: [machineX + dir * 3.2, 3.4, 6.4], look: [machineX + dir * 1.4, 3.0, -0.4], fov: 46 },
        { t: 3.7, pos: [lerp(machineX, targetX, 0.5) + dir * 2.0, 5.2, 9.6], look: [targetX, 2.6, 0], fov: 52 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        const walkTo = (k) => lerp(casterX, machineX - dir * 1.5, ease(k))
        if (t < 0.6) return { anim: 'punchHead', y: 0, x: lerp(casterX, targetX - dir * 1.1, ease(seg(t, 0, 0.6))) }
        if (t < 1.2) return { anim: 'charge', y: 0, x: targetX - dir * 1.1 }
        if (t < 2.05) return { anim: 'carry', y: 0, x: walkTo(seg(t, 1.2, 2.05)) }
        if (t < 2.75) return { anim: 'feed', y: 0, x: machineX - dir * 1.5 }
        if (t < 3.9) return { anim: 'admire', y: 0, x: machineX - dir * 1.5 }
        return { anim: 'admire', y: 0, x: lerp(machineX - dir * 1.5, casterX, ease(seg(t, 3.9, 4.6))) }
      }
      poseTarget = (t) => {
        if (t < 0.62) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true }
        if (t < 4.32) return { state: 'frozen', stateTime: t - 0.62, x: targetX, y: 0, visible: false }
        return { state: 'frozen', stateTime: 0, x: targetX, y: 0, visible: true, transform: 'aloo' }
      }

      at(0.5, () => { ctx.audio.play('hit'); ctx.onFlash('#ffffff', 140); ctx.onShake(0.3); ctx.fx.burst(new THREE.Vector3(targetX, 1.7, 0), 'gold', 20, 4) })
      at(0.62, () => { potato.visible = true; potato.position.set(targetX, 1.1, 0); ctx.audio.play('poof') })
      at(1.2, () => ctx.audio.play('confirm'))
      at(2.05, () => { potato.visible = false; ctx.audio.play('metal_crunch') })
      at(2.6, () => {
        beam.visible = true
        ctx.audio.play('thunder')
        ctx.onFlash('#ffe8a8', 130)
        ctx.onShake(0.35)
        ctx.fx.burst(new THREE.Vector3(machineX, 1.4, -0.5), 'gold', 30, 5)
      })
      at(3.1, () => {
        machine.updateMatrixWorld(true)
        machine.localToWorld(chuteWorld.set(0.5, 1.15, 0))
        bars.forEach((b, i) => {
          b.visible = true
          b.userData.state = 'up'
          b.userData.vy = 7.5 + Math.random() * 4
          // fan the launch across the arena so the gold rains over the stage
          const spread = (i / (bars.length - 1) - 0.5) * 2
          b.userData.vx = (targetX - chuteWorld.x) * 0.45 + spread * 2.4 + (Math.random() - 0.5) * 0.8
          b.userData.vz = (Math.random() - 0.5) * 2.6
          b.position.copy(chuteWorld)
          b.position.y += Math.random() * 0.3
          b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        })
        ctx.audio.play('coins')
      })
      at(4.32, () => { poof.material.opacity = 0.7; poof.scale.setScalar(0.3); ctx.audio.play('poof'); ctx.fx.burst(new THREE.Vector3(targetX, 1.2, 0), 'blue', 24, 4) })

      updateProps = (dt, t) => {
        machine.userData.needle.rotation.z = Math.sin(t * 9) * 1.1
        machine.userData.lamp.material.emissiveIntensity = t > 2.4 ? 1.4 + Math.sin(t * 18) * 1.2 : 0.4
        if (potato.visible) {
          potato.rotation.y += dt * 1.4
          potato.position.x = lerp(targetX, machineX - dir * 1.2, ease(seg(t, 1.2, 2.05)))
          potato.position.y = 1.0 + Math.abs(Math.sin(t * 4)) * 0.12
        }
        if (beam.visible) {
          const grow = ease(seg(t, 2.6, 3.0))
          beam.scale.set(0.4 + grow * 0.6, grow, 0.4 + grow * 0.6)
          const flick = 0.5 + Math.sin(t * 22) * 0.18
          const fade = t < 3.7 ? 1 : 1 - seg(t, 3.7, 4.1)
          beam.userData.outer.material.opacity = 0.42 * flick * fade
          beam.userData.inner.material.opacity = 0.55 * flick * fade
          beam.rotation.y += dt * 3
        }
        for (const b of bars) {
          if (!b.visible) continue
          const u = b.userData
          if (u.state === 'up' || u.state === 'down') {
            // simple ballistics: launched from the chute, arcing over the stage
            u.vy -= (u.state === 'up' ? 11 : 17) * dt
            b.position.x += u.vx * dt
            b.position.y += u.vy * dt
            b.position.z += u.vz * dt
            b.rotation.x += dt * u.spin
            b.rotation.z += dt * u.spin * 0.7
            if (u.state === 'up' && u.vy <= 0) u.state = 'down'
            if (u.state === 'down' && b.position.y <= 0.12) {
              b.position.y = 0.12
              u.state = 'landed'
              ctx.fx.ring(new THREE.Vector3(b.position.x, 0.05, b.position.z), 0xffd24a)
              ctx.audio.play('kaching')
            }
          }
        }
        if (poof.material.opacity > 0) {
          poof.scale.addScalar(dt * 1.4)
          poof.material.opacity = Math.max(0, poof.material.opacity - dt * 1.1)
        }
      }
      cameraAt = track
      break
    }

    // ---------------------------------------------------------------- DIDI
    case 'didi': {
      const pot = add(makeCauldron())
      pot.position.set(targetX - dir * 1.6, 0, -0.4)
      const frog = add(makeFrog()); frog.visible = false
      const chant = add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.6 })))
      chant.rotation.x = Math.PI / 2
      chant.position.set(targetX, 0.6, 0)
      chant.visible = false

      const track = cameraTrack([
        { t: 0.0, pos: [targetX - dir * 3.0, 3.0, 7.0], look: [targetX, 1.4, 0], fov: 46 },
        { t: 0.9, pos: [pot.position.x + dir * 2.0, 2.2, 4.6], look: [pot.position.x, 1.1, -0.4], fov: 40 },
        { t: 1.8, pos: [pot.position.x + dir * 0.6, 2.6, 4.4], look: [pot.position.x, 1.3, -0.4], fov: 38 },
        { t: 2.6, pos: [targetX - dir * 1.4, 2.4, 5.0], look: [targetX, 1.4, 0], fov: 42 },
        { t: 3.4, pos: [targetX + dir * 1.0, 2.2, 4.4], look: [targetX, 1.2, 0], fov: 44 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        const x = lerp(casterX, pot.position.x + dir * 0.9, ease(seg(t, 0.5, 1.2)))
        if (t < 0.6) return { anim: 'chant', y: 0, x: casterX }
        if (t < 2.2) return { anim: 'stir', y: 0, x }
        if (t < 3.4) return { anim: 'chant', y: 0, x }
        if (t < 4.0) return { anim: 'stomp', y: 0, x }
        return { anim: 'chant', y: 0, x: lerp(x, casterX, ease(seg(t, 4.0, 4.6))) }
      }
      poseTarget = (t) => {
        if (t < 2.15) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true }
        if (t < 4.25) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: false }
        return { state: 'frozen', stateTime: 0, x: targetX, y: 0, visible: true, transform: 'croak' }
      }

      at(0.35, () => { ctx.audio.play('poof'); ctx.onShake(0.2) })
      at(0.9, () => ctx.audio.play('confirm'))
      at(2.15, () => { frog.visible = true; frog.position.set(targetX, 0, 0); ctx.audio.play('poof'); ctx.onFlash('#b6ff8a', 160) })
      at(3.0, () => { ctx.fx.burst(new THREE.Vector3(targetX, 0.6, 0), 'blue', 18, 3); ctx.audio.play('moo') })
      at(3.5, () => { frog.visible = false; ctx.audio.play('boom'); ctx.onShake(0.6); ctx.onFlash('#d6ffb6', 180); ctx.fx.burst(new THREE.Vector3(targetX, 1.4, 0), 'blue', 34, 5) })
      at(4.25, () => { frog.visible = false; ctx.audio.play('poof'); ctx.onFlash('#e8ffd6', 160); ctx.fx.burst(new THREE.Vector3(targetX, 1.2, 0), 'blue', 26, 4) })

      updateProps = (dt, t) => {
        pot.userData.brew.material.emissiveIntensity = 1 + Math.sin(t * 10) * 0.5
        pot.userData.ladle.rotation.z = -0.5 + Math.sin(t * 5) * 0.4
        pot.userData.ladle.rotation.y += dt * 4
        for (const b of pot.userData.bubbles) {
          b.m.position.y = 0.8 + ((t * 0.5 + b.o) % 1) * 0.8
          b.m.material.opacity = 1 - ((t * 0.5 + b.o) % 1)
        }
        chant.visible = t > 0.5 && t < 3.4
        if (chant.visible) {
          chant.rotation.z += dt * 1.6
          chant.scale.setScalar(0.6 + Math.sin(t * 3) * 0.18 + seg(t, 0.5, 3.4) * 0.7)
          chant.material.opacity = 0.5 + Math.sin(t * 6) * 0.2
        }
        if (frog.visible) {
          frog.position.x = targetX + Math.sin(t * 3.2) * 1.4
          frog.position.y = Math.abs(Math.sin(t * 7)) * 0.55
          frog.rotation.y = Math.sin(t * 3.2) * 0.8
        }
        pot.scale.setScalar(0.7 + ease(seg(t, 0.35, 0.9)) * 0.3)
        pot.position.y = -0.4 + ease(seg(t, 0.35, 0.9)) * 0.4
      }
      cameraAt = track
      break
    }

    // -------------------------------------------------------------- TRUMP
    case 'trump': {
      const order = add(box(0.5, 0.02, 0.7, 0xf5e6c0, { roughness: 0.7 }))
      const sign = add(box(0.7, 0.1, 0.9, 0xffd24a, { metalness: 0.8, roughness: 0.25 }))
      const crates = add(makeCrates(10))
      const stack = add(makeCrates(7))
      const stamp = add(makeStamp())
      stamp.position.set(targetX, 7.5, 0)
      stamp.visible = false
      const confetti = []
      for (let i = 0; i < 22; i++) {
        const c = add(box(0.1, 0.1, 0.02, [0xc8102e, 0x0a3161, 0xffd24a][i % 3], { roughness: 0.6 }))
        c.visible = false
        confetti.push(c)
      }

      const track = cameraTrack([
        { t: 0.0, pos: [targetX - dir * 2.6, 2.6, 6.2], look: [targetX, 1.5, 0], fov: 44 },
        { t: 0.8, pos: [casterX + dir * 1.0, 2.2, 4.6], look: [casterX, 1.5, 0], fov: 40 },
        { t: 1.7, pos: [lerp(casterX, targetX, 0.5), 3.4, 7.0], look: [lerp(casterX, targetX, 0.5), 2.4, 0], fov: 46 },
        { t: 2.7, pos: [targetX - dir * 2.0, 3.0, 5.4], look: [targetX, 1.8, 0], fov: 44 },
        { t: 3.2, pos: [targetX, 4.6, 4.8], look: [targetX, 1.0, 0], fov: 50 },
        { t: 3.9, pos: [targetX + dir * 1.2, 4.2, 6.4], look: [targetX, 1.6, 0], fov: 46 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        if (t < 1.0) return { anim: 'sign', y: 0, x: casterX }
        if (t < 1.7) return { anim: 'whirl', y: 0, x: casterX }
        if (t < 3.0) return { anim: 'whirl', y: 0, x: lerp(casterX, targetX - dir * 1.6, ease(seg(t, 1.7, 3.0))) }
        if (t < 3.6) return { anim: 'slam', y: 0, x: targetX - dir * 1.6 }
        return { anim: 'admire', y: 0, x: lerp(targetX - dir * 1.6, casterX, ease(seg(t, 3.7, 4.6))) }
      }
      poseTarget = (t) => {
        if (t < 2.6) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true }
        if (t < 4.3) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: false }
        return { state: 'frozen', stateTime: 0, x: targetX, y: 0, visible: true, transform: 'flat' }
      }

      at(0.3, () => ctx.audio.play('confirm'))
      at(1.0, () => { ctx.audio.play('whoosh'); ctx.onShake(0.3) })
      at(1.7, () => { crates.visible = true; ctx.audio.play('crate_crash') })
      at(2.6, () => { stamp.visible = true; stack.visible = true; ctx.audio.play('whoosh') })
      at(3.15, () => { ctx.audio.play('stamp_slam'); ctx.onShake(0.9); ctx.onFlash('#ffe8b0', 150); ctx.fx.burst(new THREE.Vector3(targetX, 0.6, 0), 'gold', 30, 5); ctx.fx.ring(new THREE.Vector3(targetX, 0.2, 0), 0xffd24a) })
      at(3.6, () => { confetti.forEach((c) => { c.visible = true; c.position.set(targetX + (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 3) }); ctx.audio.play('coins') })

      updateProps = (dt, t) => {
        order.visible = t < 1.4
        sign.visible = t < 1.05
        if (order.visible) { order.position.set(casterX + dir * 0.4, 1.5, 0.4); order.rotation.set(-0.4, dir * 0.5, 0) }
        if (sign.visible) { sign.position.set(casterX + dir * 0.4, 1.6, 0.4); sign.rotation.set(-0.4, dir * 0.5, 0); sign.rotation.z += dt * 3 }
        crates.visible = t > 1.7 && t < 3.3
        if (crates.visible) {
          const k = seg(t, 1.7, 3.2)
          crates.children.forEach((c, i) => {
            const a = (i / crates.children.length) * Math.PI * 2 + t * 3.4
            const r = 2.6 - k * 1.4
            c.position.set(targetX + Math.cos(a) * r, 1.2 + Math.sin(a * 2 + t * 4) * 1.1 + (1 - k) * 1.4, Math.sin(a) * r)
            c.rotation.x += dt * 2.4
            c.rotation.y += dt * 1.9
          })
        }
        if (stamp.visible) {
          const k = ease(seg(t, 2.6, 3.15))
          stamp.position.y = lerp(7.5, 0.0, k)
          stamp.rotation.y = Math.sin(t * 4) * 0.1
          if (t > 3.6) {
            const up = ease(seg(t, 3.6, 4.3))
            stamp.position.y = up * 5
            stack.visible = up < 0.9
            stack.scale.setScalar(Math.max(0.05, 1 - up))
          }
        }
        stack.visible = t > 2.6 && t < 4.3
        if (stack.visible) {
          stack.children.forEach((c, i) => {
            c.position.set(targetX + ((i % 3) - 1) * 0.5, 0.3 + Math.floor(i / 3) * 0.5, (i % 2) * 0.4 - 0.2)
            c.rotation.set(0, i * 0.4, 0)
          })
        }
        for (const c of confetti) {
          if (!c.visible) continue
          c.position.y -= dt * 3.4
          c.rotation.x += dt * 5
          c.rotation.z += dt * 4
          if (c.position.y < 0.1) { c.position.y = 0.1; c.visible = t < 4.3 }
        }
      }
      cameraAt = track
      break
    }

    // --------------------------------------------------------------- YOGI
    case 'yogi': {
      const dozer = add(makeBulldozer())
      dozer.rotation.y = Math.PI
      const pool = add(mesh(new THREE.CircleGeometry(1.3, 30), new THREE.MeshBasicMaterial({ color: 0x8a0a0a, transparent: true, opacity: 0 }), [targetX, 0.04, 0], [-Math.PI / 2, 0, 0]))

      const track = cameraTrack([
        { t: 0.0, pos: [targetX - dir * 3.0, 2.6, 6.6], look: [casterX, 1.7, 0], fov: 46 },
        { t: 0.9, pos: [casterX - dir * 1.6, 2.4, 5.0], look: [casterX, 1.6, 0], fov: 40 },
        { t: 1.9, pos: [targetX - dir * 5.0, 3.0, 6.6], look: [targetX - dir * 3.0, 1.4, 0], fov: 48 },
        { t: 2.6, pos: [targetX - dir * 1.4, 3.4, 6.2], look: [targetX, 1.4, 0], fov: 46 },
        { t: 3.6, pos: [targetX + dir * 1.4, 3.0, 5.6], look: [targetX, 1.2, 0], fov: 48 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        if (t < 1.0) return { anim: 'glare', y: 0, x: casterX }
        if (t < 1.9) return { anim: 'beckon', y: 0, x: casterX }
        return { anim: 'bow', y: 0, x: lerp(casterX, targetX - dir * 1.7, ease(seg(t, 2.0, 2.6))) }
      }
      poseTarget = (t) => {
        if (t < 3.4) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true }
        if (t < 4.3) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: false }
        return { state: 'frozen', stateTime: 0, x: targetX, y: 0, visible: true, transform: 'flat' }
      }

      at(0.2, () => { ctx.audio.play('horn'); ctx.onShake(0.3) })
      at(1.0, () => { ctx.audio.play('engine'); dozer.visible = true; dozer.position.set(targetX - dir * 13, 0, -1.4) })
      at(3.4, () => { pool.material.opacity = 0.85; ctx.audio.play('metal_crunch'); ctx.onShake(0.9); ctx.onFlash('#ffb0a0', 150); ctx.fx.burst(new THREE.Vector3(targetX, 0.8, 0), 'red', 34, 5) })
      at(4.3, () => { ctx.fx.burst(new THREE.Vector3(targetX, 1.2, 0), 'blue', 20, 3) })

      updateProps = (dt, t) => {
        // bring the dozer in, slam the bucket three times, back out
        const inK = ease(seg(t, 1.0, 2.0))
        const outK = ease(seg(t, 3.9, 4.6))
        dozer.visible = t > 1.0 && t < 4.6
        if (dozer.visible) {
          dozer.position.x = lerp(targetX - dir * 13, targetX - dir * 2.4, inK) - dir * outK * 13
          const slamT = (t - 2.05) % 0.62
          const lifting = t >= 2.05 && t < 3.5
          dozer.userData.bucket.rotation.z = lifting ? -0.15 - Math.max(0, -Math.cos(slamT * 10.1)) * 1.15 : -0.15
          dozer.userData.arm.rotation.z = lifting ? Math.max(0, -Math.cos(slamT * 10.1)) * 0.3 : 0
          dozer.position.y = Math.abs(Math.sin(t * 14)) * 0.04
        }
        if (pool.material.opacity > 0) pool.material.opacity = Math.max(0.25, pool.material.opacity - dt * 0.12)
      }
      cameraAt = track
      break
    }

    // --------------------------------------------------------------- NITIN
    case 'nitin': {
      const hole = add(makePothole())
      hole.position.set(targetX, 0, 0)
      hole.visible = false
      const machine = add(makeMachine())
      machine.position.set(casterX + dir * 1.7, 0, -0.9)
      machine.scale.setScalar(0.72)
      const flame = add(makeFlame(1.5))
      flame.position.set(targetX, 1.0, 0)
      flame.visible = false
      const smoke = add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.4 })))
      smoke.position.set(targetX, 1.4, 0)
      smoke.visible = false
      const cane = add(new THREE.Group())
      cane.visible = false
      for (let i = 0; i < 3; i++) cane.add(cyl(0.05, 0.05, 1.4, 0x6a9a3a, 8, {}))
      cane.children.forEach((c, i) => { c.position.set(i * 0.14 - 0.14, 0.7, 0); c.rotation.z = 0.12 * (i - 1) })
      const matchStick = add(cyl(0.02, 0.02, 0.22, 0xd8c090, 6))
      const matchFlame = add(makeFlame(0.4))
      matchFlame.visible = false

      const track = cameraTrack([
        { t: 0.0, pos: [targetX - dir * 2.4, 3.4, 7.0], look: [targetX, 0.6, 0], fov: 46 },
        { t: 1.0, pos: [casterX + dir * 1.0, 2.4, 5.2], look: [casterX, 1.3, -0.4], fov: 42 },
        { t: 2.0, pos: [casterX + dir * 0.4, 2.6, 5.4], look: [casterX, 1.2, -0.4], fov: 42 },
        { t: 2.8, pos: [targetX - dir * 2.2, 2.8, 5.6], look: [targetX, 1.0, 0], fov: 44 },
        { t: 3.4, pos: [targetX - dir * 3.6, 2.6, 6.6], look: [targetX, 1.4, 0], fov: 46 },
        { t: 3.9, pos: [targetX + dir * 1.2, 3.4, 6.0], look: [targetX, 1.6, 0], fov: 52 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])

      poseCaster = (t) => {
        if (t < 0.9) return { anim: 'charge', y: 0, x: casterX }
        if (t < 1.8) return { anim: 'feedCane', y: 0, x: lerp(casterX, machine.position.x - dir * 0.8, ease(seg(t, 0.9, 1.4))) }
        if (t < 2.6) return { anim: 'pour', y: 0, x: lerp(machine.position.x - dir * 0.8, targetX - dir * 1.3, ease(seg(t, 1.8, 2.4))) }
        if (t < 3.3) return { anim: 'flick', y: 0, x: targetX - dir * 1.3 }
        return { anim: 'walkOff', y: 0, x: lerp(targetX - dir * 1.3, casterX - dir * 2.4, ease(seg(t, 3.3, 4.6))) }
      }
      poseTarget = (t) => {
        if (t < 3.45) return { state: 'frozen', stateTime: t, x: targetX, y: -ease(seg(t, 0.2, 1.0)) * 0.4, visible: true, transform: t > 0.4 ? 'croak' : undefined }
        if (t < 4.3) return { state: 'frozen', stateTime: t, x: targetX, y: 0, visible: false }
        return { state: 'frozen', stateTime: 0, x: targetX, y: 0, visible: true, transform: 'flat' }
      }

      at(0.3, () => { hole.visible = true; ctx.audio.play('crate_crash'); ctx.onShake(0.5) })
      at(1.0, () => { cane.visible = true; ctx.audio.play('engine') })
      at(1.8, () => { cane.visible = false; ctx.audio.play('kaching') })
      at(2.6, () => { matchStick.visible = true; matchStick.position.set(targetX - dir * 1.1, 1.4, 0.4); ctx.audio.play('whoosh') })
      at(3.1, () => { matchFlame.visible = true; matchFlame.position.copy(matchStick.position).y += 0.16; ctx.audio.play('tick') })
      at(3.45, () => {
        matchStick.visible = false; matchFlame.visible = false
        flame.visible = true
        smoke.visible = true
        ctx.audio.play('boom')
        ctx.onFlash('#ffd8a0', 300)
        ctx.onShake(1.0)
        ctx.fx.burst(new THREE.Vector3(targetX, 1.0, 0), 'red', 44, 7)
        ctx.fx.ring(new THREE.Vector3(targetX, 0.3, 0), 0xff7a00)
      })

      updateProps = (dt, t) => {
        if (hole.visible) {
          const k = ease(seg(t, 0.3, 1.1))
          hole.scale.setScalar(0.2 + k * 0.8)
        }
        if (flame.visible) {
          const s = 1.4 + Math.sin(t * 16) * 0.35 + seg(t, 3.45, 4.3) * 1.6
          flame.scale.set(s, s * (1 + Math.sin(t * 20) * 0.2), s)
          flame.rotation.y += dt * 3
          flame.position.y = 1.0 + Math.sin(t * 12) * 0.2
        }
        if (smoke.visible) {
          smoke.scale.addScalar(dt * 1.1)
          smoke.material.opacity = Math.max(0, 0.55 - seg(t, 3.45, 4.6) * 0.55)
          smoke.position.y += dt * 0.7
        }
        if (matchFlame.visible) { matchFlame.scale.setScalar(0.8 + Math.sin(t * 24) * 0.2) }
        machine.rotation.y += dt * 1.2
        machine.position.y = Math.sin(t * 8) * 0.03
      }
      cameraAt = track
      break
    }

    default: {
      // Generic fallback: charge → impact
      const track = cameraTrack([
        { t: 0.0, pos: [casterX - dir * 3.0, 3.0, 7.0], look: [casterX, 1.5, 0], fov: 46 },
        { t: 2.0, pos: [targetX - dir * 1.0, 2.8, 6.0], look: [targetX, 1.6, 0], fov: 44 },
        { t: 4.6, pos: [lerp(casterX, targetX, 0.5), 3.4, 9.6], look: [lerp(casterX, targetX, 0.5), 1.6, 0], fov: 44 },
      ])
      poseCaster = (t) => ({ anim: t < 2.6 ? 'charge' : 'throw', y: 0, x: casterX })
      poseTarget = (t) => ({ state: 'frozen', stateTime: t, x: targetX, y: 0, visible: true })
      at(3.0, () => { ctx.audio.play('boom'); ctx.onShake(0.6) })
      cameraAt = track
    }
  }

  return { root, props, cues, cameraAt, poseCaster, poseTarget, updateProps, onEnd }
}

// --------------------------------------------------------------- sequence ----

export function createSuperSequence({ scene, rigs, side, charId, audio, fx, fighters, onShake, onFlash }) {
  const caster = rigs[side]
  const target = rigs[1 - side]
  const dir = side === 0 ? 1 : -1
  const casterX = fighters[side].x
  const targetX = fighters[1 - side].x
  let t = 0
  let done = false

  const camera = {
    position: new THREE.Vector3(casterX - dir * 3.4, 3.4, 7.6),
    lookAt: new THREE.Vector3(casterX, 1.4, 0),
    fov: 46,
  }

  const tmp = new THREE.Vector3()
  const ctx = {
    scene, rigs, dir, casterX, targetX, audio, fx,
    onShake: onShake || (() => {}),
    onFlash: onFlash || (() => {}),
    // world position of the caster's fingertip (used to anchor the chakra)
    fingerWorld: (rigIndex, out) => {
      const rig = rigIndex === 0 ? caster : target
      if (!rig || !rig.joints || !rig.joints.elbowR) { out.set(0, 3, 0); return out }
      rig.root.updateMatrixWorld(true)
      out.set(0, -0.19, 0.02)
      rig.joints.elbowR.localToWorld(out)
      return out
    },
  }

  const d = buildDirector(charId, ctx)

  function applyCasterPose(dt) {
    const p = d.poseCaster(t)
    caster.root.position.x = p.x
    caster.setFacing(dir)
    const cast = {
      state: 'super', stateTime: t, superAnim: p.anim, facing: dir,
      x: p.x, y: p.y, vx: 0, vy: 0, airborne: p.y > 0.02,
      blocking: false, ko: false, victory: false,
    }
    caster.update(cast, dt)
    if (p.land) {
      // settle back into the neutral idle before the engine releases us
      caster.update({ state: 'idle', stateTime: t - 4.45, facing: dir, x: p.x, y: 0, vx: 0, vy: 0, airborne: false, blocking: false, ko: false, victory: false }, dt)
    }
  }

  function applyTargetPose(dt) {
    const p = d.poseTarget(t)
    if (!p) return
    target.root.visible = p.visible !== false
    target.root.position.x = p.x
    target.setFacing(-dir)
    const tp = {
      state: p.state, stateTime: p.stateTime, transform: p.transform, facing: -dir,
      x: p.x, y: p.y, vx: 0, vy: 0, airborne: p.y > 0.05, blocking: false, ko: false, victory: false,
    }
    target.update(tp, dt)
  }

  function step(dt) {
    if (done) return true
    t = Math.min(DURATION, t + dt)
    // cues
    for (const c of d.cues) if (!c.fired && t >= c.t) { c.fired = true; c.fn() }
    // camera
    const c = d.cameraAt(t)
    camera.position.copy(c.pos)
    camera.lookAt.copy(c.look)
    camera.fov = c.fov
    // rigs
    applyCasterPose(dt)
    applyTargetPose(dt)
    // props that need rig world positions (chakra on the fingertip)
    d.updateProps(dt, t)
    if (t >= DURATION) { done = true; d.onEnd() }
    return done
  }

  function updateRig() { /* step() drives both rigs */ }

  function dispose() {
    if (caster) { caster.root.visible = true; caster.root.position.x = fighters[side].x }
    if (target) { target.root.visible = true; target.root.position.x = fighters[1 - side].x }
    scene.remove(d.root)
    d.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material.dispose()
      }
    })
  }

  return { step, done: () => done, camera, updateRig, dispose, get t() { return t } }
}
