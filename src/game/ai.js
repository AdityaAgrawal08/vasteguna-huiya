import { makeInput } from './engine.js'

const DIFFICULTY = {
  easy: { think: 20, block: 0.28, aggression: 0.38, special: 0.12, jump: 0.04, super: 0.35, reaction: 16 },
  normal: { think: 12, block: 0.55, aggression: 0.6, special: 0.24, jump: 0.07, super: 0.7, reaction: 10 },
  hard: { think: 7, block: 0.8, aggression: 0.8, special: 0.4, jump: 0.1, super: 1.0, reaction: 5 },
}

export class CPU {
  constructor(match, side = 1, difficulty = 'normal') {
    this.match = match
    this.side = side
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal
    this.plan = []
    this.planTimer = 0
    this.thinkTimer = 0
    this.holdBack = 0
    this.input = makeInput()
    this.rng = Math.random
    this.lastOpponentAttack = null
    this.blockUntil = 0
  }

  get me() { return this.match.fighters[this.side] }
  get foe() { return this.match.fighters[1 - this.side] }

  update() {
    const me = this.me
    const foe = this.foe
    const input = makeInput()
    const dist = Math.abs(foe.x - me.x)
    const toward = foe.x >= me.x ? 1 : -1

    if (me.state === 'super' || me.state === 'ko' || this.match.phase === 'super') return input
    if (this.match.phase !== 'fight') return input

    // React to incoming attacks with a guard.
    if (foe.attack && foe.attackPhase !== 'recovery' && dist < 2.4) {
      if (this.rng() < this.cfg.block * 0.35) this.blockUntil = Math.max(this.blockUntil, 14)
    }
    if (this.blockUntil > 0) {
      this.blockUntil--
      input.moveX = -toward
      if (foe.attack && foe.attack.def.height === 'low') input.down = true
      return input
    }

    if (me.meter >= 100 && this.rng() < this.cfg.super * 0.06) {
      input.super = true
      return input
    }

    this.thinkTimer--
    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.cfg.think + Math.floor(this.rng() * this.cfg.think)
      this.decide(dist, toward, foe)
    }

    // Execute current plan.
    if (this.plan.length) {
      const step = this.plan[0]
      if (step.at <= 0) {
        Object.assign(input, step.input)
        this.plan.shift()
      } else {
        step.at--
      }
    }

    // Basic spacing/approach when idle.
    if (!this.plan.length && !input.punch && !input.kick && !input.grab) {
      if (dist > 1.7) {
        input.moveX = toward
      } else if (dist < 1.2 && this.rng() < 0.02) {
        input.moveX = -toward
      } else if (this.rng() < 0.01) {
        input.moveX = -toward
      }
    }

    return input
  }

  decide(dist, toward, foe) {
    const r = this.rng()
    const cfg = this.cfg

    // Far away: close the gap, occasionally jump in.
    if (dist > 3.0) {
      if (r < 0.16 * cfg.jump) {
        this.plan = [
          { at: 0, input: { moveX: toward } },
          { at: 6, input: { up: true, moveX: toward } },
          { at: 14, input: { kick: true, moveX: toward } },
        ]
      } else {
        this.plan = [{ at: 0, input: { moveX: toward } }]
      }
      return
    }

    // Mid range: walk in; only poke when the long kick can actually reach.
    if (dist > 1.55) {
      if (r < cfg.block * 0.16) { this.blockUntil = 14; return }
      if (dist < 1.85 && r < 0.4 * cfg.aggression) {
        this.plan = [
          { at: 0, input: { moveX: toward } },
          { at: 4, input: { moveX: toward, kick: true } },
        ]
      } else {
        this.plan = [{ at: 0, input: { moveX: toward } }]
      }
      return
    }

    // Close range: only use attacks that can actually reach.
    if (r < cfg.block * 0.14) { this.blockUntil = 14; return }

    if (dist > 1.15) {
      if (r < cfg.special * 0.8) {
        // special2: forward + kick (reach 1.55)
        this.plan = [{ at: 0, input: { moveX: toward, kick: true } }]
      } else if (r < cfg.special * 1.05) {
        // sweep (reach 1.4, low)
        this.plan = [
          { at: 0, input: { down: true } },
          { at: 3, input: { down: true, kick: true } },
        ]
      } else if (r < cfg.special * 1.25) {
        this.plan = [{ at: 0, input: { grab: true } }]
      } else if (r < 0.82) {
        this.plan = [
          { at: 0, input: { kick: true } },
          { at: 14, input: { kick: true } },
        ]
      } else {
        this.plan = [{ at: 0, input: { moveX: toward } }]
      }
      return
    }

    // Point blank.
    if (r < cfg.special * 0.55) {
      this.plan = [{ at: 0, input: { moveX: toward, punch: true } }]
    } else if (r < cfg.special * 0.8) {
      const combo = Math.floor(this.rng() * 3)
      if (combo === 0) {
        this.plan = [
          { at: 0, input: { punch: true } },
          { at: 10, input: { punch: true } },
          { at: 10, input: { punch: true } },
        ]
      } else if (combo === 1) {
        this.plan = [
          { at: 0, input: { punch: true } },
          { at: 10, input: { punch: true } },
          { at: 10, input: { kick: true } },
        ]
      } else {
        this.plan = [
          { at: 0, input: { kick: true } },
          { at: 14, input: { kick: true } },
        ]
      }
    } else if (r < cfg.special * 1.0) {
      this.plan = [
        { at: 0, input: { down: true } },
        { at: 3, input: { down: true, kick: true } },
      ]
    } else if (r < cfg.special * 1.18) {
      this.plan = [{ at: 0, input: { grab: true } }]
    } else if (r < 0.9) {
      this.plan = [
        { at: 0, input: { punch: true } },
        { at: 10, input: { punch: true } },
      ]
    } else {
      this.plan = [{ at: 0, input: { moveX: -toward } }]
    }
  }
}
