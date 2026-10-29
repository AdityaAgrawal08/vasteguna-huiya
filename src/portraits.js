import { CHARACTERS } from './game/data.js'

const cache = new Map()

function hex(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

function shade(n, f) {
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f))
  const b = Math.max(0, Math.min(255, (n & 255) * f))
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

/** Draw a stylised 2D caricature portrait on a canvas. Cached as data URL. */
export function portrait(charId, size = 256) {
  const key = charId + ':' + size
  if (cache.has(key)) return cache.get(key)
  const char = CHARACTERS[charId]
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  const S = size
  const look = char.look

  // backdrop
  const bg = ctx.createRadialGradient(S * 0.5, S * 0.35, S * 0.05, S * 0.5, S * 0.55, S * 0.75)
  bg.addColorStop(0, shade(parseInt(char.accent.slice(1), 16), 0.85))
  bg.addColorStop(0.55, shade(parseInt(char.accent.slice(1), 16), 0.35))
  bg.addColorStop(1, '#150a04')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // sun rays
  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.translate(S / 2, S * 0.52)
  for (let i = 0; i < 14; i++) {
    ctx.rotate(Math.PI / 7)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(S * 0.9, -S * 0.05)
    ctx.lineTo(S * 0.9, S * 0.05)
    ctx.fill()
  }
  ctx.restore()

  const cx = S * 0.5
  const headY = S * 0.46
  const headR = S * 0.235

  // shoulders / clothing
  ctx.fillStyle = hex(look.jacket)
  ctx.beginPath()
  ctx.ellipse(cx, S * 1.08, S * 0.52, S * 0.38, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = hex(look.top)
  ctx.beginPath()
  ctx.ellipse(cx, S * 1.1, S * 0.3, S * 0.32, 0, Math.PI, 0)
  ctx.fill()
  if (look.topStyle === 'kurta-jacket') {
    ctx.strokeStyle = shade(parseInt(char.accent.slice(1), 16), 0.9)
    ctx.lineWidth = S * 0.02
    ctx.beginPath()
    ctx.moveTo(cx, S * 0.78)
    ctx.lineTo(cx, S)
    ctx.stroke()
  }
  if (look.topStyle === 'sari') {
    ctx.strokeStyle = shade(parseInt(char.accent.slice(1), 16), 1.1)
    ctx.lineWidth = S * 0.07
    ctx.beginPath()
    ctx.moveTo(cx - S * 0.3, S * 0.82)
    ctx.lineTo(cx + S * 0.32, S)
    ctx.stroke()
  }

  // neck
  ctx.fillStyle = hex(look.skinShade)
  ctx.fillRect(cx - headR * 0.28, headY + headR * 0.7, headR * 0.56, headR * 0.55)

  // ears
  ctx.fillStyle = hex(look.skin)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(cx + s * headR * 0.98, headY + headR * 0.1, headR * 0.16, headR * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // head
  const skinGrad = ctx.createRadialGradient(cx - headR * 0.3, headY - headR * 0.35, headR * 0.2, cx, headY, headR * 1.15)
  skinGrad.addColorStop(0, shade(look.skin, 1.08))
  skinGrad.addColorStop(1, shade(look.skinShade, 0.98))
  ctx.fillStyle = skinGrad
  ctx.beginPath()
  ctx.ellipse(cx, headY, headR * 0.92, headR * 1.06, 0, 0, Math.PI * 2)
  ctx.fill()

  // hair
  ctx.fillStyle = hex(look.hair)
  if (look.hairStyle === 'receding') {
    ctx.beginPath()
    ctx.ellipse(cx, headY - headR * 0.72, headR * 0.92, headR * 0.42, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(cx + s * headR * 0.78, headY - headR * 0.15, headR * 0.18, headR * 0.34, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (look.hairStyle === 'side-part') {
    ctx.beginPath()
    ctx.ellipse(cx, headY - headR * 0.58, headR * 0.98, headR * 0.62, -0.1, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + headR * 0.55, headY - headR * 0.42, headR * 0.5, headR * 0.3, 0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (look.hairStyle === 'bun') {
    ctx.beginPath()
    ctx.ellipse(cx, headY - headR * 0.55, headR * 1.0, headR * 0.68, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, headY - headR * 1.2, headR * 0.34, 0, Math.PI * 2)
    ctx.fill()
  }

  // brows
  ctx.strokeStyle = hex(look.brows)
  ctx.lineWidth = S * 0.018
  ctx.lineCap = 'round'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * headR * 0.18, headY - headR * 0.2)
    ctx.lineTo(cx + s * headR * 0.55, headY - headR * 0.26)
    ctx.stroke()
  }

  // eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(cx + s * headR * 0.38, headY - headR * 0.02, headR * 0.17, headR * 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#241a12'
    ctx.beginPath()
    ctx.arc(cx + s * headR * 0.38, headY - headR * 0.02, headR * 0.075, 0, Math.PI * 2)
    ctx.fill()
  }

  // nose
  ctx.strokeStyle = shade(look.skinShade, 0.85)
  ctx.lineWidth = S * 0.02
  ctx.beginPath()
  ctx.moveTo(cx - headR * 0.03, headY + headR * 0.08)
  ctx.lineTo(cx - headR * 0.12, headY + headR * 0.32)
  ctx.lineTo(cx + headR * 0.06, headY + headR * 0.34)
  ctx.stroke()

  // mouth
  ctx.strokeStyle = '#5a2a20'
  ctx.lineWidth = S * 0.016
  ctx.beginPath()
  ctx.arc(cx, headY + headR * 0.42, headR * 0.3, 0.25, Math.PI - 0.25)
  ctx.stroke()

  // beard
  if (look.beardStyle === 'full-white') {
    ctx.fillStyle = hex(look.beard)
    ctx.beginPath()
    ctx.ellipse(cx, headY + headR * 0.7, headR * 0.72, headR * 0.56, 0, 0, Math.PI)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx, headY + headR * 0.44, headR * 0.5, headR * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = shade(look.skinShade, 0.9)
    ctx.beginPath()
    ctx.ellipse(cx, headY + headR * 0.48, headR * 0.2, headR * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (look.beardStyle === 'stubble-grey') {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = hex(look.beard)
    ctx.beginPath()
    ctx.ellipse(cx, headY + headR * 0.68, headR * 0.66, headR * 0.5, 0, 0, Math.PI)
    ctx.fill()
    ctx.restore()
  }

  // glasses
  if (look.glasses) {
    ctx.strokeStyle = '#1c1a18'
    ctx.lineWidth = S * 0.018
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(cx + s * headR * 0.38, headY - headR * 0.02, headR * 0.26, headR * 0.18, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - headR * 0.12, headY - headR * 0.02)
    ctx.lineTo(cx + headR * 0.12, headY - headR * 0.02)
    ctx.stroke()
  }

  // vignette
  const vg = ctx.createRadialGradient(cx, S * 0.45, S * 0.25, cx, S * 0.5, S * 0.8)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, S, S)

  // accent bottom bar
  ctx.fillStyle = char.accent
  ctx.fillRect(0, S - S * 0.035, S, S * 0.035)

  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}

export function allPortraits(size = 256) {
  const out = {}
  for (const id of Object.keys(CHARACTERS)) out[id] = portrait(id, size)
  return out
}
