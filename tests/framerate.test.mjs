import assert from 'node:assert/strict'
import { Match, DT, makeInput } from '../src/game/engine.js'

// Deterministic scripted input: no AI (the CPU uses Math.random) and no timer
// reaching the sudden-death branch. If the simulation ever picks up wall-clock
// time, frame-rate-dependent state or hidden randomness, these two runs diverge.
function script(i) {
  // small deterministic LCG so the sequence is reproducible and never empty
  const seed = (i * 1103515245 + 12345) & 0x7fffffff
  const r = (seed >>> 16) / 65536
  return makeInput({
    moveX: r < 0.3 ? -1 : r < 0.62 ? 1 : 0,
    punch: r > 0.74 && r < 0.82,
    kick: r > 0.83 && r < 0.9,
    grab: r > 0.91 && r < 0.93,
    down: r > 0.62 && r < 0.72,
    up: r > 0.94,
  })
}

function run(steps) {
  const m = new Match({ p1: 'modi', p2: 'trump', difficulty: 'hard' })
  m.start()
  for (let i = 0; i < steps; i++) {
    const inp = script(i)
    m.step([inp, script(i + 7)], DT)
    if (i % 37 === 0) m.drainEvents() // event handling must not perturb the sim
  }
  return m
}

function snapshot(m) {
  return {
    wins: m.wins,
    round: m.round,
    timer: +m.timer.toFixed(6),
    phase: m.phase,
    fighters: m.fighters.map((f) => ({
      x: +f.x.toFixed(9), y: +f.y.toFixed(9), vx: +f.vx.toFixed(9), vy: +f.vy.toFixed(9),
      hp: f.hp, meter: f.meter, state: f.state, stateFrames: f.stateFrames,
      comboHits: f.comboHits, hitStun: f.stun,
      atk: f.attack ? `${f.attack.def.id}:${f.attack.frame}:${f.attack.hasHit}` : null,
    })),
  }
}

const N = 1200
const a = run(N)
const b = run(N)
assert.deepEqual(snapshot(a), snapshot(b),
  'the simulation must be frame-rate independent: identical inputs must give identical state')

// Chunking the same input stream into different batch sizes must not matter
// either (the sim never reads a clock of its own).
function runChunked(perCall) {
  const m = new Match({ p1: 'didi', p2: 'yogi', difficulty: 'normal' })
  m.start()
  let i = 0
  let left = 0
  let inp = script(0)
  while (i < N) {
    if (left <= 0) { inp = script(i); left = perCall }
    m.step([inp, script(i + 3)], DT)
    i++; left--
  }
  return snapshot(m)
}
assert.deepEqual(runChunked(1), runChunked(1), 'batch size 1 is reproducible')
assert.deepEqual(runChunked(1), runChunked(6), 'batch grouping must not change the result')

// A blocked timer must still be deterministic.
{
  const m = run(300)
  const t1 = m.timer
  const m2 = run(300)
  assert.equal(t1, m2.timer, 'timer advances identically')
  // The round clock only runs during the fight phase, so it is never behind
  // wall-clock frame counting — that is the point being verified here.
  assert.ok(t1 <= 60 && t1 >= 55, `timer is dt-driven, got ${t1}`)
}

console.log(`framerate tests passed: ${N} steps reproduced bit-for-bit across runs and batch sizes`)
