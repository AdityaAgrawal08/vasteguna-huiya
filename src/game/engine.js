import {
  CHARACTERS, MOVES, ARENA_HALF_WIDTH, pickMove, MOVE_LABELS,
} from './data.js'

export const FPS = 60
export const DT = 1 / FPS
export const ROUND_SECONDS = 60
export const ROUNDS_TO_WIN = 2
export const SUPER_DAMAGE = 30
export const SUPER_DURATION = 4.6

const BLOCKED_STATES = new Set(['super', 'frozen', 'victory', 'intro', 'ko'])
const INVULNERABLE_STATES = new Set(['knockdown', 'getup', 'ko', 'super', 'frozen', 'victory', 'intro'])
const HIT_HEIGHT = { high: 1.55, mid: 1.15, low: 0.35 }

export const emptyInput = () => ({
  moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false,
})

export function makeInput(o = {}) {
  return { ...emptyInput(), ...o }
}

function moveTotal(def) {
  return def.startup + def.active + def.recovery
}

export class Fighter {
  constructor(side, char, x) {
    this.side = side
    this.char = char
    this.x = x
    this.y = 0
    this.vx = 0
    this.vy = 0
    this.facing = side === 0 ? 1 : -1
    this.hp = 100
    this.meter = 0
    this.state = 'idle'
    this.stateFrames = 0
    this.attack = null
    this.crouching = false
    this.holdingBack = false
    this.moveRel = 0
    this.stun = 0
    this.buffer = null
    this.superBuffer = 0
    this.comboHits = 0
    this.lastHitHeight = 'mid'
    this.walkDistance = 0
    this.wantsSuper = false
    this.airAttackUsed = false
    this.downFrames = 0
    this.grounded = true
    this.flash = 0
    this.lastHitAt = -99
  }

  reset(x) {
    this.x = x
    this.y = 0
    this.vx = 0
    this.vy = 0
    this.facing = this.side === 0 ? 1 : -1
    this.hp = 100
    this.meter = 0
    this.attack = null
    this.crouching = false
    this.holdingBack = false
    this.moveRel = 0
    this.stun = 0
    this.buffer = null
    this.superBuffer = 0
    this.comboHits = 0
    this.downFrames = 0
    this.grounded = true
    this.flash = 0
    this.enter('idle')
  }

  get airborne() { return this.y > 0.001 || this.vy > 0 }
  get actionable() { return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' }
  get invulnerable() { return INVULNERABLE_STATES.has(this.state) }
  get isLow() {
    if (this.state === 'crouch' || (this.state === 'blockstun' && this.crouching)) return true
    return !!(this.attack && this.attack.def.crouching)
  }
  get isAttackActive() {
    const a = this.attack
    return a ? a.frame > a.def.startup && a.frame <= a.def.startup + a.def.active : false
  }
  get attackPhase() {
    const a = this.attack
    if (!a) return null
    if (a.frame <= a.def.startup) return 'startup'
    if (a.frame <= a.def.startup + a.def.active) return 'active'
    return 'recovery'
  }
  get canBlock() {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' || this.state === 'blockstun'
  }
  get attackHeight() {
    return this.attack ? (this.attack.def.air ? 'mid' : this.attack.def.height) : null
  }

  enter(state) {
    if (this.state !== state) { this.state = state; this.stateFrames = 0 }
  }
  forceState(state) { this.state = state; this.stateFrames = 0 }
  addMeter(n) { this.meter = Math.min(100, Math.max(0, this.meter + n)) }
  consumeBuffer() {
    if (!this.buffer) return null
    const b = this.buffer.button
    this.buffer = null
    return b
  }
  startAttack(id) {
    this.attack = { def: MOVES[id], frame: 0, hasHit: false }
    this.enter('attack')
    this.stateFrames = 0
  }
  startJump(dirX) {
    this.vy = this.char.jumpV
    this.vx = dirX * this.char.jumpVx * this.facing
    this.crouching = false
    this.airAttackUsed = false
    this.attack = null
    this.grounded = false
    this.enter('jump')
  }

  update(input, opponentX) {
    this.wantsSuper = false
    this.stateFrames++
    if (this.flash > 0) this.flash--

    if (input.grab || input.punch || input.kick) {
      this.buffer = { button: input.grab ? 'grab' : input.kick ? 'kick' : 'punch', frames: 9 }
    } else if (this.buffer) {
      this.buffer.frames--
      if (this.buffer.frames <= 0) this.buffer = null
    }

    if (input.super) this.superBuffer = 30
    else if (this.superBuffer > 0) this.superBuffer--

    if (BLOCKED_STATES.has(this.state)) return

    const toward = opponentX >= this.x ? 1 : -1

    switch (this.state) {
      case 'idle':
      case 'walk':
      case 'crouch':
        this.comboHits = 0
        this.updateActionable(input, toward)
        break
      case 'attack':
        this.updateAttack()
        break
      case 'jump':
        if (!this.airAttackUsed && this.buffer && this.buffer.button !== 'grab') {
          const b = this.consumeBuffer()
          this.attack = { def: MOVES[b === 'kick' ? 'airKick' : 'airPunch'], frame: 0, hasHit: false }
          this.airAttackUsed = true
        }
        if (this.attack) this.attack.frame++
        break
      case 'hitstun':
        this.stun--
        this.vx *= 0.86
        if (this.stun <= 0) this.enter('idle')
        break
      case 'blockstun':
        this.holdingBack = input.moveX * this.facing < 0
        this.crouching = input.down
        this.stun--
        this.vx *= 0.82
        if (this.stun <= 0) this.enter(this.crouching ? 'crouch' : 'idle')
        break
      case 'knockdown':
        if (this.grounded) {
          this.vx *= 0.8
          this.downFrames++
          if (this.downFrames >= 48) this.enter('getup')
        }
        break
      case 'getup':
        this.vx = 0
        if (this.stateFrames >= 24) { this.facing = toward; this.enter('idle') }
        break
      case 'ko':
        if (this.grounded) this.vx *= 0.85
        break
    }
    this.integrate()
  }

  updateActionable(input, toward) {
    this.facing = toward
    const rel = input.moveX * this.facing
    this.moveRel = rel
    this.holdingBack = rel < 0
    if (this.superBuffer > 0 && this.meter >= 100) {
      this.superBuffer = 0
      this.wantsSuper = true
      this.vx = 0
      return
    }
    if (input.up && !input.down) { this.startJump(rel); return }
    this.crouching = input.down
    const b = this.consumeBuffer()
    if (b) { this.startAttack(pickMove(b, this.crouching, rel > 0)); return }
    if (this.crouching) { this.enter('crouch'); this.vx = 0; return }
    if (rel === 0) { this.enter('idle'); this.vx = 0; return }
    this.enter('walk')
    this.vx = rel > 0 ? this.char.walkFwd * this.facing : -this.char.walkBack * this.facing
  }

  updateAttack() {
    const a = this.attack
    if (!a) { this.enter('idle'); return }
    a.frame++
    const def = a.def
    this.vx = a.frame <= def.startup + def.active ? def.lunge * this.facing : this.vx * 0.75
    if (def.chains && this.buffer && a.frame >= def.startup + def.active) {
      const next = def.chains[this.buffer.button]
      if (next) { this.buffer = null; this.startAttack(next); return }
    }
    if (a.frame >= moveTotal(def)) {
      this.attack = null
      this.crouching = !!def.crouching
      this.enter(def.crouching ? 'crouch' : 'idle')
    }
  }

  integrate() {
    const wasAir = this.y > 0 || this.vy !== 0
    if (wasAir) this.vy -= 24 * DT
    this.x += this.vx * DT
    this.y += this.vy * DT
    if (this.state === 'walk') this.walkDistance += Math.abs(this.vx) * DT
    this.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, this.x))
    if (this.y <= 0 && wasAir && this.vy <= 0) {
      this.y = 0
      this.vy = 0
      this.onLand()
    }
  }

  onLand() {
    this.grounded = true
    if (this.state === 'jump') { this.attack = null; this.vx = 0; this.enter('idle') }
    else if (this.state === 'hitstun') this.vx *= 0.5
  }

  applyBlock(def, dir) {
    this.attack = null
    this.forceState('blockstun')
    this.stun = def.blockstun
    this.vx = dir * def.push * 0.75
    this.flash = 2
  }

  applyHit(def, damage, dir) {
    const wasActive = !!this.attack &&
      this.attack.frame > this.attack.def.startup &&
      this.attack.frame <= this.attack.def.startup + this.attack.def.active
    this.hp = Math.max(0, this.hp - damage)
    if (!wasActive) this.attack = null
    this.comboHits++
    this.lastHitHeight = def.height
    this.crouching = false
    this.flash = 6
    if (this.hp <= 0) { this.knockOut(dir, 3.4, 6.5, wasActive); return }
    if (def.knockdown || this.airborne) {
      this.forceState('knockdown')
      this.vx = dir * (def.push + 0.8)
      this.vy = Math.max(def.launch, 4.2)
      this.downFrames = 0
      this.grounded = false
    } else {
      this.forceState('hitstun')
      this.stun = def.hitstun
      this.vx = dir * def.push
    }
  }

  knockOut(dir, vx, vy, keepAttack = false) {
    this.hp = 0
    if (!keepAttack) this.attack = null
    this.forceState('ko')
    this.vx = dir * vx
    this.vy = vy
    this.grounded = false
  }
}

export function canHit(attacker, defender) {
  const a = attacker.attack
  if (!a || a.hasHit || !attacker.isAttackActive || defender.invulnerable) return false
  const rel = (defender.x - attacker.x) * attacker.facing
  if (rel < -0.15 || rel > a.def.reach + 0.34) return false
  if (a.def.grab && (defender.state === 'hitstun' || defender.airborne || defender.y > 0.01)) return false
  const h = attacker.attackHeight
  if (defender.y > 0.25 && h === 'low') return false
  if (defender.isLow && h === 'high') return false
  if (Math.abs(attacker.y - defender.y) > 1.5) return false
  return true
}

export function isBlocked(defender, height) {
  if (!defender.canBlock || !defender.holdingBack || defender.airborne) return false
  if (defender.crouching) return height === 'low'
  return height === 'high' || height === 'mid'
}

function damageAfterScaling(attacker, defender, base) {
  const scale = Math.max(0.5, 0.88 ** defender.comboHits)
  return Math.max(1, Math.round(base * attacker.char.damageMul * scale))
}

export class Match {
  constructor({ p1, p2, stage = 'sansad', difficulty = 'normal', roundsToWin = ROUNDS_TO_WIN }) {
    this.stage = stage
    this.difficulty = difficulty
    this.roundsToWin = roundsToWin
    this.fighters = [new Fighter(0, CHARACTERS[p1], -2.6), new Fighter(1, CHARACTERS[p2], 2.6)]
    this.wins = [0, 0]
    this.round = 1
    this.timer = ROUND_SECONDS
    this.phase = 'intro'
    this.phaseTime = 0
    this.events = []
    this.timeUp = false
    this.hitStop = 0
    this.super = null
    this.matchOver = false
    this.winner = null
    this.roundWinner = null
    this.perfect = false
    this.slowMo = 0
    this.rng = Math.random
    this.doubleKos = 0
  }

  emit(ev) { this.events.push(ev) }
  drainEvents() { const e = this.events; this.events = []; return e }

  start() {
    for (const f of this.fighters) f.forceState('intro')
    this.emit({ type: 'roundStart', round: this.round, final: this.round >= 2 * this.roundsToWin - 1 })
    this.emit({ type: 'announce', text: `ROUND ${this.round}` })
    this.phase = 'intro'
    this.phaseTime = 0
  }

  get player() { return this.fighters[0] }
  get cpu() { return this.fighters[1] }

  step(inputs, dt = DT) {
    if (this.matchOver) return
    this.phaseTime += dt

    if (this.phase === 'intro') {
      if (this.phaseTime > 1.15 && !this._fightCalled) {
        this._fightCalled = true
        this.emit({ type: 'announce', text: 'FIGHT!', cls: 'fight' })
        this.emit({ type: 'fight' })
      }
      if (this.phaseTime > 1.9) {
        this.phase = 'fight'
        this.phaseTime = 0
        this._fightCalled = false
        for (const f of this.fighters) f.forceState('idle')
      }
      this.fighters[0].update(makeInput(), this.fighters[1].x)
      this.fighters[1].update(makeInput(), this.fighters[0].x)
      return
    }

    if (this.phase === 'ko') {
      this.slowMo = Math.max(0, this.slowMo - dt)
      this.fighters[0].update(makeInput(), this.fighters[1].x)
      this.fighters[1].update(makeInput(), this.fighters[0].x)
      if (this.phaseTime > 2.2) this.finishRound()
      return
    }

    if (this.phase === 'super') {
      this.super.t += dt
      this.fighters[0].update(makeInput(), this.fighters[1].x)
      this.fighters[1].update(makeInput(), this.fighters[0].x)
      if (this.super.t >= this.super.duration) this.resolveSuper()
      return
    }

    if (this.phase === 'roundEnd') {
      this.fighters[0].update(makeInput(), this.fighters[1].x)
      this.fighters[1].update(makeInput(), this.fighters[0].x)
      if (this.phaseTime > 1.7) this.nextRound()
      return
    }

    if (this.phase === 'matchEnd') return

    // Fight phase
    if (this.hitStop > 0) {
      // Freeze both fighters completely for a punchy hit-stop; advancing
      // attack frames here made strikes skip their contact pose.
      this.hitStop--
      return
    }

    this.timer -= dt
    if (this.timer <= 0) {
      this.timer = 0
      const [fa, fb] = this.fighters
      let w = null
      if (fa.hp !== fb.hp) w = fa.hp > fb.hp ? 0 : 1
      else if (fa.meter !== fb.meter) w = fa.meter > fb.meter ? 0 : 1
      if (w == null) {
        this.suddenDeath = (this.suddenDeath || 0) + 1
        if (this.suddenDeath <= 2) {
          this.timer = 10
          this.emit({ type: 'suddenDeath' })
          return
        }
        w = Math.random() < 0.5 ? 0 : 1
      }
      this.timeUp = true
      this.endRound(w, true)
      return
    }

    const [a, b] = this.fighters
    a.update(inputs[0], b.x)
    b.update(inputs[1], a.x)

    if (a.wantsSuper) return this.startSuper(0)
    if (b.wantsSuper) return this.startSuper(1)

    // Face each other while neutral
    for (const f of this.fighters) {
      if (f.actionable) f.facing = (f.side === 0 ? b.x >= a.x : a.x >= b.x) ? 1 : -1
    }

    // Push boxes
    const dx = b.x - a.x
    const minGap = 0.82
    if (Math.abs(dx) < minGap) {
      const push = (minGap - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1)
      a.x -= push
      b.x += push
      a.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, a.x))
      b.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, b.x))
    }

    this.resolveAttack(a, b)
    this.resolveAttack(b, a)

    const aDead = a.hp <= 0
    const bDead = b.hp <= 0
    if (aDead && bDead) this.endDoubleKo()
    else if (aDead) this.endRound(1, false)
    else if (bDead) this.endRound(0, false)
  }

  resolveAttack(attacker, defender) {
    if (!canHit(attacker, defender)) return
    const a = attacker.attack
    const height = attacker.attackHeight
    const dir = attacker.facing
    const hitX = defender.x - dir * 0.25
    const hitY = defender.y + (a.def.air ? 1.35 : HIT_HEIGHT[height])
    a.hasHit = true

    if (a.def.grab) {
      const counter = !!defender.attack?.def.grab && defender.attackPhase !== 'recovery'
      if (defender.buffer?.button === 'grab' || counter) {
        for (const [f, d] of [[attacker, -dir], [defender, dir]]) {
          f.attack = null; f.buffer = null; f.forceState('blockstun'); f.stun = 14; f.vx = d * 2.6
        }
        this.emit({ type: 'grabBreak', x: (attacker.x + defender.x) / 2, y: 1.2 })
        this.hitStop = 4
        return
      }
      const dmg = Math.round(14 * attacker.char.damageMul)
      defender.applyHit({ ...a.def, knockdown: true, launch: 5, push: 3.2 }, dmg, dir)
      attacker.addMeter(12)
      defender.addMeter(8)
      attacker.vx = -dir * 1.2
      this.emit({ type: 'grab', side: attacker.side, move: attacker.char.moveNames.grab, x: hitX, y: hitY, damage: dmg })
      this.emit({ type: 'hit', side: attacker.side, move: attacker.char.moveNames.grab, x: hitX, y: hitY, damage: dmg, knockdown: true, grab: true })
      this.hitStop = 8
      return
    }

    if (isBlocked(defender, height)) {
      defender.applyBlock(a.def, dir)
      attacker.addMeter(2)
      defender.addMeter(3)
      attacker.vx = -dir * a.def.push * 0.6
      this.emit({ type: 'block', side: attacker.side, x: hitX, y: hitY })
      this.hitStop = 3
      return
    }

    const dmg = damageAfterScaling(attacker, defender, a.def.damage)
    defender.applyHit(a.def, dmg, dir)
    attacker.addMeter(dmg * 0.9 + 2)
    defender.addMeter(dmg * 0.6)
    attacker.vx = -dir * a.def.push * 0.8
    this.emit({
      type: 'hit', side: attacker.side, move: attacker.char.moveNames[a.def.id] || (a.def.id === 'skyUppercut' ? (attacker.char.moveNames.uppercut || 'SKY UPPERCUT!') : (MOVE_LABELS[a.def.id] || 'HIT!')),
      x: hitX, y: hitY, damage: dmg, knockdown: defender.state === 'knockdown',
      ko: defender.state === 'ko', height, combo: defender.comboHits,
    })
    this.hitStop = defender.state === 'ko' ? 14 : 6
  }

  startSuper(side) {
    const caster = this.fighters[side]
    const target = this.fighters[1 - side]
    caster.meter = 0
    caster.forceState('super')
    caster.vx = 0
    target.forceState('frozen')
    target.vx = 0
    this.phase = 'super'
    this.phaseTime = 0
    this.super = {
      side, charId: caster.char.id, name: caster.char.superName,
      t: 0, duration: SUPER_DURATION, resolved: false,
    }
    this.emit({ type: 'superStart', side, charId: caster.char.id, superName: caster.char.superName })
  }

  resolveSuper() {
    if (!this.super || this.super.resolved) return
    this.super.resolved = true
    const side = this.super.side
    const caster = this.fighters[side]
    const target = this.fighters[1 - side]
    const dmg = Math.round(SUPER_DAMAGE * caster.char.damageMul)
    // The opponent is transformed/obliterated, then comes back on their feet
    // with less energy. `getup` animates them rising to a neutral stance.
    target.forceState('getup')
    target.y = 0
    target.vy = 0
    target.vx = caster.facing * 0.9
    target.grounded = true
    target.hp = Math.max(0, target.hp - dmg)
    target.flash = 12
    target.comboHits = 0
    caster.addMeter(0)
    // Release the caster from the frozen `super` state, otherwise
    // BLOCKED_STATES keeps them locked forever and they "stop working".
    caster.forceState('idle')
    caster.vx = 0
    caster.vy = 0
    caster.y = 0
    caster.grounded = true
    caster.attack = null
    caster.buffer = null
    this.emit({ type: 'superHit', side, damage: dmg, x: target.x, y: target.y + 1 })
    this.super = null
    this.phase = 'fight'
    this.phaseTime = 0
    this.hitStop = 8
    if (target.hp <= 0) this.endRound(side, false)
  }

  endDoubleKo() {
    if (this.phase === 'ko' || this.phase === 'roundEnd' || this.phase === 'matchEnd') return
    this.phase = 'ko'
    this.phaseTime = 0
    this.slowMo = 0.8
    this.perfect = false
    this.timeUp = false
    this.doubleKos = (this.doubleKos || 0) + 1
    for (const f of this.fighters) f.forceState('ko')
    if (this.doubleKos >= 2) {
      // Two consecutive double K.O.s: award the round on SHAKTI so a match
      // cannot loop forever on mutual KOs.
      const w = this.fighters[0].meter >= this.fighters[1].meter ? 0 : 1
      this.wins[w]++
      this.roundWinner = w
      this.emit({ type: 'ko', side: w, doubleKo: true, timeUp: false, perfect: false, text: 'DOUBLE K.O.' })
    } else {
      this.roundWinner = null
      this.emit({ type: 'ko', side: null, doubleKo: true, timeUp: false, perfect: false, text: 'DOUBLE K.O.' })
    }
  }

  endRound(winnerSide, timeUp) {
    if (this.phase === 'ko' || this.phase === 'roundEnd' || this.phase === 'matchEnd') return
    this.phase = 'ko'
    this.phaseTime = 0
    this.slowMo = 0.8
    this.roundWinner = winnerSide
    this.timeUp = timeUp
    this.perfect = winnerSide != null && this.fighters[1 - winnerSide].hp === 100
    if (winnerSide != null) this.wins[winnerSide]++
    const loser = winnerSide == null ? null : this.fighters[1 - winnerSide]
    if (loser && loser.hp <= 0) loser.forceState('ko')
    this.emit({
      type: 'ko', side: winnerSide, timeUp, perfect: this.perfect,
      winnerChar: winnerSide == null ? null : this.fighters[winnerSide].char.id,
      text: timeUp ? 'TIME UP' : 'K.O.',
    })
    if (winnerSide != null) {
      const w = this.fighters[winnerSide]
      w.forceState('victory')
      w.vx = 0
    }
  }

  finishRound() {
    if (this.wins[0] >= this.roundsToWin || this.wins[1] >= this.roundsToWin) {
      this.matchOver = true
      this.winner = this.wins[0] > this.wins[1] ? 0 : 1
      this.phase = 'matchEnd'
      this.phaseTime = 0
      this.emit({ type: 'matchEnd', side: this.winner, wins: [...this.wins], perfect: this.perfect })
      return
    }
    this.phase = 'roundEnd'
    this.phaseTime = 0
    this.emit({ type: 'roundEnd', wins: [...this.wins] })
  }

  nextRound() {
    this.round++
    this.timer = ROUND_SECONDS
    this.timeUp = false
    this.suddenDeath = 0
    this.perfect = false
    this.roundWinner = null
    this.fighters[0].reset(-2.6)
    this.fighters[1].reset(2.6)
    for (const f of this.fighters) f.forceState('intro')
    this.phase = 'intro'
    this.phaseTime = 0
    this._fightCalled = false
    this.emit({ type: 'roundStart', round: this.round, final: this.round >= 2 * this.roundsToWin - 1 })
    this.emit({ type: 'announce', text: `ROUND ${this.round}` })
  }
}
