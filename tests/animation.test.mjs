import assert from 'node:assert/strict'
import { createFighterRig } from '../src/game/fighters3d.js'
import { MOVES } from '../src/game/data.js'

const DT = 1 / 60
const ROT_JOINTS = ['hips', 'torso', 'chest', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'legR', 'kneeR']

function pose(id, frame, phase) {
  const def = MOVES[id]
  return {
    state: 'attack', attackId: id, phase, attackFrame: frame,
    startup: def.startup, active: def.active,
    crouching: !!def.crouching, facing: 1,
    x: 0, y: 0, vx: 0, vy: 0, airborne: false,
    blocking: false, ko: false, victory: false, hitHeight: 'mid',
  }
}
function idlePose() {
  return {
    state: 'idle', facing: 1, x: 0, y: 0, vx: 0, vy: 0,
    crouching: false, blocking: false, ko: false, victory: false, hitHeight: 'mid',
  }
}
function snapshot(rig) {
  const out = {}
  for (const k of ROT_JOINTS) {
    const j = rig.joints[k]
    if (j) out[k] = [j.rotation.x, j.rotation.y, j.rotation.z]
  }
  return out
}
/** Largest single-joint rotation change between two poses (all axes). */
function maxTravel(a, b) {
  let m = 0
  for (const k of Object.keys(b)) {
    const A = a[k] || [0, 0, 0]
    const B = b[k] || [0, 0, 0]
    m = Math.max(m, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]))
  }
  return m
}
const ax = (s, k) => (s[k] ? s[k][0] : 0)

/** Which joint does this attack extend, and to what angle at contact? */
const STRIKE_JOINT = {
  jab: ['armL', -1.55],
  cross: ['armR', -1.6],
  kick: ['legL', -1.55],
  uppercut: ['armR', -2.55],
  roundhouse: ['legR', -1.65],
  finisher: ['armL', -0.9],
  lowJab: ['armL', -1.45],
  skyUppercut: ['armR', -3.05],
  sweep: ['legR', -1.4],
  special1: ['armR', -2.65],
  special2: ['legR', -1.8],
  grab: ['armR', -1.55],
  airPunch: ['armR', -1.45],
  airKick: ['legL', -1.55],
}

for (const [id, [joint, target]] of Object.entries(STRIKE_JOINT)) {
  const rig = createFighterRig('modi')
  const def = MOVES[id]

  // (1) anticipation: the wind-up pose must be established before the strike
  for (let f = 0; f <= def.startup; f++) rig.update(pose(id, f, 'startup'), DT)
  const wind = snapshot(rig)

  // (2) contact: the strike limb reaches its authored extension, and it holds
  //     there through the hit-stop freeze so the eye reads a connected blow
  for (let f = def.startup + 1; f <= def.startup + def.active; f++) rig.update(pose(id, f, 'active'), DT)
  for (let i = 0; i < 8; i++) rig.update(pose(id, def.startup + def.active, 'active'), DT)
  const strike = snapshot(rig)

  // (3) recovery → neutral stance, nothing left stuck
  for (let f = def.startup + def.active + 1; f <= def.startup + def.active + def.recovery; f++) {
    rig.update(pose(id, f, 'recovery'), DT)
  }
  for (let i = 0; i < 14; i++) rig.update(idlePose(), DT)
  const settle = snapshot(rig)

  const sign = target < 0 ? -1 : 1
  assert.ok(sign * ax(strike, joint) >= sign * target - 0.18,
    `${id}: strike limb not extended at contact (${joint} ${ax(strike, joint).toFixed(2)}, want ${target})`)
  assert.ok(maxTravel(wind, strike) > 0.5,
    `${id}: attack does not visibly move (max joint travel ${maxTravel(wind, strike).toFixed(2)} rad)`)
  assert.ok(Math.abs(ax(settle, joint)) < 0.5,
    `${id}: limb stuck after recovery (${ax(settle, joint).toFixed(2)})`)

  rig.dispose()
}
console.log(`animation tests passed: anticipation → contact → settle for ${Object.keys(STRIKE_JOINT).length} attacks`)

// --- stance transitions must not pop (idle → walk → crouch → idle) ---
{
  const rig = createFighterRig('rahul')
  const base = { state: 'idle', facing: 1, x: 0, y: 0, vx: 0, vy: 0, blocking: false, ko: false, victory: false, hitHeight: 'mid' }
  const seq = [
    base, base,
    { ...base, state: 'walk', vx: 2.4 }, { ...base, state: 'walk', vx: 2.4 },
    { ...base, state: 'crouch', crouching: true }, { ...base, state: 'crouch', crouching: true },
    base, base, base,
  ]
  let prev = null
  let maxJump = 0
  for (const st of seq) {
    rig.update(st, DT)
    const snap = snapshot(rig)
    if (prev) maxJump = Math.max(maxJump, maxTravel(prev, snap))
    prev = snap
  }
  assert.ok(maxJump < 0.45, `stance transitions pop: ${maxJump.toFixed(3)} rad/frame`)
  rig.dispose()
  console.log(`animation tests: stance transitions smooth (max joint jump ${maxJump.toFixed(3)} rad/frame)`)

  // --- reactions: distinct poses for the three hit heights ---
  const r2 = createFighterRig('didi')
  const mk = (state, hitHeight) => ({ state, facing: 1, x: 0, y: 0, vx: 0, vy: 0, blocking: false, ko: false, victory: false, hitHeight, flash: false })
  const play = (state, hh) => {
    for (let i = 0; i < 24; i++) r2.update(idlePose(), DT)
    for (let i = 0; i < 8; i++) r2.update(mk(state, hh), DT)
    return snapshot(r2)
  }
  const high = play('hitstun', 'high')
  const low = play('stagger', 'low')
  const mid = play('hitstun', 'mid')
  assert.ok(Math.abs(ax(high, 'head') - ax(mid, 'head')) > 0.05, 'high hit must snap the head differently from mid')
  assert.ok(Math.abs(ax(low, 'kneeL') - ax(high, 'kneeL')) > 0.1, 'low hit must buckle the knees differently from high')
  r2.dispose()
  console.log('animation tests: reactions differ by impact height')
}
