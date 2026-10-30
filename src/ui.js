import { CHARACTERS, ROSTER, STAGES, RESULT_COPY } from './game/data.js'
import { portrait } from './portraits.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

export class UI {
  constructor() {
    this.screens = {
      loading: $('#loading'), title: $('#title'), online: $('#online'), select: $('#select'),
      pause: $('#pause'), result: $('#result'),
    }
    this.hud = $('#hud')
    this.announceEl = $('#announce')
    this.superBanner = $('#super-banner')
    this.popups = $('#popups')
    this.flashEl = $('#flash')
    this.vignette = $('#vignette')
    this.timerEl = $('#timer')
    this.tickerTrack = $('#newsdesk .ticker-track')
    this.tickerItems = []
    this.tickerOffset = 0
    this.tickerSpeed = 90
    this.sides = {
      left: $('#hud .side.left'), right: $('#hud .side.right'),
    }
    this.meters = { left: $('#hud .meter.left'), right: $('#hud .meter.right') }
    this.combos = { left: $('#hud .combo.left'), right: $('#hud .combo.right') }
    this.anchors = {
      godi: $('#newsdesk .anchor.godi'), troll: $('#newsdesk .anchor.troll'),
    }
    this.soundBtn = $('#sound-btn')
    this.buildRoster()
    this.bindSelect()
    this.lastAnnounce = ''
    this.tickerDirty = false
  }

  /* ---------------- screens ---------------- */
  show(name) {
    for (const [k, el] of Object.entries(this.screens)) {
      if (!el) continue
      el.classList.toggle('hidden', k !== name)
    }
    document.body.classList.toggle('in-battle', name === null)
    if (name === null) for (const el of Object.values(this.screens)) el?.classList.add('hidden')
  }
  hideScreens() {
    for (const el of Object.values(this.screens)) el?.classList.add('hidden')
  }
  setLoading(p) {
    const fill = $('#load-fill')
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`
  }

  /* ---------------- select ---------------- */
  buildRoster() {
    const grid = $('#roster-grid')
    grid.innerHTML = ''
    for (const id of ROSTER) {
      const c = CHARACTERS[id]
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tile'
      btn.dataset.tile = id
      btn.style.setProperty('--accent', c.accent)
      btn.innerHTML = `<img alt="${c.name}" src="${portrait(id, 192)}"><span class="tile-name">${c.name}</span><i class="cur p1">1P</i><i class="cur p2">CPU</i>`
      grid.appendChild(btn)
    }
    const rand = document.createElement('button')
    rand.type = 'button'
    rand.className = 'tile random'
    rand.dataset.tile = 'random'
    rand.style.setProperty('--accent', '#ffe3a0')
    rand.innerHTML = '<span class="tile-q">?</span><span class="tile-name">RANDOM</span>'
    grid.appendChild(rand)
    this.tiles = $$('#roster-grid .tile')
  }

  bindSelect() {
    this.onTile = null
    for (const t of this.tiles) {
      t.addEventListener('click', () => this.onTile?.(t.dataset.tile))
    }
    $('#plate-p1')?.addEventListener('click', () => this.onPlate?.('p1'))
    $('#plate-p2')?.addEventListener('click', () => this.onPlate?.('p2'))
    this.onStage = null
    for (const b of $$('[data-stage]')) b.addEventListener('click', () => this.onStage?.(b.dataset.stage))
    this.onDiff = null
    for (const b of $$('[data-diff]')) b.addEventListener('click', () => this.onDiff?.(b.dataset.diff))
  }

  renderSelect(state) {
    const { p1, p2, stage, difficulty, picking, online, guest, taken } = state
    const p1c = CHARACTERS[p1]
    const p2c = CHARACTERS[p2]
    const plate1 = $('#plate-p1')
    const plate2 = $('#plate-p2')
    this.fillPlate(plate1, p1c, '1P · YOU')
    this.fillPlate(plate2, p2c, online ? '2P · FRIEND' : 'CPU')
    plate1.style.setProperty('--accent', p1c.accent)
    plate2.style.setProperty('--accent', p2c.accent)
    plate1.classList.toggle('active', picking === 'p1')
    plate2.classList.toggle('active', picking === 'p2')

    for (const t of this.tiles) {
      const id = t.dataset.tile
      t.classList.toggle('p1', id === p1)
      t.classList.toggle('p2', id === p2)
      t.classList.toggle('taken', !!taken?.has(id))
    }

    const prompt = $('#pick-prompt')
    prompt.textContent = online
      ? (picking === 'p1' ? 'PICK YOUR NETA' : 'WAITING FOR FRIEND')
      : (picking === 'p1' ? 'PICK YOUR NETA' : 'PICK THE CPU')
    prompt.classList.toggle('p2', picking === 'p2')

    for (const b of $$('[data-stage]')) b.classList.toggle('selected', b.dataset.stage === stage)
    for (const b of $$('[data-diff]')) b.classList.toggle('selected', b.dataset.diff === difficulty)
    $('#stage-sub').textContent = `${STAGES[stage].name} — ${STAGES[stage].subtitle}`
    $('#vs-line').textContent = `${p1c.name} vs ${p2c.name} — ${STAGES[stage].name}`
    document.body.classList.toggle('online', !!online)
    document.body.classList.toggle('guest', !!guest)
    const bar = $('#online-bar')
    bar.classList.toggle('hidden', !online)
    if (online) {
      $('#online-status').textContent = state.onlineStatus || ''
      $('#fight-btn').classList.toggle('waiting', !state.canFight)
    }
    $('.cpu-level').style.display = online ? 'none' : ''
    $('#online-btn').style.display = online ? 'none' : ''
  }

  fillPlate(el, char, tag) {
    el.querySelector('.plate-tag').textContent = tag
    el.querySelector('.plate-name').textContent = char.name
    el.querySelector('.plate-party').textContent = char.party
    el.querySelector('.plate-super').textContent = `SUPER · ${char.superName}`
    el.querySelector('.plate-desc').textContent = char.superDesc
  }

  /* ---------------- HUD ---------------- */
  setHudChars(p1, p2) {
    const c1 = CHARACTERS[p1]
    const c2 = CHARACTERS[p2]
    const setup = (side, c, id) => {
      side.style.setProperty('--accent', c.accent)
      side.querySelector('.portrait').src = portrait(id, 160)
      side.querySelector('.name').textContent = c.name
    }
    setup(this.sides.left, c1, p1)
    setup(this.sides.right, c2, p2)
    this.meters.left.style.setProperty('--accent', c1.accent)
    this.meters.right.style.setProperty('--accent', c2.accent)
    for (const el of $$('#hud .win')) el.classList.remove('on')
  }

  updateHud(match) {
    const f = match.fighters
    const sides = [this.sides.left, this.sides.right]
    for (let i = 0; i < 2; i++) {
      const side = sides[i]
      const hp = f[i].hp / 100
      const fill = side.querySelector('.hp-fill')
      const trail = side.querySelector('.hp-trail')
      fill.style.width = `${hp * 100}%`
      trail.style.width = `${hp * 100}%`
      fill.classList.toggle('danger', hp <= 0.25)
      const wins = side.querySelectorAll('.win')
      wins.forEach((w, j) => w.classList.toggle('on', j < match.wins[i]))
      const meter = i === 0 ? this.meters.left : this.meters.right
      meter.querySelector('.meter-fill').style.width = `${f[i].meter}%`
      meter.classList.toggle('ready', f[i].meter >= 100)
    }
    const t = Math.ceil(match.timer)
    this.timerEl.textContent = String(t)
    this.timerEl.classList.toggle('low', t <= 10)
    const touchSuper = document.querySelector('#touch [data-touch="super"]')
    touchSuper?.classList.toggle('ready', f[0].meter >= 100)
  }

  combo(side, hits) {
    const el = side === 0 ? this.combos.left : this.combos.right
    if (hits < 2) return
    el.innerHTML = `${hits} HIT COMBO`
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
  }

  announce(text, cls = '') {
    const el = this.announceEl
    el.textContent = text
    el.className = cls
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
    this.lastAnnounce = text
  }

  clearAnnounce() { this.announceEl.classList.remove('show') }

  flash(color = '#fff', ms = 120) {
    const el = this.flashEl
    el.style.background = color
    // Use the Web Animations API so the fade is time-based: a stalled or slow
    // frame can no longer leave an 85% white overlay stuck on the screen.
    if (el._anim) { try { el._anim.cancel() } catch {} el._anim = null }
    if (el.animate) {
      el.style.opacity = '1'
      el._anim = el.animate(
        [{ opacity: 0.85 }, { opacity: 0 }],
        { duration: Math.max(60, ms), easing: 'ease-out', fill: 'forwards' },
      )
      try { el._anim.onfinish = () => { el.style.opacity = '0'; el._anim = null } } catch {}
    } else {
      el.style.transition = 'none'
      el.style.opacity = '0.85'
      setTimeout(() => {
        el.style.transition = `opacity ${ms}ms ease-out`
        el.style.opacity = '0'
      }, 16)
    }
  }

  showSuperBanner(charId, name, superName, side) {
    const c = CHARACTERS[charId]
    this.superBanner.style.setProperty('--accent', c.accent)
    this.superBanner.innerHTML = `<img src="${portrait(charId, 160)}" alt=""><div><small>${name}</small><span>${superName}!</span></div>`
    this.superBanner.className = side === 1 ? 'from-right' : ''
    void this.superBanner.offsetWidth
    this.superBanner.classList.add('show')
  }

  popup(text, x, y, cls = '') {
    const el = document.createElement('div')
    el.className = 'popup ' + cls
    el.textContent = text
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    this.popups.appendChild(el)
    setTimeout(() => el.remove(), 1200)
  }

  speech(text, x, y) {
    const el = document.createElement('div')
    el.className = 'speech'
    el.textContent = text
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    this.popups.appendChild(el)
    setTimeout(() => el.remove(), 2100)
  }

  setVignette(on) { this.vignette.classList.toggle('on', on) }

  /* ---------------- newsdesk ---------------- */
  pushTicker(text, breaking = false) {
    const item = document.createElement('div')
    item.className = 'item' + (breaking ? ' breaking' : '')
    item.textContent = text
    this.tickerTrack.appendChild(item)
    this.tickerItems.push(item)
    if (this.tickerItems.length > 14) {
      const old = this.tickerItems.shift()
      old.remove()
    }
    this.tickerDirty = true
  }

  updateTicker(dt) {
    if (!this.tickerTrack) return
    const w = this.tickerTrack.scrollWidth
    if (!w) return
    this.tickerOffset -= this.tickerSpeed * dt
    if (this.tickerOffset < -w / 2) this.tickerOffset = 0
    this.tickerTrack.style.transform = `translateX(${this.tickerOffset}px)`
  }

  commentary(which, line, hold = 2.2) {
    const a = this.anchors[which]
    if (!a) return
    a.querySelector('.line').textContent = line
    a.classList.add('talking')
    clearTimeout(a._t)
    a._t = setTimeout(() => a.classList.remove('talking'), hold * 1000)
  }

  setAnchors(charIds) {
    const order = charIds
    const godiId = order[0] === 'modi' || order[1] === 'rahul' ? order[0] : order[1] === 'modi' ? order[1] : order[0]
    const trollId = godiId === order[0] ? order[1] : order[0]
    this.anchors.godi.querySelector('img').src = portrait(godiId, 120)
    this.anchors.troll.querySelector('img').src = portrait(trollId, 120)
    this.anchors.godi.querySelector('.channel').textContent = 'GODI MEDIA'
    this.anchors.troll.querySelector('.channel').textContent = 'TROLL ARMY'
    this.anchors.godi.querySelector('.who').textContent = 'SHOR SHARMA'
    this.anchors.troll.querySelector('.who').textContent = 'TWEETY TROLLWALA'
  }

  /* ---------------- result ---------------- */
  showResult({ win, winnerChar, playerChar, perfect, timeUp, wins }) {
    const w = CHARACTERS[winnerChar]
    const copy = win ? RESULT_COPY.win : RESULT_COPY.lose
    const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    $('#paper-date').textContent = `${date} · Late City Edition · Price: ₹7`
    $('#paper-headline').textContent = copy.headline.replace('{W}', w.name)
    $('#paper-sub').textContent = copy.sub
    $('#paper-excuse').textContent = copy.excuse
    $('#paper-caption').textContent = copy.caption
    $('#paper-photo').src = portrait(winnerChar, 420)
    const stamp = $('#result-title')
    stamp.textContent = win ? 'YOU WIN!' : 'YOU LOSE'
    stamp.className = 'stamp ' + (win ? 'win' : 'lose')
    $('#result-sub').textContent = win
      ? `${CHARACTERS[playerChar].name} takes it ${wins[0]}–${wins[1]}${perfect ? ' · PERFECT!' : ''}`
      : `${CHARACTERS[playerChar].name} falls ${wins[0]}–${wins[1]}${timeUp ? ' · TIME UP' : ''}`
    this.show('result')
  }

  setSoundIcon(muted) {
    this.soundBtn.textContent = muted ? '🔇' : '🔊'
  }

  setPauseSound(on) {
    const b = $('#pause-sound-btn')
    if (b) b.textContent = `SOUND: ${on ? 'ON' : 'OFF'}`
  }
}
