// Authoritative friend-room server for Sansad Showdown.
//
// A room is a tiny relay + simulation host: both browsers send their input at
// 60 Hz, the server runs the same deterministic Match used by CPU mode and
// broadcasts snapshots (plus events) at 20 Hz. This keeps the two clients in
// sync without trusting either one to host the fight.

import { WebSocketServer } from 'ws'
import { Match, makeInput, DT } from '../src/game/engine.js'
import { CHARACTERS, STAGES } from '../src/game/data.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_ROOMS = 500
const rooms = new Map()

function code() {
  for (;;) {
    let out = ''
    for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    if (!rooms.has(out)) return out
  }
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }
}

function broadcast(room, msg) {
  send(room.host, msg)
  send(room.guest, msg)
}

function roomState(room) {
  return {
    t: 'room',
    code: room.code,
    hostChar: room.picks[0],
    guestChar: room.picks[1],
    stage: room.stage,
    hostReady: room.ready[0],
    guestReady: room.ready[1],
    started: !!room.match,
    over: !!room.over,
  }
}

function sanitizeInput(input) {
  const out = makeInput()
  if (!input || typeof input !== 'object') return out
  out.moveX = Math.max(-1, Math.min(1, Number(input.moveX) || 0))
  for (const k of ['up', 'down', 'punch', 'kick', 'grab', 'super']) out[k] = !!input[k]
  return out
}

function serialize(room) {
  const m = room.match
  const events = room.pendingEvents
  room.pendingEvents = []
  return {
    t: 'snap',
    phase: m.phase,
    timer: m.timer,
    wins: [...m.wins],
    round: m.round,
    matchOver: m.matchOver,
    winner: m.winner,
    slowMo: m.slowMo,
    phaseTime: m.phaseTime,
    timeUp: m.timeUp,
    perfect: m.perfect,
    super: m.super ? {
      side: m.super.side, charId: m.super.charId, name: m.super.name,
      t: m.super.t, duration: m.super.duration,
    } : null,
    fighters: m.fighters.map((f) => ({
      id: f.char.id,
      x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing,
      hp: f.hp, meter: f.meter, state: f.state, stateFrames: f.stateFrames,
      crouching: f.crouching, holdingBack: f.holdingBack, stun: f.stun,
      comboHits: f.comboHits, flash: f.flash, grounded: f.grounded,
      attack: f.attack ? { id: f.attack.def.id, frame: f.attack.frame, hasHit: f.attack.hasHit } : null,
    })),
    events,
  }
}

function startMatch(room) {
  const p1 = room.picks[0]
  const p2 = room.picks[1]
  if (!p1 || !p2) return
  if (room.interval) clearInterval(room.interval)
  room.match = new Match({ p1, p2, stage: room.stage, difficulty: 'normal' })
  room.inputs = [makeInput(), makeInput()]
  room.moveState = [makeInput(), makeInput()]
  room.pressQueue = [[], []]
  room.pendingEvents = []
  room.ready = [false, false]
  room.over = false
  room.tick = 0
  room.match.start()
  broadcast(room, { t: 'start', p1, p2, stage: room.stage })
  broadcast(room, roomState(room))
  room.interval = setInterval(() => {
    if (!room.match) return
    const m = room.match
    const nextInput = (side) => {
      const input = { ...makeInput(), ...room.moveState[side] }
      const press = room.pressQueue[side].shift()
      if (press) Object.assign(input, press)
      return input
    }
    m.step([nextInput(0), nextInput(1)], DT)
    const events = m.drainEvents()
    if (events.length) room.pendingEvents.push(...events)
    room.tick++
    if (room.tick % 2 === 0 || m.matchOver || events.length) {
      broadcast(room, serialize(room))
    }
    if (m.matchOver && !room.over) {
      room.over = true
      clearInterval(room.interval)
      room.interval = null
      broadcast(room, serialize(room))
      broadcast(room, roomState(room))
    }
  }, 1000 / 60)
}

function leaveRoom(ws, notify = true) {
  const room = ws.room
  if (!room) return
  ws.room = null
  if (room.interval) { clearInterval(room.interval); room.interval = null }
  const other = room.host === ws ? room.guest : room.host
  rooms.delete(room.code)
  if (notify && other) {
    send(other, { t: 'peerLeft' })
    other.room = null
  }
  if (room.host === ws) room.host = null
  if (room.guest === ws) room.guest = null
}

export function attachRoomServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })
  const onUpgrade = (req, socket, head) => {
    let pathname = ''
    try { pathname = new URL(req.url, 'http://localhost').pathname } catch { return }
    if (pathname !== '/ws') return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  }
  httpServer.on('upgrade', onUpgrade)
  wss.on('close', () => httpServer.off('upgrade', onUpgrade))
  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (!msg || typeof msg.t !== 'string') return

      if (msg.t === 'create') {
        if (rooms.size >= MAX_ROOMS) { send(ws, { t: 'error', error: 'Server is full' }); return }
        leaveRoom(ws)
        const room = {
          code: code(), host: ws, guest: null, picks: [null, null], stage: 'sansad',
          ready: [false, false], match: null, inputs: [makeInput(), makeInput()],
          moveState: [makeInput(), makeInput()], pressQueue: [[], []],
          pendingEvents: [], interval: null, tick: 0, over: false,
        }
        ws.side = 0
        ws.room = room
        rooms.set(room.code, room)
        send(ws, { t: 'created', code: room.code, side: 0 })
        return
      }

      if (msg.t === 'join') {
        const room = rooms.get(String(msg.code || '').toUpperCase())
        if (!room) { send(ws, { t: 'error', error: 'Room not found. Check the code.' }); return }
        if (room.guest) { send(ws, { t: 'error', error: 'That room is already full.' }); return }
        leaveRoom(ws)
        room.guest = ws
        ws.side = 1
        ws.room = room
        send(ws, { t: 'joined', code: room.code, side: 1 })
        send(room.host, { t: 'joined', code: room.code, side: 0 })
        broadcast(room, roomState(room))
        return
      }

      const room = ws.room
      if (!room) return

      if (msg.t === 'pick') {
        const side = ws.side
        const id = String(msg.char || '')
        if (CHARACTERS[id]) {
          if (side === 0) room.picks[0] = id
          else room.picks[1] = id
        }
        if (side === 0 && STAGES[msg.stage]) room.stage = msg.stage
        broadcast(room, roomState(room))
        return
      }

      if (msg.t === 'stage') {
        if (ws.side === 0 && STAGES[msg.stage]) {
          room.stage = msg.stage
          broadcast(room, roomState(room))
        }
        return
      }

      if (msg.t === 'ready') {
        if (room.match && !room.over) return
        room.ready[ws.side] = true
        broadcast(room, roomState(room))
        if (room.ready[0] && room.ready[1] && room.picks[0] && room.picks[1]) startMatch(room)
        return
      }

      if (msg.t === 'rematch') {
        if (!room.over) return
        room.ready[ws.side] = true
        broadcast(room, roomState(room))
        if (room.ready[0] && room.ready[1]) startMatch(room)
        return
      }

      if (msg.t === 'input') {
        if (room.match && !room.over) {
          const side = ws.side
          const input = sanitizeInput(msg.input)
          room.moveState[side] = {
            ...makeInput(),
            moveX: input.moveX, up: input.up, down: input.down,
          }
          const press = {}
          let any = false
          for (const k of ['punch', 'kick', 'grab', 'super']) {
            if (input[k]) { press[k] = true; any = true }
          }
          if (any) {
            room.pressQueue[side].push(press)
            if (room.pressQueue[side].length > 10) room.pressQueue[side].shift()
          }
        }
        return
      }

      if (msg.t === 'leave') {
        leaveRoom(ws)
        send(ws, { t: 'left' })
      }
    })

    ws.on('close', () => leaveRoom(ws))
    ws.on('error', () => leaveRoom(ws))
  })

  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue }
      ws.isAlive = false
      try { ws.ping() } catch {}
    }
  }, 30000)
  wss.on('close', () => clearInterval(ping))
  return wss
}
