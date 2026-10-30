import {
  CHARACTERS, MOVES, ARENA_HALF_WIDTH, pickMove, MOVE_LABELS,
} from './data.js'

export const FPS = 60
export const DT = 1 / FPS
export const ROUND_SECONDS = 60
export const ROUNDS_TO_WIN = 2
export const SUPER_DAMAGE = 30
export const SUPER_DURATION = 4.6

// States that never tick (static holds driven by the phase around them).
const BLOCKED_STATES = new Set(['super', 'frozen', 'victory', 'intro'])
// States in which the fighter cannot be hurt.
const INVULNERABLE_STATES = new Set(['knockdown', 'getup', 'ko', 'super', 'frozen', 'victory', 'intro', 'backstep'])
// Legacy world height used for the impact spark position.
const HIT_HEIGHT = { high: 1.55, mid: 1.15, low: 0.35 }

// --- movement model (units/s, units/s²) -----------------------------------
const GRAVITY = 24
const MOVE_ACCEL_AIR = 22
const FRICTION_AIR = 6
const FRICTION_STUN = 8 // knockback/stun slide-out
const DASH_FRAMES = 12
const DASH_MULT = 2.7
const BACKSTEP_FRAMES = 13
const BACKSTEP_MULT = 2.3
const DASH_CANCEL_AFTER = 5 // frames into the dash where a button may cancel

// --- collision regions ------------------------------------------------------
const HURT_HALF_W = 0.30 // shoulder width — keeps effective ranges close to the original frame data
const HIT_BAND = {
  high: [1.25, 2.05],
  mid: [0.60, 1.65],
  low: [0.00, 0.75],
}

export const emptyInput = () => ({
  moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false, dash: 0,
})

export function makeInput(o = {}) {
  return { ...emptyInput(), ...o }
}

function moveTotal(def) {
  return def.startup + def.active + def.recovery
}

// Shared read-only input for phases where nobody presses anything (intro, KO,
// round end, supers) — avoids two allocations per simulation tick.
const IDLE_INPUT = emptyInput()

/** Which reaction tier an attack produces — drives sim state AND the pose. */
export function reactionClass(def) {
  if (def.grab) return 'grab'
  if (def.height === 'low' && def.knockdown) return 'sweep'
  if (def.knockdown && def.launch >= 8) return 'launcher'
  if (def.knockdown) return 'heavy'
  if (def.damage >= 9) return 'medium'
  return 'light'
}

export class Fighter {
  constructor(side, char, x) {
    this.side = side
    this.char = char
    this.x = x
    this.xPrev = x
    this.y = 0
    this.prevY = 0
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
    this.reaction = 'light'
    this.walkDistance = 0
    this.nextFootstep = 0.7
    this.wantsSuper = false
    this.airAttackUsed = false
    this.downFrames = 0
    this.grounded = true
    this.flash = 0
    this.lastHitAt = -99
    this.vxTarget = 0
    this.vxMode = 'accel'
    this.contactLock = 0
    this.dashDir = 0
    this.dashFrames = 0
    // Character weight: heavier netas start and stop more slowly.
    this.moveAccel = 54 + (char.walkFwd - 2.2) * 12
    this.moveFriction = 44 + (char.walkFwd - 2.2) * 8
  }

  reset(x) {
    this.x = x
    this.xPrev = x
    this.y = 0
    this.prevY = 0
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
    this.reaction = 'light'
    this.walkDistance = 0
    this.nextFootstep = 0.7
    this.downFrames = 0
    this.grounded = true
    this.flash = 0
    this.vxTarget = 0
    this.vxMode = 'accel'
    this.contactLock = 0
    this.dashDir = 0
    this.dashFrames = 0
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
    this.attack = { def: MOVES[id], frame: 0, hasHit: false, swing: false }
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

  /** Double-tap burst forward (world direction `dir`). */
  startDash(dir) {
    this.forceState('dash')
    this.dashDir = dir
    this.dashFrames = DASH_FRAMES
    this.crouching = false
    this.attack = null
    this.vx = dir * this.char.walkFwd * DASH_MULT * 0.5
  }

  /** Double-tap hop backwards — fully invulnerable while it lasts. */
  startBackstep(dir) {
    this.forceState('backstep')
    this.dashDir = dir
    this.dashFrames = BACKSTEP_FRAMES
    this.crouching = false
    this.attack = null
    this.vx = dir * this.char.walkBack * BACKSTEP_MULT * 0.5
  }

  update(input, opponentX) {
    this.wantsSuper = false
    this.stateFrames++
    if (this.flash > 0) this.flash--
    if (this.contactLock > 0) this.contactLock--
    this.xPrev = this.x
    this.prevY = this.y

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

    // Default: physics-driven motion that decays to a stop (friction). States
    // that want scripted motion override these inside their case.
    this.vxMode = 'accel'
    this.vxTarget = 0

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
          this.attack = { def: MOVES[b === 'kick' ? 'airKick' : 'airPunch'], frame: 0, hasHit: false, swing: false }
          this.airAttackUsed = true
        }
        if (this.attack) this.attack.frame++
        break
      case 'dash':
        this.updateDash(toward)
        break
      case 'backstep':
        this.vxMode = 'script'
        this.vxTarget = this.dashDir * this.char.walkBack * BACKSTEP_MULT *
          Math.min(1, (BACKSTEP_FRAMES - this.dashFrames + 1) / 3)
        this.dashFrames--
        if (this.dashFrames <= 0) { this.facing = toward; this.enter('idle') }
        break
      case 'hitstun':
      case 'stagger':
        this.stun--
        if (this.stun <= 0) { this.facing = toward; this.enter('idle') }
        break
      case 'blockstun':
        this.holdingBack = input.moveX * this.facing < 0
        this.crouching = input.down
        this.stun--
        if (this.stun <= 0) this.enter(this.crouching ? 'crouch' : 'idle')
        break
      case 'knockdown':
        if (this.grounded) {
          this.downFrames++
          if (this.downFrames >= 48) this.enter('getup')
        }
        break
      case 'getup':
        this.vx = 0
        if (this.stateFrames >= 24) { this.facing = toward; this.enter('idle') }
        break
      case 'ko':
        // air-flight is handled by integrate(); nothing to do
        break
    }
    this.integrate()
  }

  updateDash(toward) {
    const rel = this.dashDir * this.facing
    this.vxMode = 'script'
    const ramp = Math.min(1, (DASH_FRAMES - this.dashFrames + 1) / 3)
    this.vxTarget = this.dashDir * this.char.walkFwd * DASH_MULT * ramp
    // Dash-cancel: buttons become live after the burst is committed.
    if (this.dashFrames <= DASH_FRAMES - DASH_CANCEL_AFTER) {
      const b = this.consumeBuffer()
      if (b) { this.startAttack(pickMove(b, false, rel > 0)); return }
    }
    this.dashFrames--
    if (this.dashFrames <= 0) { this.facing = toward; this.enter('idle') }
  }

  updateActionable(input, toward) {
    this.facing = toward
    const rel = input.moveX * this.facing
    this.moveRel = rel
    this.holdingBack = rel < 0

    // Double-tap burst / hop, only on the ground and only from a neutral state.
    if (input.dash && this.grounded) {
      if (input.dash * toward < 0) this.startBackstep(input.dash)
      else this.startDash(input.dash)
      return
    }

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
    if (this.crouching) { this.enter('crouch'); return }
    if (rel === 0) { this.enter('idle'); return }
    this.enter('walk')
    this.vxTarget = rel > 0 ? this.char.walkFwd * this.facing : -this.char.walkBack * this.facing
  }

  /**
   * Forward motion of an attack is scheduled to the CONTACT frames:
   *   anticipation (startup)  -> pull back, load the hips
   *   contact (active)        -> explosive travel of `lunge` world units
   *   recovery                -> hand back to friction (follow-through slide)
   */
  updateAttack() {
    const a = this.attack
    if (!a) { this.enter('idle'); return }
    a.frame++
    const def = a.def
    const activeEnd = def.startup + def.active

    if (this.contactLock > 0) {
      // A blow met with resistance: stop driving forward and let friction
      // absorb the recoil so the body visibly checks its momentum.
      this.vxMode = 'accel'
      this.vxTarget = 0
    } else if (a.frame <= activeEnd) {
      this.vxMode = 'script'
      this.vxTarget = attackForwardVelocity(def, a.frame) * this.facing
    } else {
      this.vxMode = 'accel'
      this.vxTarget = 0
    }

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
    if (wasAir) this.vy -= GRAVITY * DT

    if (this.vxMode === 'script') {
      this.vx = this.vxTarget
    } else {
      const grounded = this.grounded && !wasAir
      const desired = this.vxTarget
      const reversing = desired !== 0 && this.vx !== 0 && desired * this.vx < 0
      if (desired === 0 || (reversing && grounded)) {
        // Stopping, or changing direction on the ground: lose grip first (skid).
        const f = wasAir ? FRICTION_AIR
          : (this.contactLock > 0 ||
             this.state === 'hitstun' || this.state === 'stagger' ||
             this.state === 'knockdown' || this.state === 'ko' || this.state === 'blockstun')
            ? FRICTION_STUN : this.moveFriction
        const step = f * DT
        if (Math.abs(this.vx) <= step) this.vx = 0
        else this.vx -= Math.sign(this.vx) * step
      } else {
        const a = wasAir ? MOVE_ACCEL_AIR : this.moveAccel
        const max = a * DT
        const dv = desired - this.vx
        this.vx += dv > max ? max : (dv < -max ? -max : dv)
      }
    }

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
    if (this.state === 'jump') {
      this.attack = null
      this.vx *= 0.35 // carry momentum into the landing instead of freezing
      this.enter('idle')
    } else if (this.state === 'hitstun' || this.state === 'stagger') {
      this.vx *= 0.5
    }
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

    const cls = reactionClass(def)
    this.reaction = cls

    if (this.hp <= 0) {
      this.reaction = 'ko'
      this.knockOut(dir, 3.4, 6.5, wasActive)
      return
    }
    if (def.knockdown || this.airborne) {
      this.forceState('knockdown')
      this.vx = dir * (def.push + 0.8)
      this.vy = def.knockdown ? Math.max(def.launch, 4.2) : Math.max(2.4, def.launch)
      this.downFrames = 0
      this.grounded = false
    } else if (cls === 'medium') {
      // Lose balance: visible stagger instead of a flat recoil.
      this.forceState('stagger')
      this.stun = def.hitstun
      this.vx = dir * def.push * 1.15
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

/**
 * Forward velocity (world units/s) for an attack frame — the whole point is that
 * the body travels during CONTACT, not during anticipation.
 * Total displacement over the active window ≈ `def.lunge`.
 */
export const LUNGE_SCALE = 0.28 // `lunge` (legacy velocity units) -> world travel

export function attackForwardVelocity(def, frame) {
  // World-distance the body travels across the contact window.
  const dist = def.lunge * LUNGE_SCALE
  const anti = dist * 0.15
  const startup = Math.max(1, def.startup)
  if (frame <= def.startup) {
    // Anticipation: a fixed, small load backwards over the whole wind-up.
    return -anti / (startup * DT)
  }
  const N = Math.max(1, def.active)
  const k = 0.6 // profile keeps some motion at the last active frame, so the
                // hand-off into recovery friction is continuous (no hard stop).
  const denom = N - (k * (N + 1)) / 2
  const norm = denom > 0.0001 ? N / denom : 1
  const p = Math.min(1, (frame - def.startup) / N)
  // normalised so Σ travel over the active window === dist exactly
  return (dist * norm * (1 - k * p)) / (N * DT)
}

/** 2-D collision regions: hitbox ∩ hurtbox, both in world space. */
function hurtBox(defender) {
  const hw = HURT_HALF_W
  if (defender.airborne && defender.y > 0.02) {
    return { x: defender.x, hw, y0: 0.35 + defender.y, y1: 1.90 + defender.y }
  }
  if (defender.isLow) return { x: defender.x, hw, y0: 0.02, y1: 1.10 }
  return { x: defender.x, hw, y0: 0.02, y1: 1.86 }
}

function hitBox(attacker) {
  const def = attacker.attack.def
  const dir = attacker.facing
  const band = HIT_BAND[def.height] || HIT_BAND.mid
  const oy = def.air ? attacker.y : 0
  const a = attacker.x
  const b = attacker.x + dir * Math.max(0.2, def.reach)
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: band[0] + oy, y1: band[1] + oy }
}

export function canHit(attacker, defender) {
  const a = attacker.attack
  if (!a || a.hasHit || !attacker.isAttackActive || defender.invulnerable) return false
  // must be in front of the attacker
  const rel = (defender.x - attacker.x) * attacker.facing
  if (rel < -0.15) return false
  if (a.def.grab && (defender.state === 'hitstun' || defender.airborne || defender.y > 0.01)) return false

  const hb = hitBox(attacker)
  const hurt = hurtBox(defender)
  if (hb.x1 < hurt.x - hurt.hw || hb.x0 > hurt.x + hurt.hw) return false
  if (hb.y1 < hurt.y0 || hb.y0 > hurt.y1) return false
  return true
}

export function isBlocked(defender, height) {
  if (!defender.canBlock || !defender.holdingBack || defender.airborne) return false
  if (defender.crouching) return height === 'low' || height === 'mid'
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
      this.fighters[0].update(IDLE_INPUT, this.fighters[1].x)
      this.fighters[1].update(IDLE_INPUT, this.fighters[0].x)
      return
    }

    if (this.phase === 'ko') {
      this.slowMo = Math.max(0, this.slowMo - dt)
      this.fighters[0].update(IDLE_INPUT, this.fighters[1].x)
      this.fighters[1].update(IDLE_INPUT, this.fighters[0].x)
      if (this.phaseTime > 2.2) this.finishRound()
      return
    }

    if (this.phase === 'super') {
      this.super.t += dt
      this.fighters[0].update(IDLE_INPUT, this.fighters[1].x)
      this.fighters[1].update(IDLE_INPUT, this.fighters[0].x)
      if (this.super.t >= this.super.duration) this.resolveSuper()
      return
    }

    if (this.phase === 'roundEnd') {
      this.fighters[0].update(IDLE_INPUT, this.fighters[1].x)
      this.fighters[1].update(IDLE_INPUT, this.fighters[0].x)
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
    const before = [a.state, b.state]
    const beforeGrounded = [a.grounded, b.grounded]

    a.update(inputs[0], b.x)
    b.update(inputs[1], a.x)

    if (a.wantsSuper) return this.startSuper(0)
    if (b.wantsSuper) return this.startSuper(1)

    // Face each other while neutral
    for (const f of this.fighters) {
      if (f.actionable) f.facing = (f.side === 0 ? b.x >= a.x : a.x >= b.x) ? 1 : -1
    }

    // Audio cues tied to actual state transitions, not guessed elsewhere.
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i]
      const st = before[i]
      if (f.state !== st) {
        if (f.state === 'dash') this.emit({ type: 'dash', side: i })
        else if (f.state === 'backstep') this.emit({ type: 'dodge', side: i })
      }
      if (f.grounded && !beforeGrounded[i] && st === 'jump') this.emit({ type: 'land', side: i })
      if (f.state === 'walk' && f.walkDistance >= f.nextFootstep) {
        f.nextFootstep = f.walkDistance + 0.85
        this.emit({ type: 'step', side: i })
      }
      const at = f.attack
      if (at && at.frame === 0 && !at.swing) {
        at.swing = true
        this.emit({ type: 'swing', side: i, id: at.def.id, damage: at.def.damage })
      }
    }

    // Push boxes: clamp-aware separation. Each fighter moves away from the
    // midpoint; if a wall stops one, the other makes up the whole gap. Repeated
    // until stable so fast lunges/knock-back can never overlap (invariant test).
    const minGap = 0.82
    const W = ARENA_HALF_WIDTH
    for (let pass = 0; pass < 3; pass++) {
      const dx = b.x - a.x
      if (Math.abs(dx) >= minGap) break
      const dir = dx === 0 ? (a.side === 0 ? 1 : -1) : Math.sign(dx)
      const midP = (a.x + b.x) / 2
      let A = Math.max(-W, Math.min(W, midP - dir * minGap * 0.5))
      let B = Math.max(-W, Math.min(W, midP + dir * minGap * 0.5))
      if (B - A < minGap) {
        B = Math.min(W, A + minGap)
        if (B - A < minGap) A = Math.max(-W, B - minGap)
      }
      a.x = A
      b.x = B
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
      attacker.contactLock = 8
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
      attacker.contactLock = 7
      attacker.vx = -dir * a.def.push * 0.7
      this.emit({ type: 'block', side: attacker.side, x: hitX, y: hitY, height })
      this.hitStop = 4
      return
    }

    const dmg = damageAfterScaling(attacker, defender, a.def.damage)
    const cls = reactionClass(a.def)
    defender.applyHit(a.def, dmg, dir)
    attacker.addMeter(dmg * 0.9 + 2)
    defender.addMeter(dmg * 0.6)
    // The attacking body checks against the resistance it just met.
    attacker.contactLock = 8
    attacker.vx = -dir * a.def.push * 0.9

    const heavy = cls === 'heavy' || cls === 'launcher' || cls === 'sweep'
    this.emit({
      type: 'hit', side: attacker.side,
      move: attacker.char.moveNames[a.def.id] || (a.def.id === 'skyUppercut' ? (attacker.char.moveNames.uppercut || 'SKY UPPERCUT!') : (MOVE_LABELS[a.def.id] || 'HIT!')),
      x: hitX, y: hitY, damage: dmg, knockdown: defender.state === 'knockdown',
      ko: defender.state === 'ko', height, combo: defender.comboHits,
      reaction: cls, heavy, id: a.def.id,
    })
    // Impact weight: how long the world holds its breath, per attack class.
    this.hitStop = defender.state === 'ko' ? 15
      : cls === 'launcher' ? 11
        : cls === 'heavy' || cls === 'sweep' ? 9
          : cls === 'medium' ? 7 : 5
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
