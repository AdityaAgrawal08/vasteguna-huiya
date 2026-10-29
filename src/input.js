import { emptyInput } from './game/engine.js'

const KEYMAP = {
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  KeyJ: 'punch', KeyK: 'kick', KeyI: 'grab', KeyL: 'super', Space: 'super',
}

const P2MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Numpad1: 'punch', Numpad2: 'kick', Numpad3: 'grab', Numpad0: 'super',
}

export class Input {
  constructor() {
    this.keys = new Set()
    this.pressed = new Set()
    this.touch = { moveX: 0, up: false, down: false }
    this.touchButtons = new Set()
    this.touchPressed = new Set()
    this.enabled = false
    this.onGlobal = null

    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (KEYMAP[e.code] || e.code === 'Enter') e.preventDefault()
        return
      }
      if (KEYMAP[e.code] || e.code === 'Enter') e.preventDefault()
      this.keys.add(e.code)
      this.pressed.add(e.code)
      this.onGlobal?.(e)
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.touchButtons.clear()
      this.touch.moveX = 0
      this.touch.up = this.touch.down = false
    })
  }

  isDown(action) {
    for (const [code, a] of Object.entries(KEYMAP)) if (a === action && this.keys.has(code)) return true
    return false
  }

  /** Edge-triggered action: true once per key press. */
  consume(action) {
    for (const [code, a] of Object.entries(KEYMAP)) {
      if (a === action && this.pressed.has(code)) { this.pressed.delete(code); return true }
    }
    if (this.touchPressed.has(action)) { this.touchPressed.delete(action); return true }
    return false
  }

  getInput() {
    const input = emptyInput()
    if (!this.enabled) return input
    if (this.isDown('left')) input.moveX -= 1
    if (this.isDown('right')) input.moveX += 1
    input.moveX += this.touch.moveX
    input.moveX = Math.max(-1, Math.min(1, input.moveX))
    input.up = this.isDown('up') || this.touch.up
    input.down = this.isDown('down') || this.touch.down
    input.punch = this.consume('punch')
    input.kick = this.consume('kick')
    input.grab = this.consume('grab')
    input.super = this.consume('super')
    if (input.grab) { input.punch = false; input.kick = false }
    return input
  }

  endFrame() {
    this.pressed.clear()
    this.touchPressed.clear()
  }

  /** Second local player: arrows to move, numpad 1/2/3 punch/kick/grab, 0 super. */
  getP2Input() {
    const input = emptyInput()
    if (!this.enabled) return input
    for (const [code, action] of Object.entries(P2MAP)) {
      if (!this.keys.has(code)) continue
      if (action === 'left') input.moveX -= 1
      else if (action === 'right') input.moveX += 1
      else if (action === 'up') input.up = true
      else if (action === 'down') input.down = true
    }
    for (const action of ['punch', 'kick', 'grab', 'super']) {
      for (const [code, a] of Object.entries(P2MAP)) {
        if (a === action && this.pressed.has(code)) {
          input[action] = true
          this.pressed.delete(code)
        }
      }
    }
    if (input.grab) { input.punch = false; input.kick = false }
    return input
  }

  bindTouch(root) {
    if (!root) return
    const stick = root.querySelector('.stick')
    const knob = root.querySelector('.knob')
    let active = false
    let id = null
    let cx = 0, cy = 0

    const setKnob = (dx, dy) => {
      const max = 44
      const d = Math.hypot(dx, dy)
      const s = d > max ? max / d : 1
      knob.style.transform = `translate(${dx * s}px, ${dy * s}px)`
    }
    const move = (e) => {
      if (!active || (id !== null && e.pointerId !== id)) return
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      setKnob(dx, dy)
      this.touch.moveX = Math.abs(dx) > 12 ? Math.max(-1, Math.min(1, dx / 46)) : 0
      this.touch.up = dy < -22
      this.touch.down = dy > 22
      if (this.touch.up) this.touch.down = false
    }
    const end = (e) => {
      if (id !== null && e.pointerId !== id) return
      active = false
      id = null
      stick.classList.remove('active')
      knob.style.transform = ''
      this.touch.moveX = 0
      this.touch.up = this.touch.down = false
    }
    stick.addEventListener('pointerdown', (e) => {
      active = true
      id = e.pointerId
      stick.classList.add('active')
      const r = stick.getBoundingClientRect()
      cx = r.left + r.width / 2
      cy = r.top + r.height / 2
      stick.setPointerCapture?.(e.pointerId)
      move(e)
      e.preventDefault()
    })
    stick.addEventListener('pointermove', move)
    stick.addEventListener('pointerup', end)
    stick.addEventListener('pointercancel', end)

    for (const btn of root.querySelectorAll('[data-touch]')) {
      const action = btn.dataset.touch
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        btn.classList.add('active')
        this.touchButtons.add(action)
        this.touchPressed.add(action)
        btn.setPointerCapture?.(e.pointerId)
      })
      const up = () => { btn.classList.remove('active'); this.touchButtons.delete(action) }
      btn.addEventListener('pointerup', up)
      btn.addEventListener('pointercancel', up)
      btn.addEventListener('pointerleave', up)
    }
  }
}

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}
