import assert from 'node:assert/strict'
import { Match, makeInput, DT, SUPER_DURATION } from '../src/game/engine.js'

const empty = makeInput()

function skipIntro(match) {
  for (let i = 0; i < 130; i++) match.step([empty, empty], DT)
  assert.equal(match.phase, 'fight', 'intro should hand over to fight phase')
}

function place(match, x1, x2) {
  match.fighters[0].x = x1
  match.fighters[1].x = x2
  match.fighters[0].facing = x2 >= x1 ? 1 : -1
  match.fighters[1].facing = x1 >= x2 ? 1 : -1
}

// 1. intro -> fight
{
  const m = new Match({ p1: 'modi', p2: 'rahul' })
  m.start()
  skipIntro(m)
  assert.equal(m.fighters[0].hp, 100)
  assert.equal(m.round, 1)
  assert.equal(Math.ceil(m.timer), 60)
}

// 2. a jab connects, deals damage and builds meter
{
  const m = new Match({ p1: 'modi', p2: 'rahul' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.step([makeInput({ punch: true }), empty], DT)
  for (let i = 0; i < 20; i++) m.step([empty, empty], DT)
  assert.ok(m.fighters[1].hp < 100, `jab should damage, hp=${m.fighters[1].hp}`)
  assert.ok(m.fighters[0].meter > 0, 'attacker should gain SHAKTI')
  const hits = m.drainEvents().filter((e) => e.type === 'hit')
  assert.equal(hits.length, 1, 'exactly one hit event')
  assert.equal(hits[0].damage, 5, 'jab damage should be 5 before scaling')
}

// 3. holding back blocks a high attack
{
  const m = new Match({ p1: 'modi', p2: 'rahul' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.step([makeInput({ punch: true }), makeInput({ moveX: 1 })], DT)
  for (let i = 0; i < 16; i++) m.step([empty, makeInput({ moveX: 1 })], DT)
  assert.equal(m.fighters[1].hp, 100, 'blocked attack must not damage')
  const blocks = m.drainEvents().filter((e) => e.type === 'block')
  assert.equal(blocks.length, 1, 'block event expected')
}

// 4. forward + punch is the character special, more damage than a jab
{
  const m = new Match({ p1: 'modi', p2: 'rahul' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.step([makeInput({ moveX: 1, punch: true }), empty], DT)
  for (let i = 0; i < 30; i++) m.step([empty, empty], DT)
  const hits = m.drainEvents().filter((e) => e.type === 'hit')
  assert.equal(hits.length, 1)
  assert.ok(hits[0].damage >= 12, `special damage ${hits[0].damage}`)
}

// 5. crouch + kick is a sweep that knocks down
{
  const m = new Match({ p1: 'didi', p2: 'trump' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.step([makeInput({ down: true, kick: true }), empty], DT)
  for (let i = 0; i < 30; i++) m.step([empty, empty], DT)
  const hits = m.drainEvents().filter((e) => e.type === 'hit')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].knockdown, true, 'sweep should knock down')
}

// 6. super consumes a full meter and deals 30%
{
  const m = new Match({ p1: 'yogi', p2: 'nitin' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.fighters[0].meter = 100
  m.step([makeInput({ super: true }), empty], DT)
  assert.equal(m.phase, 'super', 'super phase should start')
  for (let i = 0; i < Math.ceil(SUPER_DURATION / DT) + 10; i++) m.step([empty, empty], DT)
  assert.ok(m.fighters[0].meter < 100, 'meter consumed')
  assert.ok(m.fighters[1].hp <= 70, `super should take ~30%, hp=${m.fighters[1].hp}`)
  assert.equal(m.phase, 'fight')
}

// 7. KO ends the round and a second KO ends the match
{
  const m = new Match({ p1: 'trump', p2: 'didi' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.fighters[1].hp = 3
  m.step([makeInput({ punch: true }), empty], DT)
  for (let i = 0; i < 30; i++) m.step([empty, empty], DT)
  const evs = m.drainEvents()
  assert.ok(evs.some((e) => e.type === 'ko'), 'KO event')
  assert.equal(m.wins[0], 1)
  for (let i = 0; i < 330; i++) m.step([empty, empty], DT)
  assert.equal(m.round, 2, 'round 2 should begin')
}

// 8. grab throws for damage
{
  const m = new Match({ p1: 'rahul', p2: 'modi' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.step([makeInput({ grab: true }), empty], DT)
  for (let i = 0; i < 30; i++) m.step([empty, empty], DT)
  assert.ok(m.fighters[1].hp < 100, 'grab should damage')
  const evs = m.drainEvents()
  assert.ok(evs.some((e) => e.type === 'grab'), 'grab event')
}

// 9. damage scaling keeps long combos from one-shotting
{
  const m = new Match({ p1: 'nitin', p2: 'yogi' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  for (let i = 0; i < 6; i++) {
    m.fighters[0].attack = null
    m.fighters[0].state = 'idle'
    m.step([makeInput({ punch: true }), empty], DT)
    for (let j = 0; j < 14; j++) m.step([empty, empty], DT)
  }
  assert.ok(m.fighters[1].hp > 20, `combo scaling should apply, hp=${m.fighters[1].hp}`)
}

// 10. time up awards the round to the fighter with more health
{
  const m = new Match({ p1: 'didi', p2: 'trump' })
  m.start(); skipIntro(m)
  m.fighters[0].hp = 71
  m.fighters[1].hp = 42
  m.timer = 0.01
  m.step([empty, empty], DT)
  assert.equal(m.timeUp, true, 'time up flagged')
  assert.equal(m.wins[0], 1, 'higher health wins on time')
  assert.equal(m.fighters[0].state, 'victory')
}

// 11. simultaneous KOs are a double KO and replay the round
{
  const m = new Match({ p1: 'modi', p2: 'rahul' })
  m.start(); skipIntro(m)
  place(m, -0.5, 0.5)
  m.fighters[0].hp = 1
  m.fighters[1].hp = 1
  m.step([makeInput({ punch: true }), makeInput({ punch: true })], DT)
  for (let i = 0; i < 20; i++) m.step([empty, empty], DT)
  assert.equal(m.phase, 'ko')
  assert.equal(m.wins[0], 0)
  assert.equal(m.wins[1], 0)
  const evs = m.drainEvents()
  assert.ok(evs.some((e) => e.type === 'ko' && e.doubleKo), 'double KO event')
  for (let i = 0; i < 400; i++) m.step([empty, empty], DT)
  assert.equal(m.round, 2, 'double KO should replay into round 2')
}

console.log('engine tests passed: intro, hit, block, special, sweep, super, KO, double-KO, grab, scaling, time-up')
