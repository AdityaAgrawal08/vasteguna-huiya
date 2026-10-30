import { makeInput } from './engine.js'

// Difficulty profiles. `reaction` is the number of frames the CPU is allowed to
// spend noticing an incoming attack before it commits to a response — lower is
// faster and therefore harder. Everything else tunes appetite, not cheating.
const DIFFICULTY = {
  easy: { think: 24, block: 0.45, aggression: 0.38, special: 0.12, jump: 0.04, super: 0.35, reaction: 18, dodge: 0.12, punish: 0.3 },
  normal: { think: 15, block: 0.72, aggression: 0.6, special: 0.24, jump: 0.07, super: 0.7, reaction: 11, dodge: 0.28, punish: 0.62 },
  hard: { think: 9, block: 0.9, aggression: 0.82, special: 0.4, jump: 0.1, super: 1.0, reaction: 6, dodge: 0.45, punish: 0.88 },
}

// Ranges the CPU tries to hold (just outside a whiffing kick, inside a jab).
const PREFERRED_RANGE = 1.5
const PUNISH_RANGE = 1.45

function planSignature(plan) {
  let sig = ''
  for (const s of plan) {
    const i = s.input || {}
    sig += `${s.at}${i.moveX ? 'M' : ''}${i.down ? 'D' : ''}${i.up ? 'U' : ''}${i.punch ? 'P' : ''}${i.kick ? 'K' : ''}${i.grab ? 'G' : ''}|`
  }
  return sig
}

/**
 * The opponent plays by exactly the same rules as the player: it must wait out
 * recovery, cannot act out of stun, and its only advantages are a reaction
 * budget (difficulty) and never taking its hands off the keyboard.
 */
export class CPU {
  constructor(match, side = 1, difficulty = 'normal') {
    this.match = match
    this.side = side
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal
    this.plan = []
    this.thinkTimer = 0
    this.rng = Math.random
    this.blockUntil = 0
    this.blockCrouch = false
    this.threat = null
    this.reactFrames = 0
    this.reacted = null
    this.punished = null
    this.retreat = 0
    this.prevState = 'idle'
    this.lastSig = ''
    this.lastMove = null
    this.guardHold = 0
    // reused every frame so the CPU allocates nothing in the loop
    this.input = makeInput()
  }

  get me() { return this.match.fighters[this.side] }
  get foe() { return this.match.fighters[1 - this.side] }

  _reset(out) {
    const i = out || this.input
    i.moveX = 0
    i.up = false
    i.down = false
    i.punch = false
    i.kick = false
    i.grab = false
    i.super = false
    i.dash = 0
    return i
  }

  update(out) {
    const me = this.me
    const foe = this.foe
    const input = this._reset(out)
    const dist = Math.abs(foe.x - me.x)
    const toward = foe.x >= me.x ? 1 : -1

    if (this.match.phase !== 'fight') return input
    if (me.state === 'super' || me.state === 'ko' || me.state === 'backstep' || me.state === 'dash') {
      this.prevState = me.state
      return input
    }

    // Holding a guard carries through the blockstun frames.
    if (me.state === 'blockstun') {
      input.moveX = -toward
      input.down = this.blockCrouch
      this.prevState = me.state
      return input
    }

    // Committed defensive hold (reaction already chosen).
    if (this.blockUntil > 0) {
      this.blockUntil--
      input.moveX = -toward
      if (foe.attack && foe.attack.def.height === 'low') input.down = true
      else input.down = this.blockCrouch
      this.prevState = me.state
      return input
    }

    // Recovering from damage: no decisions, only natural behaviour.
    if (!me.actionable && me.state !== 'attack') {
      this.plan = []
      this.threat = null
      this.prevState = me.state
      return input
    }

    // Just got up / recovered: give ground before re-engaging.
    if ((this.prevState === 'hitstun' || this.prevState === 'stagger' ||
         this.prevState === 'knockdown' || this.prevState === 'getup') &&
        (me.state === 'idle' || me.state === 'walk')) {
      this.retreat = 16 + Math.floor(this.rng() * 10)
      this.plan = []
    }
    this.prevState = me.state

    if (this.retreat > 0) {
      this.retreat--
      input.moveX = -toward
      return input
    }

    // --- react to an attack that is winding up or already swinging ----------
    if (foe.attack && foe.attackPhase !== 'recovery') {
      if (this.react(dist, toward, foe, input)) { return input }
    } else {
      this.threat = null
      this.reacted = null
    }

    // --- punish a whiff: the foe is stuck in recovery and inside our range ----
    if (foe.state === 'attack' && foe.attack && foe.attackPhase === 'recovery') {
      if (dist <= PUNISH_RANGE && this.rng() < this.cfg.punish) {
        this.punish(dist, toward)
        this.retreat = 0
      }
    }
    if (foe.state === 'knockdown' && dist < PUNISH_RANGE && this.rng() < 0.06) {
      // okizeme: walk in while they are down
      this.plan = [{ at: 0, input: { moveX: toward } }]
    }

    if (me.meter >= 100 && this.rng() < this.cfg.super * 0.05) {
      input.super = true
      return input
    }

    this.thinkTimer--
    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.cfg.think + Math.floor(this.rng() * this.cfg.think)
      if (!this.plan.length) this.decide(dist, toward, foe)
    }

    if (this.plan.length) {
      const step = this.plan[0]
      if (step.at <= 0) {
        Object.assign(input, step.input)
        this.plan.shift()
      } else {
        step.at--
      }
    }

    // Neutral spacing: hold the preferred range, never look parked.
    if (!this.plan.length && !input.punch && !input.kick && !input.grab) {
      if (this.guardHold > 0) {
        // Deliberate defensive stance: standing guard (which passively blocks).
        this.guardHold--
        input.moveX = -toward
      } else if (dist > PREFERRED_RANGE) {
        input.moveX = toward
        if (this.rng() < 0.035) this.guardHold = 10 + Math.floor(this.rng() * 14)
      } else if (dist < PREFERRED_RANGE - 0.7) {
        input.moveX = -toward
      } else if (this.rng() < 0.03) {
        // micro-step: stay in measure instead of freezing
        input.moveX = this.rng() < 0.5 ? toward : -toward
      }
    }

    return input
  }

  /**
   * Look at the incoming attack and commit to one response. Returns true when a
   * response has been chosen this frame so the caller stops thinking.
   */
  react(dist, toward, foe, input) {
    const a = foe.attack
    const def = a.def
    if (this.threat !== a) { this.threat = a; this.reactFrames = this.cfg.reaction }
    if (this.reactFrames > 0) { this.reactFrames--; return false }
    if (this.reacted === a) return false

    const reach = def.reach + 0.4
    if (dist > reach) return false // it cannot reach us
    this.reacted = a

    const r = this.rng()
    // Guard is the default answer; dodging is the riskier, higher-skill one.
    if (r < this.cfg.block) {
      this.blockUntil = def.startup + def.active + 5
      this.blockCrouch = def.height === 'low'
      input.moveX = -toward // guard starts THIS frame, not the next
      input.down = this.blockCrouch
      return true
    }
    if (r < this.cfg.block + this.cfg.dodge) {
      input.dash = -toward // back-step hop with i-frames
      return true
    }
    return false
  }

  punish(dist, toward) {
    if (this.punished === this.foe.attack) return
    this.punished = this.foe.attack
    if (dist < 1.1) {
      this.plan = [
        { at: 0, input: { punch: true } },
        { at: 9, input: { punch: true } },
        { at: 9, input: { kick: true } },
      ]
      this.lastMove = 'jab'
    } else if (dist < 1.45) {
      this.plan = [{ at: 0, input: { kick: true } }]
      this.lastMove = 'kick'
    } else {
      this.plan = [
        { at: 0, input: { moveX: toward } },
        { at: 4, input: { moveX: toward, kick: true } },
      ]
      this.lastMove = 'special2'
    }
  }

  decide(dist, toward, foe) {
    for (let attempt = 0; attempt < 2; attempt++) {
      this._decideOnce(dist, toward, foe)
      const sig = planSignature(this.plan)
      if (sig && sig !== this.lastSig) { this.lastSig = sig; return }
      if (!sig) return
      // identical to the last decision: roll again so it never repeats forever
    }
    this.lastSig = planSignature(this.plan)
  }

  _decideOnce(dist, toward, foe) {
    const r = this.rng()
    const cfg = this.cfg

    // ---- far: close the gap, sometimes with a burst ----
    if (dist > 3.0) {
      if (r < 0.22) {
        this.plan = [{ at: 0, input: { dash: toward } }] // forward burst
      } else if (r < 0.22 + 0.12 * cfg.jump) {
        this.plan = [
          { at: 0, input: { up: true, moveX: toward } },
          { at: 12, input: { kick: true, moveX: toward } },
        ]
      } else {
        this.plan = [{ at: 0, input: { moveX: toward } }]
      }
      return
    }

    // ---- mid: only poke with something that can actually reach ----
    if (dist > 1.55) {
      if (r < cfg.block * 0.12) { this.blockUntil = 14; this.blockCrouch = false; return }
      if (dist < 1.9 && r < 0.42 * cfg.aggression) {
        this.plan = [
          { at: 0, input: { moveX: toward } },
          { at: 4, input: { moveX: toward, kick: true } },
        ]
        this.lastMove = 'special2'
      } else {
        this.plan = [{ at: 0, input: { moveX: toward } }]
      }
      return
    }

    // ---- close ----
    if (r < cfg.block * 0.12) { this.blockUntil = 15; this.blockCrouch = false; return }

    if (dist > 1.15) {
      if (r < cfg.special * 0.8) {
        this.plan = [{ at: 0, input: { moveX: toward, kick: true } }] // special2
        this.lastMove = 'special2'
      } else if (r < cfg.special * 1.05) {
        this.plan = [
          { at: 0, input: { down: true } },
          { at: 3, input: { down: true, kick: true } },
        ]
        this.lastMove = 'sweep'
      } else if (r < cfg.special * 1.25) {
        this.plan = [{ at: 0, input: { grab: true } }]
        this.lastMove = 'grab'
      } else if (r < 0.8) {
        this.plan = [
          { at: 0, input: { kick: true } },
          { at: 14, input: { kick: true } },
        ]
        this.lastMove = 'kick'
      } else {
        this.plan = [{ at: 0, input: { moveX: -toward } }]
      }
      return
    }

    // point blank
    if (r < cfg.special * 0.55) {
      this.plan = [{ at: 0, input: { moveX: toward, punch: true } }] // special1
      this.lastMove = 'special1'
    } else if (r < cfg.special * 0.78) {
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
      this.lastMove = 'chain'
    } else if (r < cfg.special * 1.0) {
      this.plan = [
        { at: 0, input: { down: true } },
        { at: 3, input: { down: true, punch: true } },
      ]
      this.lastMove = 'skyUppercut'
    } else if (r < cfg.special * 1.2) {
      this.plan = [{ at: 0, input: { grab: true } }]
      this.lastMove = 'grab'
    } else if (r < 0.9) {
      this.plan = [
        { at: 0, input: { punch: true } },
        { at: 10, input: { punch: true } },
      ]
      this.lastMove = 'jab'
    } else {
      this.plan = [{ at: 0, input: { moveX: -toward } }]
    }
  }
}
