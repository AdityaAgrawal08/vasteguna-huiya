import assert from 'node:assert/strict'
import {
  Match, Fighter, DT, makeInput, canHit, isBlocked, reactionClass,
  attackForwardVelocity, LUNGE_SCALE,
} from '../src/game/engine.js'
import { MOVES, CHARACTERS, ARENA_HALF_WIDTH } from '../src/game/data.js'

// --- 1. attack motion is defined by DISTANCE, not by frame count -------------
// Every move's forward motion integrates to exactly lunge*LUNGE_SCALE over its
// active window, so a 3-frame and a 5-frame attack travel proportionally and
// nothing "slides" an arbitrary amount.
for (const [id, def] of Object.entries(MOVES)) {
  let travel = 0
  for (let f = def.startup + 1; f <= def.startup + def.active; f++) {
    travel += attackForwardVelocity(def, f) * DT
  }
  const want = def.lunge * LUNGE_SCALE
  assert.ok(Math.abs(travel - want) < 0.02, `${id}: contact travel ${travel.toFixed(3)} != ${want.toFixed(3)}`)
  // anticipation must pull back slightly and never overshoot the contact distance
  let back = 0
  for (let f = 1; f <= def.startup; f++) back += attackForwardVelocity(def, f) * DT
  if (def.lunge > 0) {
    assert.ok(back < 0, `${id}: anticipation must load backwards, got ${back.toFixed(3)}`)
    assert.ok(Math.abs(back) < want * 0.5, `${id}: anticipation too large (${back.toFixed(3)} vs ${want.toFixed(3)})`)
  } else {
    assert.ok(Math.abs(back) < 1e-6, `${id}: no ground travel without a lunge`)
  }
}
console.log('combat tests: attack motion curve integrates correctly for', Object.keys(MOVES).length, 'moves')

// --- 2. every move maps to a sensible reaction tier -------------------------
const EXPECTED = {
  jab: 'light', cross: 'light', lowJab: 'light', airPunch: 'light',
  kick: 'medium', airKick: 'medium',
  uppercut: 'launcher', skyUppercut: 'launcher',
  sweep: 'sweep', roundhouse: 'heavy', finisher: 'heavy',
  special1: 'heavy', special2: 'heavy',
  grab: 'grab',
}
for (const [id, want] of Object.entries(EXPECTED)) {
  assert.equal(reactionClass(MOVES[id]), want, `${id} reaction tier`)
}
console.log('combat tests: reaction tiers correct for', Object.keys(EXPECTED).length, 'moves')

// --- 3. collision regions ----------------------------------------------------
function duel(p1, p2) {
  const m = new Match({ p1, p2 })
  m.start()
  for (let i = 0; i < 130; i++) m.step([makeInput(), makeInput()], DT)
  return m
}
{
  // standing attacker throws a HIGH jab at a crouching defender → must whiff
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  a.x = -0.4; b.x = 0.4
  a.startAttack('jab')
  b.forceState('crouch'); b.crouching = true
  a.attack.frame = MOVES.jab.startup + 1
  assert.equal(canHit(a, b), false, 'high jab must miss a crouching defender')

  // ...but a mid kick reaches the same crouching defender
  a.attack = null
  a.startAttack('kick')
  a.attack.frame = MOVES.kick.startup + 1
  assert.equal(canHit(a, b), true, 'mid kick must reach a crouching defender')

  // standing defender + high jab connects
  b.forceState('idle'); b.crouching = false
  assert.equal(canHit(a, b), true, 'mid kick must reach a standing defender')
}
{
  // a LOW sweep must miss an airborne opponent, a HIGH kick must reach it
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  a.x = -0.4; b.x = 0.4
  b.y = 1.0; b.vy = 0; b.grounded = false
  a.startAttack('sweep'); a.attack.frame = MOVES.sweep.startup + 1
  assert.equal(canHit(a, b), false, 'low sweep must miss an airborne defender')
  a.attack = null
  a.startAttack('roundhouse'); a.attack.frame = MOVES.roundhouse.startup + 1
  assert.equal(canHit(a, b), true, 'high roundhouse must reach an airborne defender')
}
{
  // only the ACTIVE frames register, and only once
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  a.x = -0.4; b.x = 0.4
  a.startAttack('cross')
  a.attack.frame = MOVES.cross.startup // first startup frame
  assert.equal(canHit(a, b), false, 'startup frames are not active')
  a.attack.frame = MOVES.cross.startup + 1
  assert.equal(canHit(a, b), true, 'active frame must hit')
  a.attack.hasHit = true
  assert.equal(canHit(a, b), false, 'hasHit prevents a second hit from the same swing')
}
{
  // blocking rules
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  b.holdingBack = true; b.crouching = false; b.forceState('idle')
  assert.equal(isBlocked(b, 'high'), true, 'standing guard blocks high')
  assert.equal(isBlocked(b, 'mid'), true, 'standing guard blocks mid')
  assert.equal(isBlocked(b, 'low'), false, 'standing guard does NOT block low')
  b.crouching = true
  assert.equal(isBlocked(b, 'low'), true, 'crouch guard blocks low')
  assert.equal(isBlocked(b, 'high'), false, 'crouch guard does not block high (it ducks)')
}
console.log('combat tests: collision regions, active-frame gating, blocking rules')

// --- 4. dash / backstep -------------------------------------------------------
{
  const m = duel('modi', 'rahul')
  const [a] = m.fighters
  const input = makeInput({ dash: 1 })
  a.update(input, m.fighters[1].x)
  assert.equal(a.state, 'dash', 'double-tap forward enters dash')
  assert.ok(a.dashFrames > 0, 'dash is committed for a number of frames')

  // The dash is committed for its first frames (mashing must not come out),
  // then it opens into a cancel window. Find where that window starts.
  let cancelFrame = 0
  for (let i = 1; i <= 14; i++) {
    a.update(makeInput({ punch: true }), m.fighters[1].x)
    if (a.state === 'attack') { cancelFrame = i; break }
  }
  assert.ok(cancelFrame >= 5, `dash committed for only ${cancelFrame} frame(s) before it cancelled`)
  assert.ok(cancelFrame <= 10, `dash cancel window never opens (frame ${cancelFrame})`)
}
{
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  a.x = -2; b.x = 0
  a.update(makeInput({ dash: -1 }), b.x)
  assert.equal(a.state, 'backstep', 'double-tap back enters backstep')
  assert.ok(a.invulnerable, 'backstep grants i-frames')
  b.startAttack('roundhouse')
  b.attack.frame = MOVES.roundhouse.startup + 1
  assert.equal(canHit(b, a), false, 'an attack cannot connect during backstep i-frames')

  // Full commit: no attack may start mid-backstep.
  for (let i = 0; i < 6; i++) a.update(makeInput({ punch: true }), b.x)
  assert.notEqual(a.state, 'attack', 'backstep cannot be interrupted')
  // ...and it recovers to neutral on its own.
  for (let i = 0; i < 40; i++) a.update(makeInput(), b.x)
  assert.ok(a.state === 'idle' || a.state === 'walk', `backstep recovers, got ${a.state}`)
}
console.log('combat tests: dash commit/cancel and backstep i-frames')

// --- 5. movement has acceleration, momentum and no teleporting ----------------
{
  const m = duel('modi', 'rahul')
  const [a] = m.fighters
  a.forceState('idle'); a.x = 0; a.vx = 0
  const speeds = []
  for (let i = 0; i < 8; i++) {
    a.update(makeInput({ moveX: 1 }), 100)
    speeds.push(a.vx)
  }
  assert.ok(speeds[1] > 0 && speeds[1] < speeds[3], 'speed ramps up rather than snapping')
  assert.ok(Math.abs(speeds[7] - speeds[6]) < 0.35, 'reaches a steady walk speed')
  // release: takes a few frames to settle (momentum), and stops
  a.update(makeInput(), 100)
  const stopping = a.vx
  assert.ok(stopping < speeds[7] && stopping > 0, 'releasing moves does not freeze dead-still')
  for (let i = 0; i < 40; i++) a.update(makeInput(), 100)
  assert.ok(Math.abs(a.vx) < 0.001, 'eventually stops completely')
}
console.log('movement tests: acceleration, deceleration, momentum')

// --- 6. no overlapping / no escaping the arena -------------------------------
{
  const m = duel('modi', 'rahul')
  const [a, b] = m.fighters
  // slam them together with knockback velocities
  a.x = -9.15; b.x = -9.15; a.vx = 6; b.vx = -6
  for (let i = 0; i < 40; i++) m.step([makeInput(), makeInput()], DT)
  assert.ok(b.x - a.x >= 0.6, `separation maintained (${(b.x - a.x).toFixed(3)})`)
  for (const f of m.fighters) {
    assert.ok(f.x >= -ARENA_HALF_WIDTH - 1e-6 && f.x <= ARENA_HALF_WIDTH + 1e-6, 'inside arena')
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), 'finite position')
  }
}
console.log('collision tests: separation and arena bounds hold under knockback')

// --- 7. input responsiveness & combos ---------------------------------------
{
  // A press on a neutral fighter takes effect on the very next step (no frame
  // of input latency, no waiting for a release edge).
  const f = new Fighter(0, CHARACTERS.modi, -1)
  const opp = 1.5
  f.update(makeInput({ punch: true }), opp)
  assert.equal(f.state, 'attack', 'press must be consumed the same step')
  assert.equal(f.attack.def.id, 'jab', 'neutral punch is the jab')

  // A buffered punch during the jab's active window cancels into the cross.
  let guard = 0
  while (f.state === 'attack' && f.attack.def.id === 'jab' &&
         f.attack.frame < MOVES.jab.startup + 1 && guard++ < 60) {
    f.update(makeInput(), opp)
  }
  f.update(makeInput({ punch: true }), opp) // buffered during the strike
  guard = 0
  while (guard++ < 60 && (f.state !== 'attack' || f.attack.def.id !== 'cross')) {
    f.update(makeInput(), opp)
  }
  assert.equal(f.state, 'attack', 'chain reached the next move')
  assert.equal(f.attack.def.id, 'cross', 'buffered punch chained jab -> cross')
}
{
  // A move with no chain must run its recovery out; a press during recovery is
  // buffered, not an interruption.
  const f = new Fighter(0, CHARACTERS.modi, -1)
  const opp = 1.5
  f.update(makeInput({ down: true, punch: true }), opp)
  assert.equal(f.attack.def.id, 'skyUppercut', 'down+punch is the sky uppercut')
  let guard = 0
  while (f.attack && f.attack.frame < MOVES.skyUppercut.startup + 1 && guard++ < 60) f.update(makeInput(), opp)
  const inRecoveryFrame = f.attack.frame
  f.update(makeInput({ punch: true }), opp) // buffered, must NOT cancel recovery
  assert.equal(f.state, 'attack', 'recovery must not be interrupted')
  assert.equal(f.attack.def.id, 'skyUppercut', 'recovery move unchanged by a press')
  assert.ok(f.attack.frame > inRecoveryFrame, 'recovery keeps ticking')
  guard = 0
  while (f.state === 'attack' && guard++ < 80) f.update(makeInput(), opp)
  assert.equal(f.state, 'crouch', 'a crouching move returns to the crouch stance')
  f.update(makeInput({ down: true, punch: true }), opp)
  assert.equal(f.state, 'attack', 'buffered press fires once the move ends')
}
{
  // A fighter in stun cannot act, but the press is remembered.
  const f = new Fighter(0, CHARACTERS.modi, -1)
  f.forceState('hitstun')
  f.stun = 6
  f.update(makeInput({ punch: true }), 1.5)
  assert.equal(f.state, 'hitstun', 'stun is respected')
  assert.equal(f.attack, null, 'no attack out of stun')
  let g = 0
  while (f.state === 'hitstun' && g++ < 20) f.update(makeInput(), 1.5)
  assert.equal(f.state, 'idle', 'recovers out of stun')
  f.update(makeInput(), 1.5)
  assert.equal(f.state, 'attack', 'remembered press fires after recovery')
  assert.equal(f.attack.def.id, 'jab', 'the remembered press is the jab that was buffered')
}
console.log('responsiveness tests: zero-frame input, chains, recovery integrity, stun lock')
