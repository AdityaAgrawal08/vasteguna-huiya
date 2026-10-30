import * as THREE from 'three'
import './style.css'
import {
  CHARACTERS, ROSTER, STAGES, COMMENTARY, ARENA_HALF_WIDTH,
} from './game/data.js'
import { Match, DT, makeInput } from './game/engine.js'
import { CPU } from './game/ai.js'
import { createArena } from './game/arena.js'
import { createFighterRig } from './game/fighters3d.js'
import { createAudio } from './game/audio.js'
import { createFX } from './game/fx.js'
import { createSuperSequence } from './game/supers.js'
import { createChaiCup } from './game/chai.js'
import { createVoice } from './game/voice.js'
import { Input, isTouchDevice } from './input.js'
import { UI } from './ui.js'
import { portrait } from './portraits.js'
import { NetClient } from './net.js'
import { createRemoteMatch, applySnapshot } from './game/remote.js'

const app = {
  state: 'loading',
  renderer: null,
  scene: null,
  arena: null,
  camera: null,
  fx: null,
  audio: null,
  ui: null,
  input: null,
  match: null,
  cpu: null,
  rigs: [null, null],
  superSeq: null,
  preview: [],
  chaiCup: null,
  shake: 0,
  shakeTime: 0,
  time: 0,
  resultTimer: 0,
  pendingResult: null,
  tickerTimer: 0,
  select: { p1: 'modi', p2: 'rahul', stage: 'sansad', difficulty: 'normal', picking: 'p1' },
  online: { active: false, guest: false, room: null, status: '', canFight: false },
  local2p: false,
  net: null,
  netMode: false,
  netSide: 0,
  netRoom: null,
  netSnap: null,
  netSnaps: [],
  netStarted: false,
  superOverlayTime: 0,
  musicOn: true,
  muted: false,
  cameraTarget: new THREE.Vector3(0, 1.2, 0),
  cameraPos: new THREE.Vector3(0, 3, 11),
  lastPose: [null, null],
}

/* ------------------------------------------------------------------ boot */

function boot() {
  const canvas = document.getElementById('game')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  app.renderer = renderer

  const scene = new THREE.Scene()
  app.scene = scene

  const arena = createArena(scene, renderer, 'sansad')
  app.arena = arena
  app.camera = arena.camera

  const params = new URLSearchParams(location.search)
  app.lowQuality = params.get('quality') === 'low' || isTouchDevice()
  if (app.lowQuality) {
    renderer.setPixelRatio(1)
    renderer.shadowMap.enabled = false
    arena.setQuality('low')
  }

  app.fx = createFX(scene)
  app.audio = createAudio()
  app.voice = createVoice()
  app.ui = new UI()
  app.input = new Input()
  app.input.bindTouch(document.getElementById('touch'))

  if (isTouchDevice()) {
    document.documentElement.classList.add('touch')
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches
    if (ios && !standalone) {
      const hint = document.getElementById('ios-swipe')
      if (hint) {
        hint.classList.remove('hidden')
        hint.querySelector('.swipe-skip')?.addEventListener('click', () => hint.classList.add('hidden'))
      }
    }
  }

  app.ui.onTile = (id) => pickTile(id)
  app.ui.onPlate = (which) => { app.select.picking = which === 'p1' ? 'p1' : 'p2'; app.ui.renderSelect(selectState()) }
  app.ui.onStage = (stage) => {
    if (app.online.active && app.net && !app.local2p && app.netSide !== 0) return
    app.select.stage = stage
    if (app.online.active && app.net && !app.local2p) app.net.stage(stage)
    app.arena.setStage(stage)
    app.ui.renderSelect(selectState())
  }
  app.ui.onDiff = (diff) => {
    if (app.online.active && !app.local2p) return
    app.select.difficulty = diff
    app.ui.renderSelect(selectState())
  }

  bindGlobal()
  bindScreens()

  window.addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight)
    app.camera.aspect = innerWidth / innerHeight
    app.camera.updateProjectionMatrix()
  })

  // fake asset load with a real progress feel
  let p = 0
  const loadTimer = setInterval(() => {
    p += 0.07 + Math.random() * 0.08
    app.ui.setLoading(p)
    if (p >= 1) {
      clearInterval(loadTimer)
      app.ui.setLoading(1)
      setTimeout(() => {
        app.state = 'title'
        app.ui.show('title')
        app.ui.setSoundIcon(app.muted)
        app.audio.startMusic('sansad')
      }, 260)
    }
  }, 70)

  requestAnimationFrame(frame)
}

/* ------------------------------------------------------------------ screens */

function bindGlobal() {
  app.input.onGlobal = (e) => {
    if (app.state === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') startSelect()
      return
    }
    if (app.state === 'select') {
      if (e.code === 'Enter') { if (!app.online.active || app.online.canFight) startFight(); return }
      if (e.code === 'Escape') { goTitle(); return }
      if (e.code === 'ArrowLeft') { movePick('p1', -1); return }
      if (e.code === 'ArrowRight') { movePick('p1', 1); return }
      if (e.code === 'ArrowUp') { movePick('p2', -1); return }
      if (e.code === 'ArrowDown') { movePick('p2', 1); return }
      if (e.code === 'KeyT') { cycleStage(); return }
      if (e.code === 'Digit1') { setDiff('easy'); return }
      if (e.code === 'Digit2') { setDiff('normal'); return }
      if (e.code === 'Digit3') { setDiff('hard'); return }
      return
    }
    if (app.state === 'fight') {
      if (e.code === 'Escape') { pauseGame(); return }
      if (e.code === 'KeyM') { toggleMusic(); return }
      if (e.code === 'KeyN') { toggleMute(); return }
      return
    }
    if (app.state === 'paused') {
      if (e.code === 'Escape' || e.code === 'Enter') resumeGame()
      return
    }
    if (app.state === 'result') {
      if (e.code === 'Enter') rematch()
    }
  }
}

function bindScreens() {
  document.getElementById('title').addEventListener('pointerdown', () => startSelect())
  document.getElementById('fight-btn').addEventListener('click', () => {
    if (!app.online.active || app.online.canFight) startFight()
  })
  document.getElementById('resume-btn').addEventListener('click', resumeGame)
  document.getElementById('quit-btn').addEventListener('click', quitToSelect)
  document.getElementById('pause-sound-btn').addEventListener('click', toggleMute)
  document.getElementById('pause-btn').addEventListener('click', pauseGame)
  document.getElementById('rematch-btn').addEventListener('click', rematch)
  document.getElementById('select-btn').addEventListener('click', quitToSelect)
  document.getElementById('sound-btn').addEventListener('click', toggleMute)
  document.getElementById('online-btn').addEventListener('click', openOnline)
  document.getElementById('on-back').addEventListener('click', closeOnline)
  document.getElementById('on-local').addEventListener('click', startLocal2p)
  document.getElementById('online-leave').addEventListener('click', leaveOnline)

  const unlock = () => {
    app.audio.unlock()
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
  document.addEventListener('pointerdown', unlock)
  document.addEventListener('keydown', unlock)
}

function startSelect() {
  app.audio.unlock()
  app.state = 'select'
  app.ui.show('select')
  app.ui.renderSelect(selectState())
  app.arena.setStage(app.select.stage)
  refreshPreview()
}

function refreshPreview() {
  disposePreview()
  if (app.state !== 'select') return
  const ids = [app.select.p1, app.select.p2]
  for (let i = 0; i < 2; i++) {
    const rig = createFighterRig(ids[i])
    rig.root.position.set(i === 0 ? -2.6 : 2.6, 0, 0)
    rig.setFacing(i === 0 ? 1 : -1)
    app.scene.add(rig.root)
    app.preview.push(rig)
  }
}

function disposePreview() {
  for (const r of app.preview) { app.scene.remove(r.root); r.dispose() }
  app.preview = []
}

function goTitle() {
  app.state = 'title'
  app.ui.show('title')
  app.arena.setStage('sansad')
  disposePreview()
}

function selectState() {
  let p1 = app.select.p1
  let p2 = app.select.p2
  let stage = app.select.stage
  if (app.online.active && app.netRoom) {
    p1 = app.netRoom.hostChar || p1
    p2 = app.netRoom.guestChar || p2
    stage = app.netRoom.stage || stage
  }
  const bothPicked = !!(app.netRoom?.hostChar && app.netRoom?.guestChar)
  const canFight = app.local2p ? true : app.online.active && app.net ? bothPicked : true
  return {
    ...app.select, p1, p2, stage,
    online: app.online.active,
    guest: app.online.guest,
    onlineStatus: app.netRoom
      ? `ROOM ${app.netRoom.code} · ${app.online.guest ? 'GUEST' : 'HOST'}${bothPicked ? ' · READY' : ' · PICK YOUR NETA'}`
      : app.online.status,
    canFight,
    taken: app.online.taken,
  }
}

function pickTile(id) {
  const other = app.select.picking === 'p1' ? app.select.p2 : app.select.p1
  let chosen = id
  if (id === 'random') {
    const pool = ROSTER.filter((r) => r !== other)
    chosen = pool[Math.floor(Math.random() * pool.length)]
  }
  if (app.online.active && app.net && !app.local2p) {
    if (app.netSide === 0) app.select.p1 = chosen
    else app.select.p2 = chosen
    app.select.picking = app.netSide === 0 ? 'p1' : 'p2'
    app.net.pick(chosen, app.select.stage)
    app.ui.renderSelect(selectState())
    app.audio.play('select')
    refreshPreview()
    return
  }
  if (app.select.picking === 'p1') {
    app.select.p1 = chosen
    app.select.picking = 'p2'
  } else {
    app.select.p2 = chosen
    app.select.picking = 'p1'
  }
  app.ui.renderSelect(selectState())
  app.audio.play('select')
  refreshPreview()
}

function movePick(which, dir) {
  if (app.online.active && app.net && !app.local2p) {
    if ((app.netSide === 0) !== (which === 'p1')) return
  }
  const key = which === 'p1' ? 'p1' : 'p2'
  let i = ROSTER.indexOf(app.select[key])
  i = (i + dir + ROSTER.length) % ROSTER.length
  app.select[key] = ROSTER[i]
  app.select.picking = which
  if (app.online.active && app.net && !app.local2p) app.net.pick(app.select[key], app.select.stage)
  app.ui.renderSelect(selectState())
  app.audio.play('move')
  refreshPreview()
}

function cycleStage() {
  if (app.online.active && app.net && !app.local2p && app.netSide !== 0) return
  const keys = Object.keys(STAGES)
  const i = keys.indexOf(app.select.stage)
  app.select.stage = keys[(i + 1) % keys.length]
  if (app.online.active && app.net && !app.local2p) app.net.stage(app.select.stage)
  app.arena.setStage(app.select.stage)
  app.ui.renderSelect(selectState())
  app.audio.play('move')
}

function setDiff(d) {
  app.select.difficulty = d
  app.ui.renderSelect(selectState())
  app.audio.play('move')
}

/* ------------------------------------------------------------------ fight */

function startFight() {
  if (app.online.active && !app.local2p && app.net) {
    if (!selectState().canFight) return
    app.net.ready()
    const btn = document.getElementById('fight-btn')
    btn.textContent = 'WAITING…'
    btn.classList.add('waiting')
    app.ui.renderSelect(selectState())
    return
  }
  if (app.online.active && !app.online.canFight) return
  app.audio.unlock()
  app.audio.play('fight')
  cleanupFight()
  disposePreview()

  const { p1, p2, stage, difficulty } = app.select
  app.match = new Match({ p1, p2, stage, difficulty })
  app.cpu = new CPU(app.match, 1, difficulty)
  app.rigs = [createFighterRig(p1), createFighterRig(p2)]
  for (const r of app.rigs) app.scene.add(r.root)
  app.rigs[0].root.position.set(app.match.fighters[0].x, 0, 0)
  app.rigs[1].root.position.set(app.match.fighters[1].x, 0, 0)
  app.rigs[0].setFacing(1)
  app.rigs[1].setFacing(-1)

  app.arena.setStage(stage)
  app.chaiCup = createChaiCup(app.scene)
  app.ui.setHudChars(p1, p2)
  app.ui.setAnchors([p1, p2])
  app.ui.hud.classList.remove('hidden')
  app.ui.show(null)
  app.ui.setVignette(false)
  app.ui.timerEl.textContent = '60'
  for (const el of document.querySelectorAll('#hud .win')) el.classList.remove('on')
  app.ui.tickerTrack.innerHTML = ''
  app.ui.tickerItems = []
  app.ui.tickerOffset = 0
  for (let i = 0; i < 3; i++) app.ui.pushTicker(COMMENTARY.filler[i])
  app.ui.pushTicker('BREAKING: The tournament begins. Experts are already arguing.', true)

  document.body.classList.add('in-battle')
  app.input.enabled = true
  app.state = 'fight'
  app.shake = 0
  app.superSeq = null
  app.resultTimer = 0
  app.pendingResult = null
  app.match.start()
  app.audio.startMusic(stage)
  app.ui.updateHud(app.match)
}

function startNetFight(msg) {
  cleanupFight()
  disposePreview()
  app.netMode = true
  app.netStarted = true
  app.netSnaps = []
  app.select.p1 = msg.p1
  app.select.p2 = msg.p2
  app.select.stage = msg.stage
  app.match = createRemoteMatch(msg)
  app.rigs = [createFighterRig(msg.p1), createFighterRig(msg.p2)]
  for (const r of app.rigs) app.scene.add(r.root)
  app.rigs[0].root.position.set(app.match.fighters[0].x, 0, 0)
  app.rigs[1].root.position.set(app.match.fighters[1].x, 0, 0)
  app.rigs[0].setFacing(1)
  app.rigs[1].setFacing(-1)

  app.arena.setStage(msg.stage)
  app.chaiCup = createChaiCup(app.scene)
  app.ui.setHudChars(msg.p1, msg.p2)
  app.ui.setAnchors([msg.p1, msg.p2])
  app.ui.hud.classList.remove('hidden')
  app.ui.show(null)
  app.ui.setVignette(false)
  app.ui.timerEl.textContent = '60'
  app.ui.tickerTrack.innerHTML = ''
  app.ui.tickerItems = []
  app.ui.tickerOffset = 0
  for (let i = 0; i < 3; i++) app.ui.pushTicker(COMMENTARY.filler[i])
  app.ui.pushTicker('BREAKING: Friend-room match connected.', true)

  const btn = document.getElementById('fight-btn')
  if (btn) { btn.textContent = 'FIGHT!'; btn.classList.remove('waiting') }
  const rb = document.getElementById('rematch-btn')
  if (rb) rb.textContent = 'REMATCH'
  document.body.classList.add('in-battle')
  app.input.enabled = true
  app.state = 'fight'
  app.shake = 0
  app.superSeq = null
  app.resultTimer = 0
  app.pendingResult = null
  app.audio.startMusic(msg.stage)
  app.ui.updateHud(app.match)
}

function cleanupFight() {
  app.input.enabled = false
  for (const r of app.rigs) {
    if (r) { app.scene.remove(r.root); r.dispose() }
  }
  app.rigs = [null, null]
  if (app.superSeq) { app.superSeq.dispose(); app.superSeq = null }
  if (app.chaiCup) { app.chaiCup.dispose(); app.chaiCup = null }
  app.netMode = false
  app.netSnaps = []
  app.ui.hud.classList.add('hidden')
  document.body.classList.remove('in-battle')
  app.ui.setVignette(false)
}

function pauseGame() {
  if (app.state !== 'fight') return
  if (app.netMode) return
  app.state = 'paused'
  app.input.enabled = false
  app.ui.show('pause')
  app.ui.setPauseSound(!app.muted)
  app.audio.play('back')
}

function resumeGame() {
  if (app.state !== 'paused') return
  app.state = 'fight'
  app.input.enabled = true
  app.ui.hideScreens()
  app.audio.play('confirm')
}

function quitToSelect() {
  leaveNet()
  cleanupFight()
  app.local2p = false
  app.online.active = false
  app.online.canFight = false
  app.state = 'select'
  app.ui.show('select')
  app.ui.renderSelect(selectState())
  app.audio.startMusic('sansad')
  refreshPreview()
}

function rematch() {
  if (app.netMode && app.net) {
    app.net.rematch()
    const btn = document.getElementById('rematch-btn')
    if (btn) btn.textContent = 'WAITING…'
    return
  }
  startFight()
}

function toggleMute() {
  app.muted = !app.muted
  app.audio.setMuted(app.muted)
  app.voice?.setMuted(app.muted)
  app.ui.setSoundIcon(app.muted)
  app.ui.setPauseSound(!app.muted)
}

function toggleMusic() {
  app.musicOn = !app.musicOn
  app.audio.setMusicEnabled(app.musicOn)
}

/* ------------------------------------------------------------------ loop */

let last = performance.now()
let acc = 0
let fpsWindow = 0
let fpsFrames = 0

function frame(now) {
  requestAnimationFrame(frame)
  const realDt = Math.min(0.1, (now - last) / 1000)
  last = now
  app.time += realDt

  // Adaptive quality: if a device cannot hold a smooth frame rate, drop
  // shadows/particles once instead of letting the fight stutter.
  fpsWindow += realDt
  fpsFrames++
  if (fpsWindow >= 2.5) {
    const fps = fpsFrames / fpsWindow
    if (fps < 42 && !app.lowQuality) {
      app.lowQuality = true
      app.renderer.setPixelRatio(1)
      app.renderer.shadowMap.enabled = false
      app.arena.setQuality('low')
    }
    fpsWindow = 0
    fpsFrames = 0
  }

  if (app.state === 'fight') {
    updateFight(realDt)
  } else if (app.state === 'paused') {
    // hold everything
  } else if (app.state === 'result') {
    app.resultTimer -= realDt
    updateRigs(realDt)
    updateCamera(realDt)
  } else {
    updateAmbient(realDt)
    updateCamera(realDt)
    if (app.state === 'select') updatePreview(realDt)
  }

  app.fx.update(realDt)
  app.ui.updateTicker(realDt)
  app.arena.update(realDt, app.time)
  app.renderer.render(app.scene, app.camera)
}

function updateFight(realDt) {
  const m = app.match
  if (!m) return
  if (app.netMode) { updateNetFight(realDt); return }

  const scale = m.slowMo > 0 ? 0.32 : 1
  acc += realDt * scale
  let steps = 0
  while (acc >= DT && steps < 8) {
    const inp = app.input.getInput()
    const cpuInp = app.local2p ? app.input.getP2Input() : app.cpu.update()
    m.step([inp, cpuInp], DT)
    app.input.endFrame()
    acc -= DT
    steps++
  }
  if (steps === 8) acc = 0

  for (const ev of m.drainEvents()) handleEvent(ev)

  updateRigs(realDt)
  updateCamera(realDt)
  app.ui.updateHud(m)
  updateTicker(realDt)

  if (m.phase === 'super' && app.superSeq) {
    // Hold the final pose until the engine resolves; disposing early would
    // snap the fighters back to neutral mid-cinematic.
    app.superSeq.step(realDt)
  } else if (app.superSeq && m.phase !== 'super') {
    app.superSeq.dispose()
    app.superSeq = null
  }

  updatePendingResult(realDt)
}

function updateNetFight(realDt) {
  const m = app.match
  const input = app.input.getInput()
  app.net?.sendInput(input)
  app.input.endFrame()

  let last = null
  const events = []
  while (app.netSnaps.length) {
    const snap = app.netSnaps.shift()
    last = snap
    if (snap.events) events.push(...snap.events)
  }
  if (last) {
    applySnapshot(m, last)
    for (const ev of events) handleEvent(ev)
  }

  updateRigs(realDt)
  updateCamera(realDt)
  app.ui.updateHud(m)
  updateTicker(realDt)

  if (m.phase === 'super' && app.superSeq) {
    app.superSeq.step(realDt)
  } else if (app.superSeq && m.phase !== 'super') {
    app.superSeq.dispose()
    app.superSeq = null
  }

  updatePendingResult(realDt)
}

function updatePendingResult(realDt) {
  if (!app.pendingResult) return
  app.resultTimer -= realDt
  if (app.resultTimer > 0) return
  const r = app.pendingResult
  app.pendingResult = null
  app.state = 'result'
  app.input.enabled = false
  app.ui.hud.classList.add('hidden')
  app.ui.showResult(r)
  app.audio.stopMusic()
  app.audio.play(r.win ? 'win' : 'lose')
  document.body.classList.remove('in-battle')
}

function updateRigs(dt) {
  const m = app.match
  if (!m) return
  for (let i = 0; i < 2; i++) {
    const f = m.fighters[i]
    const rig = app.rigs[i]
    if (!rig) continue
    if (m.phase === 'super' && app.superSeq) {
      app.superSeq.updateRig(i, dt)
      continue
    }
    if (app.netMode) {
      // Snapshots arrive at 30 Hz; interpolate so remote fighters do not
      // teleport between packets.
      const k = 1 - Math.exp(-24 * dt)
      if (Math.abs(f.x - rig.root.position.x) > 2.5) rig.root.position.x = f.x
      else rig.root.position.x += (f.x - rig.root.position.x) * k
      if (f._smoothY == null) f._smoothY = f.y
      f._smoothY += (f.y - f._smoothY) * k
      rig.setFacing(f.facing)
      const pose = poseFor(f)
      pose.y = f._smoothY
      rig.update(pose, dt)
    } else {
      rig.root.position.set(f.x, f.y, 0)
      rig.setFacing(f.facing)
      rig.update(poseFor(f), dt)
    }
  }
}

function poseFor(f) {
  return {
    state: f.state,
    stateTime: f.stateFrames / 60,
    attackId: f.attack?.def.id,
    phase: f.attackPhase,
    attackFrame: f.attack?.frame || 0,
    startup: f.attack?.def.startup || 1,
    crouching: f.crouching,
    facing: f.facing,
    x: f.x,
    y: f.y,
    vx: f.vx,
    vy: f.vy,
    airborne: f.airborne,
    blocking: f.state === 'blockstun' || (f.holdingBack && f.actionable),
    ko: f.state === 'ko',
    victory: f.state === 'victory',
    flash: f.flash > 0,
    comboHits: f.comboHits,
  }
}

function updateAmbient(dt) {
  // idle camera work is handled in updateCamera
}

function updatePreview(dt) {
  for (let i = 0; i < app.preview.length; i++) {
    app.preview[i].update({
      state: 'idle', stateTime: app.time + i * 0.7, facing: i === 0 ? 1 : -1,
      x: i === 0 ? -2.6 : 2.6, y: 0, vx: 0, vy: 0, airborne: false,
      blocking: false, ko: false, victory: false,
    }, dt)
  }
}

/* ------------------------------------------------------------------ camera */

function updateCamera(dt) {
  const cam = app.camera
  if (!cam) return
  const m = app.match
  const t = app.time

  if (app.state === 'title' || app.state === 'select') {
    if (app.state === 'title') {
      const a = t * 0.06
      cam.position.set(Math.sin(a) * 14, 6.2 + Math.sin(t * 0.2) * 0.2, Math.cos(a) * 14 + 2)
      cam.lookAt(0, 1.4, 0)
    } else {
      const a = Math.sin(t * 0.09) * 0.55
      cam.position.set(Math.sin(a) * 8.8, 3.1, Math.cos(a) * 8.8)
      cam.lookAt(0, 1.15, 0)
    }
    cam.fov = 45
    cam.updateProjectionMatrix()
    return
  }

  if (!m) return

  if (app.state === 'result') {
    const a = t * 0.1
    cam.position.set(Math.sin(a) * 9, 3.2, Math.cos(a) * 9 + 2)
    cam.lookAt(0, 1.3, 0)
    cam.fov = 44
    cam.updateProjectionMatrix()
    return
  }

  if (m.phase === 'super' && app.superSeq) {
    const c = app.superSeq.camera
    cam.position.lerp(c.position, 1 - Math.exp(-6 * dt))
    app.cameraTarget.lerp(c.lookAt, 1 - Math.exp(-6 * dt))
    cam.lookAt(app.cameraTarget)
    cam.fov += ((c.fov || 44) - cam.fov) * (1 - Math.exp(-4 * dt))
    cam.updateProjectionMatrix()
    return
  }

  const [a, b] = m.fighters
  const mid = (a.x + b.x) / 2
  const dist = Math.abs(a.x - b.x)
  const maxY = Math.max(a.y, b.y)
  const intro = m.phase === 'intro' ? Math.max(0, 1 - m.phaseTime / 1.9) : 0

  let px = mid * 0.55
  let py = 2.6 + maxY * 0.18
  let pz = 9.2 - Math.min(2.0, dist * 0.1)
  if (intro > 0) {
    px += intro * 3.2
    py += intro * 0.5
    pz -= intro * 1.8
  }

  app.cameraPos.set(px, py, pz)
  app.cameraTarget.set(mid * 0.6, 1.22 + maxY * 0.3, 0)

  cam.position.lerp(app.cameraPos, 1 - Math.exp(-7 * dt))
  const look = app.cameraTarget
  cam.lookAt(look)

  if (app.shake > 0.001) {
    const s = app.shake
    cam.position.x += Math.sin(app.time * 92) * s * 0.55
    cam.position.y += Math.cos(app.time * 77) * s * 0.45
    app.shake *= Math.exp(-9 * dt)
  }
  const fov = 42 + Math.min(4, dist * 0.15)
  cam.fov += (fov - cam.fov) * (1 - Math.exp(-3 * dt))
  cam.updateProjectionMatrix()
}

/* ------------------------------------------------------------------ events */

function handleEvent(ev) {
  const ui = app.ui
  const audio = app.audio
  const m = app.match
  switch (ev.type) {
    case 'roundStart': {
      const final = ev.final
      ui.announce(`ROUND ${ev.round}`)
      ui.setVignette(false)
      audio.play('bell')
      audio.play('round')
      app.voice?.announce(`Round ${ev.round}`)
      const godi = m.fighters[0].char.id === 'modi' || m.fighters[1].char.id === 'rahul' ? 0 : 1
      ui.commentary('godi', final ? COMMENTARY.finalRound.godi : COMMENTARY.roundStart.godi.replace('{R}', ev.round).replace('{G}', m.fighters[godi].char.fullName))
      ui.commentary('troll', final ? COMMENTARY.finalRound.troll : COMMENTARY.roundStart.troll.replace('{R}', ev.round))
      ui.pushTicker(final ? 'FINAL ROUND: Both camps claim the momentum is theirs' : `ROUND ${ev.round}: The crowd settles in with samosas`, true)
      break
    }
    case 'fight':
      ui.announce('FIGHT!', 'fight')
      audio.play('fight')
      app.voice?.announce('Fight!')
      setTimeout(() => {
        if (app.state !== 'fight') return
        const [a, b] = m.fighters
        const pa = worldScreen(a.x, 2.25, 0)
        const pb = worldScreen(b.x, 2.25, 0)
        ui.speech(a.char.introLine, pa.x, pa.y)
        app.voice?.speak(a.char.introLine, a.char.id)
        setTimeout(() => {
          if (app.state !== 'fight') return
          ui.speech(b.char.introLine, pb.x, pb.y)
          app.voice?.speak(b.char.introLine, b.char.id)
        }, 500)
      }, 350)
      break
    case 'hit': {
      const pos = worldScreen(ev.x, ev.y, 0)
      ui.popup(`-${ev.damage}`, pos.x, pos.y - 30, ev.knockdown ? 'crit' : '')
      if (ev.move) ui.popup(ev.move, pos.x, pos.y + 16)
      app.fx.burst(new THREE.Vector3(ev.x, ev.y, 0), ev.knockdown ? 'red' : 'gold', ev.knockdown ? 22 : 12, ev.knockdown ? 4 : 2.6)
      app.fx.ring(new THREE.Vector3(ev.x, ev.y, 0), ev.knockdown ? 0xff5a3a : 0xffc040)
      app.shake = Math.max(app.shake, ev.knockdown ? 0.42 : 0.2)
      audio.play(ev.knockdown ? 'heavy' : ev.height === 'low' ? 'kick' : 'punch')
      if (ev.ko) audio.play('ko')
      if (ev.combo >= 2) ui.combo(ev.side, ev.combo)
      if (ev.knockdown && app.chaiCup && !app.chaiCup.broken) {
        const def = m.fighters[1 - ev.side]
        if (Math.abs(def.x - app.chaiCup.x) < 2.4) {
          app.chaiCup.shatter()
          const cpos = worldScreen(app.chaiCup.x, 0.45, app.chaiCup.z)
          ui.popup('CHAI CUP MARTYRED!', cpos.x, cpos.y, 'crit')
          audio.play('cupBreak')
          ui.pushTicker('BREAKING: Chai cup martyred at ringside. The chaiwala demands compensation.', true)
        }
      }
      commentaryForHit(ev)
      break
    }
    case 'block': {
      const pos = worldScreen(ev.x, ev.y, 0)
      ui.popup('BLOCKED', pos.x, pos.y - 20)
      app.fx.burst(new THREE.Vector3(ev.x, ev.y, 0), 'blue', 8, 2)
      app.shake = Math.max(app.shake, 0.1)
      audio.play('block')
      const which = ev.side === 0 ? 'godi' : 'troll'
      ui.commentary(which, pick(COMMENTARY.block))
      break
    }
    case 'grab': {
      const pos = worldScreen(ev.x, ev.y, 0)
      ui.popup(ev.move, pos.x, pos.y)
      app.shake = Math.max(app.shake, 0.25)
      audio.play('grab')
      break
    }
    case 'grabBreak':
      ui.popup('GRAB BREAK!', innerWidth / 2, innerHeight * 0.4)
      audio.play('grabBreak')
      break
    case 'superStart': {
      ui.showSuperBanner(ev.charId, CHARACTERS[ev.charId].name, ev.superName, ev.side)
      ui.setVignette(true)
      audio.play('super')
      audio.play('charge')
      app.superSeq = createSuperSequence({
        scene: app.scene, camera: app.camera, rigs: app.rigs, side: ev.side,
        charId: ev.charId, audio, fx: app.fx, fighters: m.fighters,
        onShake: (v) => { app.shake = Math.max(app.shake, v) },
        onFlash: (color, ms) => ui.flash(color, ms),
      })
      break
    }
    case 'superHit': {
      ui.flash('#fff', 260)
      app.shake = 0.7
      audio.play('boom')
      app.fx.burst(new THREE.Vector3(ev.x, ev.y, 0), 'red', 40, 6)
      app.fx.ring(new THREE.Vector3(ev.x, ev.y, 0), 0xff6a00)
      ui.setVignette(false)
      break
    }
    case 'suddenDeath':
      ui.announce('SUDDEN DEATH!', 'fight')
      audio.play('timeup')
      break
    case 'ko': {
      ui.announce(ev.timeUp ? 'TIME UP' : 'K.O.', ev.timeUp ? '' : 'ko')
      audio.play(ev.timeUp ? 'timeup' : 'ko')
      app.voice?.announce(ev.timeUp ? 'Time up!' : 'K.O.!')
      app.shake = 0.6
      ui.setVignette(true)
      if (ev.perfect) setTimeout(() => ui.announce('PERFECT!', 'perfect'), 900)
      break
    }
    case 'roundEnd': {
      const leader = m.wins[0] > m.wins[1] ? 0 : 1
      ui.announce(`${m.fighters[leader].char.name} TAKES THE ROUND`, 'win')
      ui.pushTicker(`${m.fighters[leader].char.name} takes the round. Sweets distributed outside party office.`, true)
      break
    }
    case 'matchEnd': {
      const localSide = app.netMode ? app.netSide : 0
      const playerWon = ev.side === localSide
      const localWins = localSide === 0 ? [...ev.wins] : [ev.wins[1], ev.wins[0]]
      app.pendingResult = {
        win: playerWon, winnerChar: m.fighters[ev.side].char.id, playerChar: m.fighters[localSide].char.id,
        perfect: ev.perfect, timeUp: m.timeUp, wins: localWins,
      }
      app.resultTimer = 2.1
      ui.announce(playerWon ? 'YOU WIN!' : 'YOU LOSE', playerWon ? 'win' : 'lose')
      audio.play(playerWon ? 'jingle_win' : 'jingle_lose')
      app.voice?.announce(playerWon ? 'You win!' : 'You lose!')
      ui.setVignette(true)
      const winner = m.fighters[ev.side]
      app.voice?.speak(winner.char.winLine, winner.char.id)
      const wp = worldScreen(winner.x, 2.4, 0)
      ui.speech(winner.char.winLine, wp.x, wp.y)
      setTimeout(() => {
        if (app.state !== 'fight' && app.state !== 'result') return
        ui.announce(winner.char.dance.label, 'win')
        app.fx.burst(new THREE.Vector3(winner.x, 2.2, 0), 'gold', 26, 4)
        app.fx.burst(new THREE.Vector3(winner.x - 0.4, 1.6, 0), 'red', 18, 3)
        app.fx.burst(new THREE.Vector3(winner.x + 0.4, 1.8, 0), 'blue', 18, 3)
      }, 1050)
      break
    }
  }
}

function commentaryForHit(ev) {
  const m = app.match
  const atk = m.fighters[ev.side]
  const def = m.fighters[1 - ev.side]
  const vars = {
    A: atk.char.name, D: def.char.name, AN: atk.char.fullName, DN: def.char.fullName,
    M: (ev.move || 'HIT').replace(/!$/, ''), DIR: Math.random() < 0.5 ? 'jumps' : 'crashes',
    N: String(100 + Math.floor(Math.random() * 900)),
  }
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  const which = ev.side === 0 ? 'godi' : 'troll'
  const other = ev.side === 0 ? 'troll' : 'godi'
  app.ui.commentary(which, fill(pick(COMMENTARY[which].hit)))
  app.ui.commentary(other, fill(pick(COMMENTARY[other].hurt)))
  if (ev.knockdown) {
    const t = fill(pick(COMMENTARY.ticker))
    app.ui.pushTicker(t, true)
  }
}

function updateTicker(dt) {
  app.tickerTimer -= dt
  if (app.tickerTimer <= 0) {
    app.tickerTimer = 9 + Math.random() * 6
    app.ui.pushTicker(pick(COMMENTARY.filler))
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function worldScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(app.camera)
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }
}

/* ------------------------------------------------------------------ online */

function showOnlinePanel(name) {
  for (const id of ['on-home', 'on-hosting', 'on-connecting', 'on-error']) {
    document.getElementById(id)?.classList.toggle('hidden', id !== `on-${name}`)
  }
}

function showNetError(text) {
  app.state = 'online'
  app.ui.show('online')
  showOnlinePanel('error')
  const el = document.getElementById('on-error-text')
  if (el) el.textContent = text || 'Something went wrong.'
}

function setConnectingText(text) {
  const el = document.getElementById('on-connecting-text')
  if (el) el.textContent = text
}

function openOnline() {
  leaveNet()
  app.state = 'online'
  app.ui.show('online')
  app.audio.play('select')
  showOnlinePanel('home')
  const room = new URLSearchParams(location.search).get('room')
  if (room) {
    const input = document.getElementById('on-code')
    if (input) input.value = room.toUpperCase().slice(0, 6)
  }
}

function closeOnline() {
  leaveNet()
  app.state = 'select'
  app.ui.show('select')
  app.ui.renderSelect(selectState())
  if (!app.preview.length) refreshPreview()
}

function leaveNet() {
  if (app.net) {
    try { app.net.leave() } catch {}
    app.net = null
  }
  app.netRoom = null
  app.netMode = false
  app.netStarted = false
  app.netSnaps = []
  app.online.active = false
  app.online.guest = false
  app.online.canFight = false
  app.online.status = ''
  document.getElementById('net-away')?.classList.add('hidden')
  const btn = document.getElementById('fight-btn')
  if (btn) { btn.textContent = 'FIGHT!'; btn.classList.remove('waiting') }
}

function hostRoom() {
  leaveNet()
  showOnlinePanel('connecting')
  setConnectingText('Opening room…')
  const net = new NetClient({
    onOpen: () => net.send({ t: 'create' }),
    onMessage: onNetMessage,
    onClose: () => onNetClosed(net),
    onError: () => showNetError('Could not reach the room server.'),
  })
  app.net = net
  net.connect()
}

function joinRoom(code) {
  if (!code || code.length < 4) { showNetError('Enter a valid room code.'); return }
  leaveNet()
  showOnlinePanel('connecting')
  setConnectingText('Connecting…')
  const net = new NetClient({
    onOpen: () => net.send({ t: 'join', code: String(code).toUpperCase() }),
    onMessage: onNetMessage,
    onClose: () => onNetClosed(net),
    onError: () => showNetError('Could not reach the room server.'),
  })
  app.net = net
  net.connect()
}

function onNetMessage(msg) {
  if (!msg || !msg.t) return
  switch (msg.t) {
    case 'created': {
      app.netSide = 0
      app.netRoom = { code: msg.code, hostChar: null, guestChar: null, stage: 'sansad' }
      app.online.active = false
      app.online.guest = false
      app.online.status = 'Waiting for your friend…'
      showOnlinePanel('hosting')
      const codeEl = document.getElementById('on-room-code')
      if (codeEl) codeEl.textContent = msg.code
      break
    }
    case 'joined': {
      app.netSide = app.net?.side ?? msg.side ?? 0
      app.online.active = true
      app.online.guest = app.netSide === 1
      app.online.canFight = false
      app.online.status = 'Friend connected'
      app.select.picking = app.netSide === 0 ? 'p1' : 'p2'
      app.state = 'select'
      app.ui.show('select')
      app.ui.renderSelect(selectState())
      refreshPreview()
      app.audio.play('confirm')
      break
    }
    case 'room': {
      app.netRoom = msg
      app.select.p1 = msg.hostChar || app.select.p1
      app.select.p2 = msg.guestChar || app.select.p2
      app.select.stage = msg.stage || app.select.stage
      app.online.canFight = !!(msg.hostChar && msg.guestChar)
      app.online.guest = app.netSide === 1
      if (app.state === 'select') {
        app.arena.setStage(app.select.stage)
        app.ui.renderSelect(selectState())
      }
      break
    }
    case 'start':
      startNetFight(msg)
      break
    case 'snap':
      app.netSnaps.push(msg)
      if (app.netSnaps.length > 90) app.netSnaps.shift()
      break
    case 'peerLeft':
      showNetAway('Your friend left the room.')
      break
    case 'error':
      showNetError(msg.error)
      break
    case 'left':
      leaveNet()
      showOnlinePanel('home')
      break
  }
}

function onNetClosed(net) {
  if (app.net !== net) return
  if (app.state === 'fight') showNetAway('Connection lost.')
  else if (app.state === 'online') showNetError('Connection lost.')
}

function showNetAway(text) {
  const el = document.getElementById('net-away')
  if (!el) return
  const span = el.querySelector('.net-away-msg span')
  if (span) span.textContent = text || 'Waiting for your friend…'
  el.classList.remove('hidden')
}

function startLocal2p() {
  leaveNet()
  app.local2p = true
  app.online.active = true
  app.online.guest = false
  app.online.canFight = true
  app.online.status = 'LOCAL VERSUS · P2: ARROWS + NUMPAD 1/2/3/0'
  app.state = 'select'
  app.ui.show('select')
  app.ui.renderSelect(selectState())
  refreshPreview()
  app.audio.play('confirm')
}

function leaveOnline() {
  leaveNet()
  app.local2p = false
  app.online.active = false
  app.online.guest = false
  app.online.canFight = false
  app.online.status = ''
  app.ui.renderSelect(selectState())
  app.audio.play('back')
}

document.getElementById('on-host')?.addEventListener('click', hostRoom)
document.getElementById('on-join-form')?.addEventListener('submit', (e) => {
  e.preventDefault()
  const code = document.getElementById('on-code')?.value || ''
  joinRoom(code)
})
document.getElementById('on-copy')?.addEventListener('click', async () => {
  const code = app.netRoom?.code || ''
  const url = `${location.origin}${location.pathname}?room=${code}`
  try {
    await navigator.clipboard.writeText(url)
    const btn = document.getElementById('on-copy')
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy link' }, 1200) }
  } catch {
    const input = document.getElementById('on-code')
    if (input) input.value = code
  }
})
document.getElementById('on-wa')?.addEventListener('click', () => {
  const code = app.netRoom?.code || ''
  const text = encodeURIComponent(`Fight me in Sansad Showdown! Room code: ${code} — ${location.origin}${location.pathname}?room=${code}`)
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
})
document.getElementById('net-away-leave')?.addEventListener('click', () => {
  leaveNet()
  quitToSelect()
})

/* ------------------------------------------------------------------ start */
window.__SANSAD__ = app
boot()
