import assert from 'node:assert/strict'
import { Match, DT } from '../src/game/engine.js'
import { CPU } from '../src/game/ai.js'

for (const difficulty of ['easy', 'normal', 'hard']) {
  const m = new Match({ p1: 'modi', p2: 'didi', difficulty })
  m.start()
  const a = new CPU(m, 0, difficulty)
  const b = new CPU(m, 1, difficulty)
  let steps = 0
  while (!m.matchOver && steps < 60 * 300) {
    m.step([a.update(), b.update()], DT)
    const [f1, f2] = m.fighters
    for (const f of m.fighters) {
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), `${difficulty}: finite position`)
      assert.ok(f.x >= -9.2001 && f.x <= 9.2001, `${difficulty}: x in arena (${f.x})`)
      assert.ok(f.y >= -0.001, `${difficulty}: y not below floor (${f.y})`)
      assert.ok(f.hp >= 0 && f.hp <= 100, `${difficulty}: hp range`)
      assert.ok(f.meter >= 0 && f.meter <= 100, `${difficulty}: meter range`)
      if (f.attack) {
        const total = f.attack.def.startup + f.attack.def.active + f.attack.def.recovery
        assert.ok(f.attack.frame <= total + 1, `${difficulty}: attack frame bounded (${f.attack.def.id} ${f.attack.frame}/${total})`)
      }
    }
    assert.ok(Math.abs(f1.x - f2.x) >= 0.6, `${difficulty}: fighters not interpenetrating (${Math.abs(f1.x - f2.x)})`)
    steps++
  }
  assert.ok(m.matchOver, `${difficulty}: match ended`)
  console.log(`${difficulty}: ${steps} steps, wins ${m.wins.join('-')}, invariants ok`)
}
console.log('fight invariant audit passed')
