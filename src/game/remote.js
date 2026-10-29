import { CHARACTERS, MOVES } from './data.js'

function remoteFighter(side, charId) {
  return {
    side,
    char: CHARACTERS[charId] || CHARACTERS.modi,
    x: side === 0 ? -2.6 : 2.6,
    y: 0, vx: 0, vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: 100, meter: 0,
    state: 'idle', stateFrames: 0,
    attack: null, crouching: false, holdingBack: false,
    stun: 0, comboHits: 0, flash: 0, grounded: true,
  }
}

/** A Match-shaped object fed by authoritative server snapshots. */
export function createRemoteMatch({ p1, p2, stage }) {
  return {
    stage,
    net: true,
    fighters: [remoteFighter(0, p1), remoteFighter(1, p2)],
    wins: [0, 0],
    round: 1,
    timer: 60,
    phase: 'intro',
    phaseTime: 0,
    timeUp: false,
    slowMo: 0,
    matchOver: false,
    winner: null,
    perfect: false,
    super: null,
    _events: [],
    drainEvents() { const e = this._events; this._events = []; return e },
    pushEvents(events) { if (Array.isArray(events)) this._events.push(...events) },
    step() {},
  }
}

export function applySnapshot(match, snap) {
  if (!match || !snap) return
  match.phase = snap.phase
  match.timer = snap.timer
  match.wins = snap.wins
  match.round = snap.round
  match.matchOver = snap.matchOver
  match.winner = snap.winner
  match.slowMo = snap.slowMo
  match.phaseTime = snap.phaseTime
  match.timeUp = snap.timeUp
  match.perfect = !!snap.perfect
  match.super = snap.super
  for (let i = 0; i < 2; i++) {
    const f = match.fighters[i]
    const s = snap.fighters[i]
    if (!s) continue
    if (s.id !== f.char.id) f.char = CHARACTERS[s.id] || f.char
    f.x = s.x; f.y = s.y; f.vx = s.vx; f.vy = s.vy; f.facing = s.facing
    f.hp = s.hp; f.meter = s.meter; f.state = s.state; f.stateFrames = s.stateFrames
    f.crouching = s.crouching; f.holdingBack = s.holdingBack; f.stun = s.stun
    f.comboHits = s.comboHits; f.flash = s.flash; f.grounded = s.grounded
    f.attack = s.attack ? { def: MOVES[s.attack.id], frame: s.attack.frame, hasHit: s.attack.hasHit } : null
  }
}
