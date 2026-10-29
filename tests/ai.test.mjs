import assert from 'node:assert/strict'
import { Match, DT, makeInput } from '../src/game/engine.js'
import { CPU } from '../src/game/ai.js'

for (const difficulty of ['easy', 'normal', 'hard']) {
  const m = new Match({ p1: 'modi', p2: 'yogi', difficulty })
  m.start()
  const a = new CPU(m, 0, difficulty)
  const b = new CPU(m, 1, difficulty)
  let steps = 0
  let hits = 0
  let blocks = 0
  let supers = 0
  while (!m.matchOver && steps < 60 * 240) {
    const evs0 = m.drainEvents()
    for (const e of evs0) {
      if (e.type === 'hit') hits++
      if (e.type === 'block') blocks++
      if (e.type === 'superStart') supers++
    }
    m.step([a.update(), b.update()], DT)
    steps++
  }
  const events = m.drainEvents()
  hits += events.filter((e) => e.type === 'hit').length
  blocks += events.filter((e) => e.type === 'block').length
  supers += events.filter((e) => e.type === 'superStart').length
  assert.ok(m.matchOver, `${difficulty}: match should finish, steps=${steps}`)
  assert.ok(hits > 4, `${difficulty}: expected exchanges, hits=${hits}`)
  assert.ok(m.wins[0] + m.wins[1] >= 2, `${difficulty}: wins recorded`)
  console.log(`${difficulty}: ${steps} steps, hits=${hits}, blocks=${blocks}, supers=${supers}, wins=${m.wins.join('-')}`)
}

// CPU should not press super without a full meter.
{
  const m = new Match({ p1: 'didi', p2: 'nitin' })
  m.start()
  const cpu = new CPU(m, 1, 'hard')
  for (let i = 0; i < 200; i++) m.step([makeInput(), cpu.update()], DT)
  assert.ok(m.phase !== 'super' || m.fighters[1].meter === 0)
}
console.log('ai tests passed')
