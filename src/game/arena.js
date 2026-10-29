// Procedural 3D stages for Sansad Showdown.
// Everything here is generated from primitives and small canvas textures.
// The arena is deliberately self contained: createArena() owns a group,
// a camera, three lighting rigs and all of the stage props.

import * as THREE from 'three'
import { STAGE_PALETTES, STAGES, stageSeed } from './data.js'

const TAU = Math.PI * 2
const GROUND_Y = -1.2
const HALF_X = 11.8
const HALF_Z = 5.8

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const css = (hex) => `#${new THREE.Color(hex).getHexString()}`
function rgba(hex, alpha) {
  const h = new THREE.Color(hex).getHexString()
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  draw(g, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = 4
  return tex
}

function makeStoneTexture(base, fleck, seed, opts = {}) {
  const rng = stageSeed(seed)
  return canvasTexture(512, 512, (g, s) => {
    g.fillStyle = css(base)
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 1900; i++) {
      g.fillStyle = rgba(fleck, 0.03 + rng() * 0.11)
      const r = 0.5 + rng() * 2.6
      g.fillRect(rng() * s, rng() * s, r, r)
    }
    if (opts.joints) {
      g.strokeStyle = 'rgba(45,26,18,0.18)'
      g.lineWidth = 1.6
      const step = s / 4
      for (let x = 0; x <= s; x += step) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke()
      }
      for (let y = 0; y <= s; y += step) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke()
      }
      g.strokeStyle = 'rgba(255,235,200,0.08)'
      g.lineWidth = 1
      for (let x = 0; x <= s; x += step) {
        g.beginPath(); g.moveTo(x + 2, 0); g.lineTo(x + 2, s); g.stroke()
      }
    }
    if (opts.cracks) {
      g.strokeStyle = 'rgba(24,22,20,0.30)'
      for (let i = 0; i < 16; i++) {
        let x = rng() * s
        let y = rng() * s
        g.lineWidth = 0.8 + rng() * 1.4
        g.beginPath(); g.moveTo(x, y)
        for (let k = 0; k < 4; k++) {
          x += (rng() - 0.5) * 46
          y += (rng() - 0.5) * 46
          g.lineTo(x, y)
        }
        g.stroke()
      }
    }
    if (opts.grass) {
      for (let i = 0; i < 2600; i++) {
        const x = rng() * s
        const y = rng() * s
        const len = 2 + rng() * 7
        g.strokeStyle = rng() > 0.5 ? 'rgba(38,78,32,0.26)' : 'rgba(160,190,120,0.16)'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 3, y - len); g.stroke()
      }
    }
  }, { repeat: opts.repeat || [5, 2.5] })
}

function makeStripeTexture(a, b) {
  return canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = css(a)
    g.fillRect(0, 0, w, h)
    g.fillStyle = css(b)
    for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 12, h)
  }, { repeat: [3, 1] })
}

function makeShutterTexture() {
  const rng = stageSeed(404)
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#899397'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 10) {
      g.fillStyle = y % 20 === 0 ? 'rgba(40,46,48,0.32)' : 'rgba(235,240,238,0.14)'
      g.fillRect(0, y, w, 4)
    }
    g.strokeStyle = 'rgba(30,34,34,0.45)'
    g.lineWidth = 5
    g.strokeRect(4, 4, w - 8, h - 8)
    g.strokeStyle = 'rgba(220,60,40,0.32)'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(30, 190)
    g.bezierCurveTo(80, 130, 130, 220, 220, 150)
    g.stroke()
    g.fillStyle = 'rgba(20,20,20,0.28)'
    for (let i = 0; i < 70; i++) g.fillRect(rng() * w, rng() * h, 2, 2)
  })
}

function makeSignTexture(text, bg, fg, opts = {}) {
  const w = opts.w || 512
  const h = opts.h || 128
  return canvasTexture(w, h, (g) => {
    g.fillStyle = css(bg)
    g.fillRect(0, 0, w, h)
    if (opts.accent != null) {
      g.fillStyle = css(opts.accent)
      g.fillRect(0, 0, w, Math.max(5, h * 0.07))
      g.fillRect(0, h - Math.max(5, h * 0.07), w, Math.max(5, h * 0.07))
    }
    g.strokeStyle = css(opts.border != null ? opts.border : fg)
    g.lineWidth = Math.max(4, h * 0.045)
    g.strokeRect(g.lineWidth / 2 + 3, g.lineWidth / 2 + 3, w - g.lineWidth - 6, h - g.lineWidth - 6)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (opts.sub) {
      g.fillStyle = css(fg)
      g.font = `bold ${Math.floor(h * 0.40)}px Impact, "Arial Black", sans-serif`
      g.fillText(text, w / 2, h * 0.39, w - 40)
      g.font = `bold ${Math.floor(h * 0.17)}px Arial, sans-serif`
      g.globalAlpha = 0.9
      g.fillText(opts.sub, w / 2, h * 0.76, w - 40)
      g.globalAlpha = 1
    } else {
      g.fillStyle = css(fg)
      g.font = `bold ${Math.floor(h * 0.50)}px Impact, "Arial Black", sans-serif`
      g.fillText(text, w / 2, h * 0.53, w - 40)
    }
  })
}

function makePlacardTexture(text, bg, fg) {
  return canvasTexture(256, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#6b4a2a'
    g.fillRect(w / 2 - 4, h * 0.58, 8, h * 0.42)
    g.fillStyle = css(bg)
    g.fillRect(14, 8, w - 28, h * 0.55)
    g.strokeStyle = css(fg)
    g.lineWidth = 6
    g.strokeRect(18, 12, w - 36, h * 0.55 - 8)
    g.fillStyle = css(fg)
    g.font = 'bold 30px Impact, "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, w / 2, h * 0.31, w - 44)
  })
}

function makeMiniFlagTexture() {
  return canvasTexture(128, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#6b4a2a'
    g.fillRect(18, 54, 6, 106)
    const bands = ['#ff9933', '#ffffff', '#138808']
    for (let i = 0; i < 3; i++) {
      g.fillStyle = bands[i]
      g.fillRect(24, 10 + i * 18, 96, 18)
    }
    g.strokeStyle = '#000080'
    g.lineWidth = 3
    g.beginPath(); g.arc(72, 37, 9, 0, TAU); g.stroke()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      g.beginPath()
      g.moveTo(72, 37)
      g.lineTo(72 + Math.cos(a) * 8, 37 + Math.sin(a) * 8)
      g.stroke()
    }
  })
}

function makeFlagTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const bands = ['#ff9933', '#ffffff', '#138808']
    for (let i = 0; i < 3; i++) {
      g.fillStyle = bands[i]
      g.fillRect(0, (i * h) / 3, w, h / 3)
    }
    g.strokeStyle = '#000080'
    g.lineWidth = 4
    g.beginPath(); g.arc(w / 2, h / 2, 17, 0, TAU); g.stroke()
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU
      g.beginPath()
      g.moveTo(w / 2, h / 2)
      g.lineTo(w / 2 + Math.cos(a) * 16, h / 2 + Math.sin(a) * 16)
      g.stroke()
    }
  })
}

function makeWaterTexture() {
  const rng = stageSeed(808)
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#397f8e'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = `rgba(190,240,245,${0.08 + rng() * 0.12})`
      g.lineWidth = 1 + rng() * 2
      g.beginPath()
      g.arc(w / 2, h / 2, 10 + i * 10 + rng() * 5, 0, TAU)
      g.stroke()
    }
    for (let i = 0; i < 180; i++) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.08})`
      g.fillRect(rng() * w, rng() * h, 1 + rng() * 4, 1)
    }
  })
}

function makeSunTexture(hex) {
  return canvasTexture(256, 256, (g, s) => {
    g.clearRect(0, 0, s, s)
    const grad = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.10, css(hex))
    grad.addColorStop(0.20, rgba(hex, 0.92))
    grad.addColorStop(0.45, rgba(hex, 0.30))
    grad.addColorStop(0.72, rgba(hex, 0.08))
    grad.addColorStop(1, rgba(hex, 0))
    g.fillStyle = grad
    g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill()
  })
}

function makeSoftDotTexture() {
  return canvasTexture(64, 64, (g, s) => {
    g.clearRect(0, 0, s, s)
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, TAU); g.fill()
  })
}

function buildSky(ctx) {
  const { root, pal } = ctx
  const geo = new THREE.SphereGeometry(170, 32, 18)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const bottom = new THREE.Color(pal.skyBottom)
  const mid = new THREE.Color(pal.skyMid)
  const top = new THREE.Color(pal.skyTop)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const h = clamp((pos.getY(i) / 170) * 0.5 + 0.5, 0, 1)
    if (h < 0.62) c.copy(bottom).lerp(mid, smoothstep(0.46, 0.62, h))
    else c.copy(mid).lerp(top, smoothstep(0.62, 0.97, h))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  })
  const sky = new THREE.Mesh(geo, mat)
  sky.renderOrder = -100
  sky.frustumCulled = false
  root.add(sky)
}

function buildSun(ctx) {
  const { root, pal, stage, addAnimator } = ctx
  const tex = makeSunTexture(pal.sunDiscColor)
  const coreMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false,
  })
  const core = new THREE.Sprite(coreMat)
  core.position.set(pal.sunDisc[0], pal.sunDisc[1], pal.sunDisc[2])
  const size = stage === 'sansad' ? 16 : 13
  core.scale.set(size, size, 1)
  core.renderOrder = -60
  root.add(core)

  const glowMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.38, depthWrite: false, fog: false,
    toneMapped: false, blending: THREE.AdditiveBlending,
  })
  const glow = new THREE.Sprite(glowMat)
  glow.position.copy(core.position)
  glow.scale.set(size * 3.2, size * 3.2, 1)
  glow.renderOrder = -61
  root.add(glow)
  addAnimator((dt, t) => {
    glowMat.opacity = 0.32 + Math.sin(t * 0.45) * 0.05
  })
}

function buildClouds(ctx, opts = {}) {
  const { root, rng, addAnimator } = ctx
  const count = opts.count || 10
  const geo = new THREE.SphereGeometry(1, 8, 5)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: opts.opacity || 0.28,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.renderOrder = -70
  mesh.frustumCulled = false
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  const tint = opts.tint || 0xffffff
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU
    const rad = 55 + rng() * 60
    dummy.position.set(Math.cos(a) * rad, (opts.minY || 24) + rng() * (opts.spreadY || 18), -72 - rng() * 45)
    dummy.scale.set(8 + rng() * 13, 2 + rng() * 3.5, 4 + rng() * 7)
    dummy.rotation.set(0, rng() * TAU, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    col.setHex(tint).offsetHSL(0, 0, (rng() - 0.5) * 0.12)
    mesh.setColorAt(i, col)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  root.add(mesh)
  addAnimator((dt, t) => {
    mesh.rotation.y = Math.sin(t * 0.008) * 0.025
  })
}

function buildGround(ctx, opts) {
  const tex = makeStoneTexture(opts.base, opts.fleck, opts.seed, {
    repeat: opts.repeat || [34, 24],
    cracks: !!opts.cracks,
    grass: !!opts.grass,
  })
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: opts.roughness != null ? opts.roughness : 0.95, metalness: 0,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 180), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = GROUND_Y - 0.02
  mesh.receiveShadow = true
  ctx.root.add(mesh)
}

const FLOOR_STYLE = {
  sansad: { base: 0xc3a274, fleck: 0xe1c697, seed: 311, trim: 0x7a3b34, joints: true, repeat: [5, 2.4] },
  jantar: { base: 0xb05a44, fleck: 0xd58a6a, seed: 523, trim: 0xe8d8b0, joints: true, repeat: [5, 2.4] },
  road: { base: 0x4d4b46, fleck: 0x6c6860, seed: 733, trim: 0xc9a040, cracks: true, repeat: [4, 2] },
}

function buildPlatform(ctx, stage) {
  const { root, pal } = ctx
  const style = FLOOR_STYLE[stage]
  const floorTex = makeStoneTexture(style.base, style.fleck, style.seed, {
    repeat: style.repeat, joints: style.joints, cracks: style.cracks,
  })
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, roughness: pal.floorRoughness, metalness: 0.03,
  })
  const sideMat = new THREE.MeshStandardMaterial({
    color: pal.platformSide, roughness: 0.86, metalness: 0.04,
  })
  const trimMat = new THREE.MeshStandardMaterial({
    color: style.trim, roughness: 0.58, metalness: 0.18,
  })
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(HALF_X * 2, 1.2, HALF_Z * 2),
    [sideMat, sideMat, floorMat, sideMat, sideMat, sideMat],
  )
  box.position.y = -0.6
  box.castShadow = true
  box.receiveShadow = true
  root.add(box)

  const step = new THREE.Mesh(new THREE.BoxGeometry(HALF_X * 2 + 1.8, 0.34, HALF_Z * 2 + 1.8), sideMat)
  step.position.y = -1.03
  step.castShadow = true
  step.receiveShadow = true
  root.add(step)

  // top edge trim
  const longGeo = new THREE.BoxGeometry(HALF_X * 2 + 0.1, 0.035, 0.22)
  const shortGeo = new THREE.BoxGeometry(0.22, 0.035, HALF_Z * 2 + 0.1)
  for (const z of [-HALF_Z + 0.1, HALF_Z - 0.1]) {
    const m = new THREE.Mesh(longGeo, trimMat)
    m.position.set(0, 0.018, z)
    m.receiveShadow = true
    root.add(m)
  }
  for (const x of [-HALF_X + 0.1, HALF_X - 0.1]) {
    const m = new THREE.Mesh(shortGeo, trimMat)
    m.position.set(x, 0.018, 0)
    m.receiveShadow = true
    root.add(m)
  }

  // a little relief on the front face of the stage
  const darkMat = new THREE.MeshStandardMaterial({ color: pal.platformSide, roughness: 0.92 })
  darkMat.color.offsetHSL(0, 0, -0.09)
  const band = new THREE.Mesh(new THREE.BoxGeometry(HALF_X * 2, 0.08, 0.06), trimMat)
  band.position.set(0, -0.42, HALF_Z + 0.03)
  root.add(band)
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.9, 0.08), darkMat, 7)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 7; i++) {
    dummy.position.set(-9 + i * 3, -0.58, HALF_Z + 0.04)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    posts.setMatrixAt(i, dummy.matrix)
  }
  posts.castShadow = false
  root.add(posts)

  buildInlay(ctx, stage)
}

function addFlatRing(root, inner, outer, mat, y, segments = 64) {
  const geo = new THREE.RingGeometry(inner, outer, segments)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  mesh.receiveShadow = true
  root.add(mesh)
  return mesh
}

function buildInlay(ctx, stage) {
  const { root } = ctx
  if (stage === 'sansad') {
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9973e, roughness: 0.48, metalness: 0.35 })
    const red = new THREE.MeshStandardMaterial({ color: 0x7d3534, roughness: 0.66 })
    addFlatRing(root, 4.1, 4.45, red, 0.012)
    addFlatRing(root, 5.2, 5.38, gold, 0.013)
    const hub = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), gold)
    hub.rotation.x = -Math.PI / 2
    hub.position.y = 0.014
    root.add(hub)
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.018, 3.15), gold, 16)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU
      dummy.position.set(Math.cos(a) * 2.72, 0.015, Math.sin(a) * 2.72)
      dummy.rotation.set(0, Math.PI / 2 - a, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      spokes.setMatrixAt(i, dummy.matrix)
    }
    root.add(spokes)
  } else if (stage === 'jantar') {
    const cream = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.7 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x7d3228, roughness: 0.8 })
    addFlatRing(root, 4.7, 4.98, cream, 0.012)
    addFlatRing(root, 3.35, 3.52, cream, 0.012)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), cream)
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.013
    root.add(disc)
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.56, 24), dark)
    inner.rotation.x = -Math.PI / 2
    inner.position.y = 0.014
    root.add(inner)
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.012, 2.7), cream, 12)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      dummy.position.set(Math.cos(a) * 2.0, 0.014, Math.sin(a) * 2.0)
      dummy.rotation.set(0, Math.PI / 2 - a, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      spokes.setMatrixAt(i, dummy.matrix)
    }
    root.add(spokes)
    const borderMat = cream
    for (const [x, z, w, d] of [[0, -4.1, 8.4, 0.1], [0, 4.1, 8.4, 0.1], [-4.1, 0, 0.1, 8.4], [4.1, 0, 0.1, 8.4]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), borderMat)
      m.position.set(x, 0.013, z)
      root.add(m)
    }
  } else {
    const yellow = new THREE.MeshStandardMaterial({
      color: 0xd2ab44, roughness: 0.72, transparent: true, opacity: 0.62,
    })
    addFlatRing(root, 4.6, 4.82, yellow, 0.012)
    const white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 })
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.012, 0.13), white, 18)
    const dummy = new THREE.Object3D()
    let n = 0
    for (let i = 0; i < 9; i++) {
      for (const z of [-3.35, 3.35]) {
        dummy.position.set(-9.6 + i * 2.4, 0.014, z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        dashes.setMatrixAt(n++, dummy.matrix)
      }
    }
    root.add(dashes)
    const metal = new THREE.MeshStandardMaterial({ color: 0x353a3a, roughness: 0.6, metalness: 0.55 })
    for (const [x, z] of [[-6.4, 2.2], [6.4, 2.2], [-6.4, -2.2], [6.4, -2.2]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 16), metal)
      m.position.set(x, 0.016, z)
      root.add(m)
    }
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x25231f, roughness: 0.98 })
    for (const [x, z, r] of [[-7.6, 3.4, 0.55], [7.9, -2.7, 0.42], [2.2, 4.0, 0.3]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), holeMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, 0.016, z)
      root.add(m)
    }
  }
}

const RAIL_STYLE = {
  sansad: { color: 0x5b3a2a, metal: 0.28 },
  jantar: { color: 0x6b4326, metal: 0.0 },
  road: { color: 0x7d817f, metal: 0.58 },
}

function buildRailing(ctx, stage) {
  const { root } = ctx
  const style = RAIL_STYLE[stage]
  const mat = new THREE.MeshStandardMaterial({
    color: style.color, roughness: 0.62, metalness: style.metal,
  })
  const positions = []
  for (let i = 0; i < 13; i++) positions.push([-10.8 + i * 1.8, -HALF_Z + 0.25])
  for (let i = 0; i < 6; i++) positions.push([-HALF_X + 0.25, -4.5 + i * 1.8])
  for (let i = 0; i < 6; i++) positions.push([HALF_X - 0.25, -4.5 + i * 1.8])
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.88, 0.09), mat, positions.length)
  const dummy = new THREE.Object3D()
  positions.forEach(([x, z], i) => {
    dummy.position.set(x, 0.44, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    posts.setMatrixAt(i, dummy.matrix)
  })
  posts.castShadow = true
  root.add(posts)
  const rails = [
    [HALF_X * 2 - 1.6, 0.06, 0.06, 0, 0.82, -HALF_Z + 0.25],
    [0.06, 0.06, HALF_Z * 2 - 1.6, -HALF_X + 0.25, 0.82, 0],
    [0.06, 0.06, HALF_Z * 2 - 1.6, HALF_X - 0.25, 0.82, 0],
  ]
  for (const [w, h, d, x, y, z] of rails) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    root.add(m)
  }
}

function crowdPositions(stage, rng) {
  const out = []
  const backZ = stage === 'road' ? -7.4 : -7.8
  for (let i = 0; i < 16; i++) out.push({ x: -13.2 + i * (26.4 / 15), z: backZ + (i % 2) * 0.3 })
  for (let i = 0; i < 7; i++) out.push({ x: -13.6, z: -4.4 + i * (8.8 / 6) })
  for (let i = 0; i < 7; i++) out.push({ x: 13.6, z: -4.4 + i * (8.8 / 6) })
  // A handful of spectators lean on the front corners of the stage. They sit
  // on the platform top so they read as foreground silhouettes, not as a wall.
  const frontZ = stage === 'road' ? 5.25 : 5.05
  for (let i = 0; i < 5; i++) out.push({ x: -10.2 + i * 1.35, z: frontZ + (i % 2) * 0.2, onStage: true })
  for (let i = 0; i < 5; i++) out.push({ x: 4.8 + i * 1.35, z: frontZ + ((i + 1) % 2) * 0.2, onStage: true })
  const secondZ = stage === 'road' ? -9.2 : -10.2
  for (let i = 0; i < 4; i++) out.push({ x: -8 + i * 5.3, z: secondZ })
  return out
}

const CLOTHES = {
  sansad: [0x3a2a22, 0x4a3028, 0x5a3a2a, 0x7a4a32, 0x2f2a26, 0x6b3a2f, 0x8a5a3a, 0x332a26],
  jantar: [0xe8e0c8, 0x4a7a5a, 0xd8a040, 0xb84a3a, 0x3a5a8a, 0xf0d8b0, 0x8a3a4a, 0x6a8a5a, 0xf4f0e0, 0x2f4a6a],
  road: [0x8a4a3a, 0x4a6a7a, 0xd8b060, 0x6a4a3a, 0xe8d8b8, 0x3a3a3a, 0xa85a3a, 0x5a7a5a],
}
const SKIN = [0xc48c62, 0xa8704a, 0x8a5a3a, 0xd8a878, 0x9c6b48, 0xb87a52]
const TROUSER = [0x2f2a24, 0x3a332a, 0x4a4034, 0x1f1c18, 0x5a4a3a]

function buildCrowd(ctx, stage) {
  const { root, rng, addAnimator } = ctx
  const base = crowdPositions(stage, rng)
  const clothes = CLOTHES[stage]
  const people = base.map((p) => {
    const front = p.z > 4
    const scale = 0.9 + rng() * 0.18
    const col = front
      ? new THREE.Color(0x241c18).offsetHSL(0, 0, (rng() - 0.5) * 0.06)
      : new THREE.Color(clothes[Math.floor(rng() * clothes.length)])
    return {
      x: p.x + (rng() - 0.5) * 0.55,
      z: p.z + (rng() - 0.5) * 0.5,
      scale,
      phase: rng() * TAU,
      rot: Math.atan2(-p.x, -p.z),
      cloth: col,
      skin: new THREE.Color(SKIN[Math.floor(rng() * SKIN.length)]),
      trouser: new THREE.Color(TROUSER[Math.floor(rng() * TROUSER.length)]),
      front,
      baseY: p.onStage ? 0 : GROUND_Y,
    }
  })

  const crowd = new THREE.Group()
  crowd.name = 'crowd-ring'
  root.add(crowd)

  const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 })
  const legMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 })
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.68, 0.3)
  const legGeo = new THREE.BoxGeometry(0.34, 0.72, 0.24)
  const headGeo = new THREE.OctahedronGeometry(0.18, 0)
  const torsos = new THREE.InstancedMesh(torsoGeo, torsoMat, people.length)
  const legs = new THREE.InstancedMesh(legGeo, legMat, people.length)
  const heads = new THREE.InstancedMesh(headGeo, headMat, people.length)
  for (const mesh of [torsos, legs, heads]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.castShadow = false
    mesh.receiveShadow = false
    crowd.add(mesh)
  }
  people.forEach((p, i) => {
    torsos.setColorAt(i, p.cloth)
    legs.setColorAt(i, p.trouser)
    heads.setColorAt(i, p.skin)
  })
  if (torsos.instanceColor) torsos.instanceColor.needsUpdate = true
  if (legs.instanceColor) legs.instanceColor.needsUpdate = true
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true

  const dummy = new THREE.Object3D()
  const props = []
  const makeProp = (geo, mat, indices, kind, baseY) => {
    const mesh = new THREE.InstancedMesh(geo, mat, indices.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.castShadow = false
    crowd.add(mesh)
    props.push({ mesh, indices, kind, baseY })
  }

  if (stage === 'jantar') {
    const placardGeo = new THREE.PlaneGeometry(1.15, 0.72)
    const texA = makePlacardTexture('NAUKRI DO', 0xf2e6c8, 0x9a2a20)
    const texB = makePlacardTexture('JAWAB DO', 0xffe08a, 0x2a4a2a)
    const matA = new THREE.MeshBasicMaterial({ map: texA, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    const matB = new THREE.MeshBasicMaterial({ map: texB, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    makeProp(placardGeo, matA, [0, 2, 4, 6, 8, 10, 12, 14], 'placard', 2.02)
    makeProp(placardGeo, matB, [17, 19, 21, 23, 26, 28, 30, 32], 'placard', 2.02)
  } else if (stage === 'sansad') {
    const flagGeo = new THREE.PlaneGeometry(0.46, 0.56)
    const tex = makeMiniFlagTexture()
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })
    makeProp(flagGeo, mat, [1, 3, 5, 7, 9, 11, 13, 15, 18, 22, 27, 31], 'flag', 1.92)
  } else {
    const phoneGeo = new THREE.PlaneGeometry(0.11, 0.2)
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9, toneMapped: false })
    makeProp(phoneGeo, mat, [2, 6, 10, 14, 20, 24, 30, 36], 'phone', 1.24)
  }

  function pose(t) {
    for (let i = 0; i < people.length; i++) {
      const p = people[i]
      const bob = Math.sin(t * 1.45 + p.phase) * 0.035 + Math.sin(t * 0.67 + p.phase * 1.7) * 0.018
      const sway = Math.sin(t * 0.8 + p.phase) * 0.035

      dummy.position.set(p.x, p.baseY + 0.36 * p.scale, p.z)
      dummy.rotation.set(0, p.rot, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      legs.setMatrixAt(i, dummy.matrix)

      dummy.position.set(p.x, p.baseY + 1.06 * p.scale + bob, p.z)
      dummy.rotation.set(0, p.rot + sway, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      torsos.setMatrixAt(i, dummy.matrix)

      dummy.position.set(p.x, p.baseY + 1.56 * p.scale + bob, p.z)
      dummy.rotation.set(0, p.rot + sway * 1.4, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      heads.setMatrixAt(i, dummy.matrix)
    }
    legs.instanceMatrix.needsUpdate = true
    torsos.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true

    for (const prop of props) {
      for (let k = 0; k < prop.indices.length; k++) {
        const p = people[prop.indices[k]]
        const bob = Math.sin(t * 1.45 + p.phase) * 0.035
        if (prop.kind === 'placard') {
          dummy.position.set(p.x, p.baseY + prop.baseY * p.scale + bob * 1.4, p.z)
          dummy.rotation.set(0, Math.sin(t * 1.2 + p.phase) * 0.08, Math.sin(t * 1.7 + p.phase) * 0.07)
        } else if (prop.kind === 'flag') {
          dummy.position.set(p.x, p.baseY + prop.baseY * p.scale + bob, p.z)
          dummy.rotation.set(0, -0.15 + Math.sin(t * 1.9 + p.phase) * 0.2, Math.sin(t * 2.2 + p.phase) * 0.12)
        } else {
          dummy.position.set(p.x, p.baseY + prop.baseY * p.scale + bob * 0.5, p.z + 0.32)
          dummy.rotation.set(0, 0, 0)
        }
        dummy.scale.setScalar(prop.kind === 'placard' ? 0.92 + p.scale * 0.12 : 1)
        dummy.updateMatrix()
        prop.mesh.setMatrixAt(k, dummy.matrix)
      }
      prop.mesh.instanceMatrix.needsUpdate = true
    }
  }

  pose(0)
  addAnimator((dt, t) => pose(t))
}

function buildParticles(ctx, opts) {
  const { root, rng, addAnimator, particleSystems } = ctx
  const count = opts.count || 240
  const pos = new Float32Array(count * 3)
  const data = []
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * (opts.spreadX || 54)
    const y = GROUND_Y + 0.3 + rng() * (opts.height || 14)
    const z = -32 + rng() * 40
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
    data.push({
      speed: (opts.rise || 0.16) * (0.35 + rng() * 1.4),
      drift: (rng() - 0.5) * 0.16,
      phase: rng() * TAU,
    })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: opts.color || 0xffd8a0,
    size: opts.size || 0.10,
    map: makeSoftDotTexture(),
    transparent: true,
    opacity: opts.opacity != null ? opts.opacity : 0.48,
    depthWrite: false,
    sizeAttenuation: true,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 8
  root.add(points)
  particleSystems.push(points)
  addAnimator((dt, t) => {
    for (let i = 0; i < count; i++) {
      const d = data[i]
      let y = pos[i * 3 + 1] + d.speed * dt
      let x = pos[i * 3] + (d.drift + Math.sin(t * 0.4 + d.phase) * 0.05) * dt
      if (y > GROUND_Y + (opts.height || 14) + 1) {
        y = GROUND_Y + 0.2 + rng() * 1.2
        x = (rng() - 0.5) * (opts.spreadX || 54)
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
    }
    geo.attributes.position.needsUpdate = true
  })
}

function buildSteam(ctx, parent, origin, count = 24) {
  const { rng, addAnimator, particleSystems } = ctx
  const pos = new Float32Array(count * 3)
  const data = []
  for (let i = 0; i < count; i++) {
    pos[i * 3] = origin.x + (rng() - 0.5) * 0.25
    pos[i * 3 + 1] = origin.y + rng() * 0.25
    pos[i * 3 + 2] = origin.z + (rng() - 0.5) * 0.2
    data.push({ speed: 0.18 + rng() * 0.3, phase: rng() * TAU })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xfff0d8, size: 0.13, map: makeSoftDotTexture(),
    transparent: true, opacity: 0.34, depthWrite: false, sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  parent.add(points)
  particleSystems.push(points)
  addAnimator((dt, t) => {
    for (let i = 0; i < count; i++) {
      const d = data[i]
      let y = pos[i * 3 + 1] + d.speed * dt
      let x = pos[i * 3] + Math.sin(t * 1.2 + d.phase) * 0.05 * dt
      if (y > origin.y + 1.3) {
        y = origin.y + 0.05
        x = origin.x + (rng() - 0.5) * 0.25
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
    }
    geo.attributes.position.needsUpdate = true
  })
}

function buildTrees(ctx, positions, canopyColor = 0x2f4a2a) {
  const { root, rng } = ctx
  if (!positions.length) return
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 2.7, 5)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 })
  const canopyGeo = new THREE.IcosahedronGeometry(1.5, 0)
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true })
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, positions.length)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  positions.forEach(([x, z], i) => {
    const h = 0.8 + rng() * 0.6
    dummy.position.set(x, GROUND_Y + 1.35 * h, z)
    dummy.rotation.set(0, rng() * TAU, 0)
    dummy.scale.set(1, h, 1)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)

    dummy.position.set(x, GROUND_Y + 2.75 * h, z)
    dummy.rotation.set(0, rng() * TAU, 0)
    dummy.scale.set(0.85 + rng() * 0.5, 0.65 + rng() * 0.35, 0.85 + rng() * 0.5)
    dummy.updateMatrix()
    canopies.setMatrixAt(i, dummy.matrix)
    col.setHex(canopyColor).offsetHSL(0, 0, (rng() - 0.5) * 0.1)
    canopies.setColorAt(i, col)
  })
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true
  trunks.castShadow = false
  canopies.castShadow = false
  root.add(trunks, canopies)
}

function buildBushes(ctx, positions, color = 0x3f6a35) {
  const { root, rng } = ctx
  if (!positions.length) return
  const geo = new THREE.IcosahedronGeometry(0.55, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  positions.forEach(([x, z], i) => {
    dummy.position.set(x, GROUND_Y + 0.35, z)
    dummy.rotation.set(0, rng() * TAU, 0)
    dummy.scale.set(0.7 + rng() * 0.6, 0.55 + rng() * 0.4, 0.7 + rng() * 0.6)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    col.setHex(color).offsetHSL(0, 0, (rng() - 0.5) * 0.09)
    mesh.setColorAt(i, col)
  })
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  root.add(mesh)
}

// ---------------------------------------------------------------------------
// Sansad Bhavan at sunset
// ---------------------------------------------------------------------------

function buildSansadBuilding(ctx) {
  const { root } = ctx
  const group = new THREE.Group()
  group.position.set(0, GROUND_Y * (1 - 0.82), -35)
  group.scale.setScalar(0.82)
  root.add(group)

  const stoneTex = makeStoneTexture(0xcaa06a, 0xe0bd8c, 902, { joints: true, repeat: [3, 2] })
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.88 })
  const lightStone = new THREE.MeshStandardMaterial({ color: 0xdfc39a, roughness: 0.8 })
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.9 })

  const plinth = [
    [13.2, 0.35, -1.02],
    [12.6, 0.35, -0.67],
    [12.0, 0.9, -0.05],
    [11.5, 0.5, 0.65],
  ]
  for (const [r, h, y] of plinth) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.2, h, 48), stone)
    m.position.y = y
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
  }

  // front steps
  for (let i = 0; i < 5; i++) {
    const h = 0.42 * (i + 1)
    const z = 13.6 + (4 - i) * 1.0
    const m = new THREE.Mesh(new THREE.BoxGeometry(18, h, 1.0), stone)
    m.position.set(0, -1.2 + h / 2, z)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
  }

  // colonnade
  const pillarGeo = new THREE.CylinderGeometry(0.34, 0.42, 6.2, 8)
  const pillars = new THREE.InstancedMesh(pillarGeo, stone, 26)
  const bases = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.28, 0.95), stone, 26)
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.32, 0.95), stone, 26)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU
    const x = Math.cos(a) * 8.9
    const z = Math.sin(a) * 8.9
    dummy.position.set(x, 4.0, z)
    dummy.rotation.set(0, a, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    pillars.setMatrixAt(i, dummy.matrix)
    dummy.position.set(x, 1.04, z)
    dummy.updateMatrix()
    bases.setMatrixAt(i, dummy.matrix)
    dummy.position.set(x, 7.26, z)
    dummy.updateMatrix()
    caps.setMatrixAt(i, dummy.matrix)
  }
  for (const mesh of [pillars, bases, caps]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  const entablature = new THREE.Mesh(new THREE.CylinderGeometry(9.45, 9.45, 0.7, 48, 1, true), stone)
  entablature.position.y = 7.9
  entablature.castShadow = true
  group.add(entablature)
  const topSlab = new THREE.Mesh(new THREE.CylinderGeometry(9.7, 9.7, 0.3, 48), stone)
  topSlab.position.y = 8.38
  topSlab.castShadow = true
  group.add(topSlab)

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(6.7, 6.9, 1.4, 32), lightStone)
  drum.position.y = 9.2
  drum.castShadow = true
  group.add(drum)

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 24, 12, 0, TAU, 0, Math.PI / 2),
    lightStone,
  )
  dome.position.y = 9.9
  dome.scale.y = 0.74
  dome.castShadow = true
  group.add(dome)

  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.5, 8), darkStone)
  finial.position.y = 15.25
  group.add(finial)
  const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), darkStone)
  finialBall.position.y = 16.05
  group.add(finialBall)

  // two side chhatris
  for (const sx of [-7.2, 7.2]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.75, 12), stone)
    base.position.set(sx, 8.75, 0.4)
    base.castShadow = true
    group.add(base)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 12, 6, 0, TAU, 0, Math.PI / 2),
      lightStone,
    )
    cap.position.set(sx, 9.12, 0.4)
    cap.scale.y = 0.72
    cap.castShadow = true
    group.add(cap)
  }

  // warm windows around the drum
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x3a2418, emissive: 0xffa860, emissiveIntensity: 0.65, roughness: 0.6,
  })
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.72, 0.12), windowMat, 16)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    const x = Math.cos(a) * 6.78
    const z = Math.sin(a) * 6.78
    dummy.position.set(x, 9.25, z)
    dummy.rotation.set(0, Math.atan2(x, z), 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    windows.setMatrixAt(i, dummy.matrix)
  }
  group.add(windows)

  // plaque
  const plaqueTex = makeSignTexture('SANSAD BHAVAN', 0x3a2418, 0xe8d0a0, {
    w: 512, h: 96, accent: 0xc9973e,
  })
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 0.9),
    new THREE.MeshBasicMaterial({ map: plaqueTex }),
  )
  plaque.position.set(0, 7.8, 9.48)
  group.add(plaque)
}

function buildFountain(ctx) {
  const { root, addAnimator } = ctx
  const group = new THREE.Group()
  group.position.set(-12.0, GROUND_Y, -13.0)
  root.add(group)
  const stone = new THREE.MeshStandardMaterial({ color: 0x9b8b70, roughness: 0.85 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x6a5a46, roughness: 0.9 })
  const waterTex = makeWaterTexture()
  const water = new THREE.MeshStandardMaterial({
    map: waterTex, color: 0x8fd0d8, transparent: true, opacity: 0.78,
    roughness: 0.16, metalness: 0.15,
  })
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.3, 0.52, 32), stone)
  basin.position.y = 0.26
  basin.castShadow = true
  basin.receiveShadow = true
  group.add(basin)
  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(2.9, 32), water)
  waterDisc.rotation.x = -Math.PI / 2
  waterDisc.position.y = 0.53
  group.add(waterDisc)
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.2, 12), dark)
  pedestal.position.y = 1.12
  group.add(pedestal)
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.18, 24), stone)
  upper.position.y = 1.78
  group.add(upper)
  const upperWater = new THREE.Mesh(new THREE.CircleGeometry(1.22, 24), water)
  upperWater.rotation.x = -Math.PI / 2
  upperWater.position.y = 1.88
  group.add(upperWater)
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.09, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xa8e8ec, transparent: true, opacity: 0.5, roughness: 0.1 }),
  )
  jet.position.y = 2.42
  group.add(jet)

  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xc8f0f0, transparent: true, opacity: 0.32, depthWrite: false,
  })
  const ripples = []
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.02, 32), rippleMat.clone())
    r.rotation.x = -Math.PI / 2
    r.position.y = 0.545
    group.add(r)
    ripples.push(r)
  }
  addAnimator((dt, t) => {
    waterTex.offset.x = t * 0.012
    waterTex.offset.y = Math.sin(t * 0.3) * 0.03
    ripples.forEach((r, i) => {
      const phase = (t * 0.22 + i / 3) % 1
      r.scale.setScalar(0.6 + phase * 2.1)
      r.material.opacity = (1 - phase) * 0.3
    })
  })
}

function buildFlagPole(ctx, x, z, phase, angle, flagTex) {
  const { root, addAnimator } = ctx
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.5, metalness: 0.65 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 5.0, 6), poleMat)
  pole.position.set(x, 2.5, z)
  pole.castShadow = true
  root.add(pole)
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), poleMat)
  finial.position.set(x, 5.03, z)
  root.add(finial)

  const geo = new THREE.PlaneGeometry(2.0, 1.0, 12, 6)
  geo.translate(1.0, -0.5, 0)
  const mat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })
  const flag = new THREE.Mesh(geo, mat)
  flag.position.set(x, 4.95, z)
  flag.rotation.y = angle
  root.add(flag)
  const attr = geo.attributes.position
  addAnimator((dt, t) => {
    for (let i = 0; i < attr.count; i++) {
      const px = attr.getX(i)
      const py = attr.getY(i)
      const amp = 0.2 * (px / 2.0)
      attr.setZ(i,
        Math.sin(px * 3.1 - t * 4.0 + phase) * amp +
        Math.sin(py * 5.0 + t * 2.1 + phase) * 0.035)
    }
    attr.needsUpdate = true
  })
}

function buildSansad(ctx) {
  const { root } = ctx
  buildGround(ctx, { base: 0x8a6f4a, fleck: 0xa88a60, seed: 111, repeat: [34, 24], roughness: 0.98 })
  buildSky(ctx)
  buildSun(ctx)
  buildClouds(ctx, { tint: 0xffb890, count: 10, minY: 20, spreadY: 18, opacity: 0.26 })
  buildPlatform(ctx, 'sansad')
  buildRailing(ctx, 'sansad')
  buildSansadBuilding(ctx)
  buildFountain(ctx)
  buildTrees(ctx, [
    [-22, -26], [-19, -33], [-25, -40], [22, -27], [19, -35], [25, -43],
    [-30, -30], [30, -32], [-16, -45], [16, -45], [-8, -50], [8, -50],
    [-34, -22], [34, -24],
  ], 0x2b4226)
  const flagTex = makeFlagTexture()
  buildFlagPole(ctx, -8.8, -4.9, 0.0, 0.18, flagTex)
  buildFlagPole(ctx, 8.8, -4.9, 1.9, Math.PI - 0.18, flagTex)
  buildCrowd(ctx, 'sansad')
  buildParticles(ctx, {
    count: 260, color: 0xffd6a0, size: 0.10, opacity: 0.42,
    spreadX: 56, height: 13, rise: 0.16,
  })
}

// ---------------------------------------------------------------------------
// Jantar Mantar protest ground
// ---------------------------------------------------------------------------

function buildSkyline(ctx) {
  const { root, rng } = ctx
  const count = 26
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const w = 3 + rng() * 5
    const h = 2.5 + rng() * 9.5
    const d = 3 + rng() * 5
    const x = -66 + i * 5.3 + (rng() - 0.5) * 3
    const z = -68 - rng() * 24
    dummy.position.set(x, GROUND_Y + h / 2, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(w, h, d)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    col.setHex(0x6f7f88).offsetHSL(0, 0, (rng() - 0.5) * 0.18)
    mesh.setColorAt(i, col)
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  root.add(mesh)

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 14, 7, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7b8a90, roughness: 0.9 }),
  )
  dome.position.set(-19, GROUND_Y + 6.4, -72)
  dome.scale.y = 0.9
  root.add(dome)
  const minaret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.85, 8.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b8a90, roughness: 0.9 }),
  )
  minaret.position.set(-24, GROUND_Y + 4.25, -72)
  root.add(minaret)
}

function buildSamratYantra(ctx) {
  const { root, rng } = ctx
  const group = new THREE.Group()
  group.position.set(-17, GROUND_Y, -30)
  group.scale.setScalar(0.82)
  group.rotation.y = 0.12
  root.add(group)
  const tex = makeStoneTexture(0xa8483a, 0xc27a5a, 701, { joints: true, repeat: [2, 1] })
  const stone = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe6d2aa, roughness: 0.72 })

  const shape = new THREE.Shape()
  shape.moveTo(-5.5, 0)
  shape.lineTo(5.5, 0)
  shape.lineTo(5.5, 8.8)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false })
  geo.translate(0, 0, -1.6)
  const body = new THREE.Mesh(geo, stone)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const hypLen = Math.hypot(11, 8.8)
  const edge = new THREE.Mesh(new THREE.BoxGeometry(hypLen, 0.13, 0.13), cream)
  edge.position.set(0, 4.4, 1.62)
  edge.rotation.z = Math.atan2(8.8, 11)
  group.add(edge)

  const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.86, 0.2, 0.55), cream, 13)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 13; i++) {
    const t = (i + 0.5) / 13
    dummy.position.set(-5.5 + t * 11, t * 8.8 + 0.12, 1.64)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    steps.setMatrixAt(i, dummy.matrix)
  }
  group.add(steps)

  const topBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.55, 12), stone)
  topBase.position.set(4.1, 8.95, 0)
  topBase.castShadow = true
  group.add(topBase)
  const topDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 12, 6, 0, TAU, 0, Math.PI / 2),
    cream,
  )
  topDome.position.set(4.1, 9.22, 0)
  topDome.scale.y = 0.75
  topDome.castShadow = true
  group.add(topDome)

  // a few stone blocks at the base
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7 + rng() * 0.5, 0.5, 0.6), stone)
    b.position.set(-5.8 + rng() * 2, 0.25, -2.1 - rng() * 1.2)
    b.rotation.y = rng() * 0.6
    b.castShadow = true
    group.add(b)
  }
}

function buildVerticalDial(ctx) {
  const { root, addAnimator } = ctx
  const group = new THREE.Group()
  group.position.set(17.5, GROUND_Y, -29)
  group.scale.setScalar(0.82)
  root.add(group)
  const tex = makeStoneTexture(0xa8483a, 0xc27a5a, 712, { joints: true, repeat: [2, 1] })
  const stone = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe6d2aa, roughness: 0.7 })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.6, 24), stone)
  base.position.y = 0.3
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)
  const step = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.2, 0.25, 24), stone)
  step.position.y = 0.125
  step.receiveShadow = true
  group.add(step)
  const support = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.1, 0.45), stone)
  support.position.set(0, 2.0, -0.32)
  support.castShadow = true
  group.add(support)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.28, 8, 32), stone)
  ring.position.set(0, 3.4, 0.1)
  ring.castShadow = true
  group.add(ring)
  const inner = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.06, 6, 32), cream)
  inner.position.set(0, 3.4, 0.12)
  group.add(inner)

  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), cream, 24)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU
    dummy.position.set(Math.cos(a) * 2.7, 3.4 + Math.sin(a) * 2.7, 0.3)
    dummy.rotation.set(0, 0, a - Math.PI / 2)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    ticks.setMatrixAt(i, dummy.matrix)
  }
  group.add(ticks)

  const pointerGeo = new THREE.BoxGeometry(0.07, 2.2, 0.07)
  pointerGeo.translate(0, 1.1, 0)
  const pointer = new THREE.Mesh(pointerGeo, cream)
  pointer.position.set(0, 3.4, 0.38)
  group.add(pointer)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 12), cream)
  hub.rotation.x = Math.PI / 2
  hub.position.set(0, 3.4, 0.36)
  group.add(hub)
  addAnimator((dt, t) => {
    pointer.rotation.z = -t * 0.12
  })
}

function buildHorizontalDial(ctx) {
  const { root } = ctx
  const group = new THREE.Group()
  group.position.set(1.5, GROUND_Y, -23)
  group.scale.setScalar(0.85)
  root.add(group)
  const tex = makeStoneTexture(0xa8483a, 0xc27a5a, 722, { joints: true, repeat: [2, 1] })
  const stone = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe6d2aa, roughness: 0.7 })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.3, 2.0, 32), stone)
  base.position.y = 1.0
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.35, 0.18, 40), stone)
  top.position.y = 2.09
  top.castShadow = true
  group.add(top)
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.25, 3.55, 48), cream)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 2.2
  group.add(ring)
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 32), cream)
  innerRing.rotation.x = -Math.PI / 2
  innerRing.position.y = 2.2
  group.add(innerRing)

  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.02, 0.06), cream, 16)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    dummy.position.set(Math.cos(a) * 2.4, 2.21, Math.sin(a) * 2.4)
    dummy.rotation.set(0, -a, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    ticks.setMatrixAt(i, dummy.matrix)
  }
  group.add(ticks)

  const gnomon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 0.16), cream)
  gnomon.position.set(0, 2.9, 0)
  gnomon.rotation.z = 0.58
  group.add(gnomon)
}

function buildProtestBanners(ctx) {
  const { root, addAnimator } = ctx
  const data = [
    { x: -6, text: 'AANDOLAN ZINDABAD', bg: 0x9a2a20, fg: 0xffe6b0 },
    { x: 0, text: 'NAUKRI DO', bg: 0xf2e6c8, fg: 0x2a4a2a },
    { x: 6, text: 'JANTAR MANTAR CHALO', bg: 0x2f4a6a, fg: 0xffe08a },
  ]
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.9 })
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.4, 6), poleMat)
    pole.position.set(d.x, GROUND_Y + 2.7, -12.6)
    pole.castShadow = true
    root.add(pole)
    const cross = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.06, 0.06), poleMat)
    cross.position.set(d.x, GROUND_Y + 5.35, -12.6)
    root.add(cross)

    const tex = makeSignTexture(d.text, d.bg, d.fg, { w: 512, h: 128, accent: 0xf0c060 })
    const geo = new THREE.PlaneGeometry(3.8, 1.1, 10, 2)
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    const banner = new THREE.Mesh(geo, mat)
    banner.position.set(d.x, GROUND_Y + 4.72, -12.58)
    root.add(banner)
    const attr = geo.attributes.position
    const phase = i * 1.7
    addAnimator((dt, t) => {
      for (let k = 0; k < attr.count; k++) {
        const px = attr.getX(k)
        const py = attr.getY(k)
        attr.setZ(k,
          Math.sin(px * 2.0 - t * 2.6 + phase) * 0.08 +
          Math.sin(py * 3.0 + t * 1.7 + phase) * 0.025)
      }
      attr.needsUpdate = true
    })
  }
}

function buildProtestStage(ctx) {
  const { root } = ctx
  const group = new THREE.Group()
  group.position.set(-14, GROUND_Y, -15)
  root.add(group)
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4e3422, roughness: 0.92 })
  const red = new THREE.MeshStandardMaterial({ color: 0x9a2a20, roughness: 0.8 })
  const cloth = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.85 })

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.7, 2.8), wood)
  base.position.y = 0.35
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 0.85), cloth)
  front.position.set(0, 0.38, 1.42)
  group.add(front)
  const tex = makeSignTexture('DHARNA', 0x9a2a20, 0xffe6b0, { w: 256, h: 96, accent: 0xf0c060 })
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.55),
    new THREE.MeshBasicMaterial({ map: tex }),
  )
  sign.position.set(0, 0.46, 1.44)
  group.add(sign)

  const podium = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.7), darkWood)
  podium.position.set(0, 0.6, -0.5)
  podium.castShadow = true
  group.add(podium)
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), darkWood)
  mic.position.set(0, 1.55, -0.25)
  group.add(mic)
  const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), darkWood)
  micHead.position.set(0, 1.96, -0.25)
  group.add(micHead)

  for (const sx of [-1.8, 1.8]) {
    const speaker = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.42), darkWood)
    speaker.position.set(sx, 0.42, 0.55)
    speaker.castShadow = true
    group.add(speaker)
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), red)
    cone.position.set(sx, 0.48, 0.77)
    group.add(cone)
  }
  // tall protest backdrop, visible above the crowd
  const backdropTex = makeSignTexture('AANDOLAN', 0x9a2a20, 0xffe6b0, {
    w: 512, h: 256, sub: 'JANTAR MANTAR', accent: 0xf0c060,
  })
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.2),
    new THREE.MeshBasicMaterial({ map: backdropTex }),
  )
  backdrop.position.set(0, 1.7, -1.35)
  group.add(backdrop)
  for (const sx of [-2.3, 2.3]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.7, 6), darkWood)
    pole.position.set(sx, 1.85, -1.32)
    pole.castShadow = true
    group.add(pole)
  }

  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.55), wood)
    crate.position.set(2.7 + i * 0.15, 0.27, -0.8 + i * 0.6)
    crate.rotation.y = i * 0.4
    crate.castShadow = true
    group.add(crate)
  }
}

function buildJantar(ctx) {
  buildGround(ctx, { base: 0x5d8a6a, fleck: 0x7aa878, seed: 222, repeat: [30, 22], grass: true, roughness: 0.98 })
  buildSky(ctx)
  buildSun(ctx)
  buildClouds(ctx, { tint: 0xffffff, count: 11, minY: 30, spreadY: 22, opacity: 0.34 })
  buildPlatform(ctx, 'jantar')
  buildRailing(ctx, 'jantar')
  buildSkyline(ctx)
  buildSamratYantra(ctx)
  buildVerticalDial(ctx)
  buildHorizontalDial(ctx)
  buildProtestBanners(ctx)
  buildProtestStage(ctx)
  buildTrees(ctx, [
    [-27, -31], [-31, -39], [27, -33], [32, -41], [-19, -45],
    [19, -46], [-36, -29], [36, -29], [-8, -50], [9, -51],
  ], 0x315a2c)
  buildBushes(ctx, [
    [-17, -8.8], [17, -8.8], [-17, 5.5], [17, 5.5], [-12, -6.8],
    [12, -6.8], [-20, -14], [20, -14], [-11, 7.2], [11, 7.2],
  ], 0x3f6a35)
  buildCrowd(ctx, 'jantar')
  buildParticles(ctx, {
    count: 220, color: 0xfff0c0, size: 0.085, opacity: 0.38,
    spreadX: 52, height: 12, rise: 0.11,
  })
}

// ---------------------------------------------------------------------------
// Desi Sadak at golden hour
// ---------------------------------------------------------------------------

function buildRoadMarkings(ctx) {
  const { root } = ctx
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.84 })
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.55, 0.02, 0.12), white, 28)
  const dummy = new THREE.Object3D()
  let n = 0
  for (let i = 0; i < 14; i++) {
    for (const z of [-9.5, -14.6]) {
      dummy.position.set(-25 + i * 3.6, GROUND_Y + 0.015, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      dashes.setMatrixAt(n++, dummy.matrix)
    }
  }
  root.add(dashes)
  for (const z of [-8.6, -15.5]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(52, 0.02, 0.12), white)
    line.position.set(0, GROUND_Y + 0.015, z)
    root.add(line)
  }

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.9 })
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.35, 0.55), curbMat, 11)
  const bushes = []
  for (let i = 0; i < 11; i++) {
    const x = -22 + i * 4.3
    dummy.position.set(x, GROUND_Y + 0.175, -12.5)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    curbs.setMatrixAt(i, dummy.matrix)
    bushes.push([x, -12.5])
  }
  root.add(curbs)
  const bushGeo = new THREE.IcosahedronGeometry(0.36, 0)
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f6a35, roughness: 0.95, flatShading: true })
  const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length)
  bushes.forEach(([x, z], i) => {
    dummy.position.set(x, GROUND_Y + 0.52, z)
    dummy.rotation.set(0, i, 0)
    dummy.scale.set(0.8 + (i % 3) * 0.15, 0.6 + (i % 2) * 0.2, 0.8)
    dummy.updateMatrix()
    bushMesh.setMatrixAt(i, dummy.matrix)
  })
  root.add(bushMesh)

  const holeMat = new THREE.MeshStandardMaterial({ color: 0x25231f, roughness: 0.98 })
  for (const [x, z, r] of [[-11, -10.2, 0.55], [7.5, -13.5, 0.42], [18, -9.8, 0.36]]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), holeMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, GROUND_Y + 0.02, z)
    root.add(m)
  }
}

function buildShops(ctx) {
  const { root, rng } = ctx
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const unitPlane = new THREE.PlaneGeometry(1, 1)
  const bodyColors = [0xd8b890, 0x8fb0a8, 0xd89a90, 0xc8a060, 0xa8b890, 0x90a8c8, 0xb87860]
  const bodyMats = bodyColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3f3a32, roughness: 0.85 })
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x263842, roughness: 0.4, metalness: 0.2 })
  const warmMat = new THREE.MeshBasicMaterial({ color: 0xffc070 })
  const shutterTex = makeShutterTexture()
  const shutterMats = [0x8a9a9a, 0x9a8a78, 0x78888a].map((c) => new THREE.MeshStandardMaterial({
    map: shutterTex, color: c, roughness: 0.82,
  }))
  const stripeTextures = [
    makeStripeTexture(0xb83a2e, 0xf0e6d0),
    makeStripeTexture(0x2f6a4a, 0xf0e6d0),
    makeStripeTexture(0x2f4a7a, 0xf0e6d0),
  ]
  const awningMats = stripeTextures.map((t) => new THREE.MeshStandardMaterial({
    map: t, roughness: 0.8, side: THREE.DoubleSide,
  }))
  const shopData = [
    ['CHAI POINT', 'SPECIAL KADAK', 0x8a2a20, 0xffe6b0],
    ['SAMOSA CORNER', 'GARAM GARAM', 0x2f6a4a, 0xfff0c0],
    ['PAN BEEDI', 'SINCE 1974', 0x3a2a4a, 0xf0d8a0],
    ['MOBILE REPAIR', 'ALL BRANDS', 0x2f4a7a, 0xf0f0e0],
    ['KIRANA STORE', 'HOME DELIVERY', 0x7a5a2a, 0xfff0c0],
    ['SALON', 'HAIRCUT Rs.80', 0x7a2a4a, 0xffe0d0],
    ['DESI SADAK', 'SABSE AAGE', 0x2a2a2a, 0xffd060],
  ]
  const signMats = shopData.map(([text, sub, bg, fg]) => new THREE.MeshBasicMaterial({
    map: makeSignTexture(text, bg, fg, { w: 512, h: 128, sub, accent: 0xe8b040 }),
  }))
  const heights = [6.2, 7.4, 5.4, 8.0, 6.0, 7.0, 5.8]
  const frontZ = -15.75

  for (let i = 0; i < 7; i++) {
    const w = 5.2
    const h = heights[i]
    const x = -17.4 + i * 5.8
    const body = new THREE.Mesh(unitBox, bodyMats[i])
    body.position.set(x, GROUND_Y + h / 2, -17.8)
    body.scale.set(w, h, 4)
    body.castShadow = true
    body.receiveShadow = true
    root.add(body)

    if (i === 3) {
      const glow = new THREE.Mesh(unitPlane, warmMat)
      glow.position.set(x, GROUND_Y + 1.1, frontZ + 0.01)
      glow.scale.set(w * 0.78, 2.2, 1)
      root.add(glow)
      const frame = new THREE.Mesh(unitBox, darkMat)
      frame.position.set(x, GROUND_Y + 1.1, frontZ - 0.03)
      frame.scale.set(w * 0.84, 2.35, 0.12)
      root.add(frame)
    } else {
      const shutter = new THREE.Mesh(unitPlane, shutterMats[i % 3])
      shutter.position.set(x, GROUND_Y + 1.1, frontZ + 0.02)
      shutter.scale.set(w * 0.82, 2.2, 1)
      root.add(shutter)
    }

    const signFrame = new THREE.Mesh(unitBox, darkMat)
    signFrame.position.set(x, GROUND_Y + 2.95, frontZ - 0.02)
    signFrame.scale.set(w * 0.92, 0.98, 0.1)
    root.add(signFrame)
    const sign = new THREE.Mesh(unitPlane, signMats[i])
    sign.position.set(x, GROUND_Y + 2.95, frontZ + 0.045)
    sign.scale.set(w * 0.86, 0.8, 1)
    root.add(sign)

    const awning = new THREE.Mesh(unitBox, awningMats[i % 3])
    awning.position.set(x, GROUND_Y + 2.55, -14.85)
    awning.scale.set(w * 0.94, 0.06, 1.8)
    awning.rotation.x = 0.28
    awning.castShadow = true
    root.add(awning)

    const window = new THREE.Mesh(unitPlane, windowMat)
    window.position.set(x, GROUND_Y + 4.4, frontZ + 0.025)
    window.scale.set(w * 0.64, 1.15, 1)
    root.add(window)
    const windowFrame = new THREE.Mesh(unitBox, darkMat)
    windowFrame.position.set(x, GROUND_Y + 4.4, frontZ - 0.01)
    windowFrame.scale.set(w * 0.7, 1.3, 0.08)
    root.add(windowFrame)

    if (i % 2 === 0) {
      const balcony = new THREE.Mesh(unitBox, bodyMats[(i + 2) % bodyMats.length])
      balcony.position.set(x, GROUND_Y + 3.4, -15.3)
      balcony.scale.set(w, 0.16, 0.95)
      balcony.castShadow = true
      root.add(balcony)
      const parapet = new THREE.Mesh(unitBox, darkMat)
      parapet.position.set(x, GROUND_Y + 3.7, -14.85)
      parapet.scale.set(w, 0.45, 0.06)
      root.add(parapet)
    }

    if (i % 3 === 0) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8), darkMat)
      tank.position.set(x + 1.2, GROUND_Y + h + 0.55, -18.3)
      root.add(tank)
    } else if (i % 3 === 1) {
      const ac = new THREE.Mesh(unitBox, darkMat)
      ac.position.set(x - 1.2, GROUND_Y + h + 0.28, -16.6)
      ac.scale.set(0.9, 0.55, 0.6)
      root.add(ac)
    }
  }

  // clothesline
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.85 })
  const linePts = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    linePts.push(new THREE.Vector3(-2.5 + t * 5.5, GROUND_Y + 4.6 - Math.sin(t * Math.PI) * 0.45, -15.1))
  }
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), lineMat))
  const clothColors = [0xd8a040, 0x8a3a4a, 0x4a7a8a, 0xe8d8b8]
  for (let i = 0; i < 4; i++) {
    const cloth = new THREE.Mesh(unitPlane, new THREE.MeshStandardMaterial({
      color: clothColors[i], roughness: 0.9, side: THREE.DoubleSide,
    }))
    cloth.position.set(-1.6 + i * 1.25, GROUND_Y + 4.22 - Math.sin((i + 0.5) / 4 * Math.PI) * 0.22, -15.1)
    cloth.scale.set(0.55, 0.72, 1)
    cloth.rotation.z = (rng() - 0.5) * 0.15
    root.add(cloth)
  }
}

function buildChaiThela(ctx) {
  const { root } = ctx
  const group = new THREE.Group()
  group.position.set(-11.8, GROUND_Y, -8.9)
  group.rotation.y = 0.12
  root.add(group)
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 })
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a5a56, roughness: 0.55, metalness: 0.55 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.8 })
  const stripe = makeStripeTexture(0xb83a2e, 0xf0e6d0)
  const canopyMat = new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.85, side: THREE.DoubleSide })
  const unitBox = new THREE.BoxGeometry(1, 1, 1)

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12)
  for (const z of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(wheelGeo, metal)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(0, 0.34, z)
    wheel.castShadow = true
    group.add(wheel)
  }
  const body = new THREE.Mesh(unitBox, wood)
  body.position.set(0, 0.9, 0)
  body.scale.set(1.9, 0.7, 1.0)
  body.castShadow = true
  group.add(body)
  const counter = new THREE.Mesh(unitBox, cream)
  counter.position.set(0, 1.3, 0)
  counter.scale.set(2.0, 0.08, 1.1)
  group.add(counter)

  for (const sx of [-0.85, 0.85]) {
    for (const sz of [-0.42, 0.42]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 5), metal)
      pole.position.set(sx, 1.88, sz)
      group.add(pole)
    }
  }
  const canopy = new THREE.Mesh(unitBox, canopyMat)
  canopy.position.set(0, 2.47, 0)
  canopy.scale.set(2.2, 0.06, 1.3)
  canopy.rotation.z = 0.03
  canopy.castShadow = true
  group.add(canopy)

  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.32, 10), metal)
  kettle.position.set(0.38, 1.5, 0.12)
  group.add(kettle)
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.28, 6), metal)
  spout.position.set(0.55, 1.58, 0.12)
  spout.rotation.z = -0.7
  group.add(spout)
  const stove = new THREE.Mesh(unitBox, metal)
  stove.position.set(0.38, 1.36, 0.12)
  stove.scale.set(0.4, 0.14, 0.32)
  group.add(stove)
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 8), cream)
    cup.position.set(-0.25 + i * 0.16, 1.39, 0.2)
    group.add(cup)
  }

  const signTex = makeSignTexture('CHAI', 0x8a2a20, 0xffe6b0, { w: 256, h: 128, accent: 0xe8b040 })
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.45),
    new THREE.MeshBasicMaterial({ map: signTex }),
  )
  sign.position.set(0, 1.92, 0.62)
  group.add(sign)

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffb050, emissiveIntensity: 2.0 }),
  )
  bulb.position.set(0, 2.22, 0.4)
  group.add(bulb)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSoftDotTexture(), color: 0xffc070, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }))
  glow.position.copy(bulb.position)
  glow.scale.set(0.75, 0.75, 1)
  group.add(glow)

  for (const [x, z] of [[-1.45, 0.4], [1.35, -0.35]]) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.45, 8), wood)
    stool.position.set(x, 0.225, z)
    stool.castShadow = true
    group.add(stool)
  }
  buildSteam(ctx, group, new THREE.Vector3(0.38, 1.7, 0.12), 26)
}

function makeAutoRickshaw(bodyColor, roofColor) {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7, metalness: 0.1 })
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2a2e, roughness: 0.4, metalness: 0.2 })
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.95 })
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.14, 10)

  const lower = new THREE.Mesh(unitBox, bodyMat)
  lower.position.set(0, 0.55, 0)
  lower.scale.set(1.95, 0.5, 1.0)
  group.add(lower)
  const cabin = new THREE.Mesh(unitBox, bodyMat)
  cabin.position.set(-0.05, 1.05, 0)
  cabin.scale.set(1.5, 0.55, 1.0)
  group.add(cabin)
  const windows = new THREE.Mesh(unitBox, darkMat)
  windows.position.set(-0.05, 1.08, 0)
  windows.scale.set(1.52, 0.34, 0.95)
  group.add(windows)
  const roof = new THREE.Mesh(unitBox, roofMat)
  roof.position.set(-0.05, 1.38, 0)
  roof.scale.set(1.72, 0.12, 1.06)
  group.add(roof)
  const hood = new THREE.Mesh(unitBox, bodyMat)
  hood.position.set(0.9, 0.68, 0)
  hood.scale.set(0.5, 0.35, 0.98)
  group.add(hood)
  for (const [x, z] of [[-0.65, -0.55], [-0.65, 0.55], [0.92, 0]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.28, z)
    group.add(wheel)
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c0, emissive: 0xffc060, emissiveIntensity: 1.4,
  })
  for (const z of [-0.32, 0.32]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), headMat)
    light.position.set(1.16, 0.68, z)
    group.add(light)
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

function makeCar(color) {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2a2e, roughness: 0.35, metalness: 0.2 })
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.95 })
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 10)
  const body = new THREE.Mesh(unitBox, bodyMat)
  body.position.set(0, 0.55, 0)
  body.scale.set(3.2, 0.5, 1.35)
  group.add(body)
  const cabin = new THREE.Mesh(unitBox, bodyMat)
  cabin.position.set(-0.1, 0.98, 0)
  cabin.scale.set(1.7, 0.45, 1.2)
  group.add(cabin)
  const windows = new THREE.Mesh(unitBox, darkMat)
  windows.position.set(-0.1, 1.0, 0)
  windows.scale.set(1.72, 0.3, 1.15)
  group.add(windows)
  for (const [x, z] of [[-1.0, -0.6], [-1.0, 0.6], [1.0, -0.6], [1.0, 0.6]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.28, z)
    group.add(wheel)
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

function makeScooter(color) {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x9c6b48, roughness: 0.85 })
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const wheelGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.12, 10)
  for (const x of [-0.62, 0.62]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.27, 0)
    group.add(wheel)
  }
  const frame = new THREE.Mesh(unitBox, bodyMat)
  frame.position.set(0, 0.6, 0)
  frame.scale.set(1.05, 0.22, 0.25)
  group.add(frame)
  const seat = new THREE.Mesh(unitBox, darkMat)
  seat.position.set(-0.18, 0.82, 0)
  seat.scale.set(0.48, 0.12, 0.3)
  group.add(seat)
  const shield = new THREE.Mesh(unitBox, bodyMat)
  shield.position.set(0.52, 0.75, 0)
  shield.scale.set(0.22, 0.6, 0.32)
  group.add(shield)
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), darkMat)
  handle.rotation.x = Math.PI / 2
  handle.position.set(0.58, 1.03, 0)
  group.add(handle)
  const torso = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.9 }))
  torso.position.set(-0.15, 1.12, 0)
  torso.scale.set(0.35, 0.55, 0.28)
  group.add(torso)
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), skinMat)
  head.position.set(-0.15, 1.53, 0)
  group.add(head)
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

function buildTraffic(ctx) {
  const { root, addAnimator } = ctx
  const traffic = []
  const place = (group, x, z, rotY) => {
    group.position.set(x, GROUND_Y, z)
    group.rotation.y = rotY
    root.add(group)
    return group
  }

  place(makeAutoRickshaw(0x2f8a5a, 0xe8c040), 11.8, -9.0, 0.22)
  place(makeScooter(0x8a3a2a), 9.0, -8.95, -0.45)
  place(makeCar(0xd8d8d0), -6.2, -15.1, Math.PI)
  place(makeCar(0x8a3a3a), 7.4, -15.1, 0)

  const moving = [
    { g: makeAutoRickshaw(0x2a7a8a, 0xf0d060), z: -10.9, speed: 4.2, dir: 1, x: -18 },
    { g: makeAutoRickshaw(0x2f8a5a, 0xe8c040), z: -13.6, speed: 3.5, dir: -1, x: 12 },
    { g: makeCar(0xd8d0b8), z: -13.6, speed: 5.0, dir: -1, x: 24 },
    { g: makeScooter(0x3a6a9a), z: -9.9, speed: 2.8, dir: 1, x: -4 },
  ]
  for (const v of moving) {
    v.g.position.set(v.x, GROUND_Y, v.z)
    v.g.rotation.y = v.dir < 0 ? Math.PI : 0
    root.add(v.g)
    traffic.push(v)
  }
  addAnimator((dt, t) => {
    for (const v of traffic) {
      v.g.position.x += v.speed * v.dir * dt
      if (v.g.position.x > 31) v.g.position.x = -31
      else if (v.g.position.x < -31) v.g.position.x = 31
      v.g.position.y = GROUND_Y + Math.sin(t * 7.5 + v.z) * 0.012
    }
  })
}

function makeWirePoints(a, b, sag, segments = 18) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    pts.push(new THREE.Vector3(
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t) - sag * 4 * t * (1 - t),
      lerp(a[2], b[2], t),
    ))
  }
  return pts
}

function buildWiresAndLights(ctx) {
  const { root, addAnimator } = ctx
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.75, metalness: 0.3 })
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 8.4, 6)
  const armGeo = new THREE.BoxGeometry(0.9, 0.08, 0.08)
  const polePositions = [
    [-22, -14.9], [-10, -14.9], [2, -14.9], [14, -14.9], [24, -14.9],
    [-16, -8.7], [-4, -8.7], [8, -8.7], [20, -8.7],
  ]
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, polePositions.length)
  const arms = new THREE.InstancedMesh(armGeo, poleMat, polePositions.length)
  const dummy = new THREE.Object3D()
  polePositions.forEach(([x, z], i) => {
    dummy.position.set(x, GROUND_Y + 4.2, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    poles.setMatrixAt(i, dummy.matrix)
    dummy.position.set(x, GROUND_Y + 7.9, z)
    dummy.updateMatrix()
    arms.setMatrixAt(i, dummy.matrix)
  })
  poles.castShadow = true
  root.add(poles, arms)

  const transformer = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.42), poleMat)
  transformer.position.set(2, GROUND_Y + 5.4, -14.75)
  root.add(transformer)

  const wireMat = new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.88 })
  const addWire = (a, b, sag) => {
    const geo = new THREE.BufferGeometry().setFromPoints(makeWirePoints(a, b, sag))
    root.add(new THREE.Line(geo, wireMat))
  }
  const shopRow = [[-22, -14.9], [-10, -14.9], [2, -14.9], [14, -14.9], [24, -14.9]]
  for (let i = 0; i < shopRow.length - 1; i++) {
    addWire([shopRow[i][0], GROUND_Y + 7.5, shopRow[i][1]], [shopRow[i + 1][0], GROUND_Y + 7.5, shopRow[i + 1][1]], 0.55)
    addWire([shopRow[i][0], GROUND_Y + 7.0, shopRow[i][1]], [shopRow[i + 1][0], GROUND_Y + 7.0, shopRow[i + 1][1]], 0.75)
  }
  const frontRow = [[-16, -8.7], [-4, -8.7], [8, -8.7], [20, -8.7]]
  for (let i = 0; i < frontRow.length - 1; i++) {
    addWire([frontRow[i][0], GROUND_Y + 7.2, frontRow[i][1]], [frontRow[i + 1][0], GROUND_Y + 7.2, frontRow[i + 1][1]], 0.65)
  }
  addWire([-10, GROUND_Y + 7.3, -14.9], [-4, GROUND_Y + 7.0, -8.7], 0.4)
  addWire([2, GROUND_Y + 7.3, -14.9], [8, GROUND_Y + 7.0, -8.7], 0.5)
  addWire([14, GROUND_Y + 7.3, -14.9], [20, GROUND_Y + 7.0, -8.7], 0.4)
  addWire([-22, GROUND_Y + 6.9, -14.9], [-16, GROUND_Y + 6.7, -8.7], 0.35)

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c0, emissive: 0xffb050, emissiveIntensity: 2.0, roughness: 0.35,
  })
  const bulbGeo = new THREE.SphereGeometry(0.075, 6, 4)
  const glowTex = makeSoftDotTexture()
  const glowMat = new THREE.PointsMaterial({
    color: 0xffc070, size: 0.38, map: glowTex, transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false,
  })
  const glowPositions = []
  const addString = (a, b, sag, count) => {
    const pts = makeWirePoints(a, b, sag, 32)
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat))
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, count)
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count
      const x = lerp(a[0], b[0], t)
      const y = lerp(a[1], b[1], t) - sag * 4 * t * (1 - t) - 0.08
      const z = lerp(a[2], b[2], t)
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      bulbs.setMatrixAt(i, dummy.matrix)
      glowPositions.push(x, y, z)
    }
    bulbs.frustumCulled = false
    root.add(bulbs)
  }
  addString([-16, GROUND_Y + 7.0, -8.7], [20, GROUND_Y + 7.0, -8.7], 1.1, 18)
  addString([-22, GROUND_Y + 7.3, -14.9], [24, GROUND_Y + 7.3, -14.9], 1.3, 22)

  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(glowPositions), 3))
  const glows = new THREE.Points(glowGeo, glowMat)
  glows.frustumCulled = false
  root.add(glows)
  ctx.particleSystems.push(glows)
  addAnimator((dt, t) => {
    bulbMat.emissiveIntensity = 1.65 + Math.sin(t * 3.4) * 0.28 + Math.sin(t * 7.1) * 0.14
    glowMat.opacity = 0.58 + Math.sin(t * 3.4) * 0.12
  })
}

function buildHoardings(ctx) {
  const { root } = ctx
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.7, metalness: 0.4 })
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.75 })
  const data = [
    {
      x: -11.0, z: -13.9, rot: 0.08, w: 5.2, h: 2.6,
      title: 'DESI SADAK', sub: 'CHAI - TRAFFIC - TAMASHA', bg: 0x8a2a20, fg: 0xffe6b0,
    },
    {
      x: 10.4, z: -14.1, rot: -0.07, w: 5.0, h: 2.6,
      title: 'SANSAD SHOWDOWN', sub: 'ABKI BAAR, KNOCKOUT PAAR', bg: 0x1e2a4a, fg: 0xffd060,
    },
  ]
  for (const d of data) {
    const group = new THREE.Group()
    group.position.set(d.x, 0, d.z)
    group.rotation.y = d.rot
    root.add(group)
    const tex = makeSignTexture(d.title, d.bg, d.fg, {
      w: 512, h: 256, sub: d.sub, accent: 0xe8b040, border: 0xf0e0b0,
    })
    const signMat = new THREE.MeshBasicMaterial({ map: tex })
    const frame = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.35, d.h + 0.35, 0.18), frameMat)
    frame.position.set(0, 4.35, 0)
    frame.castShadow = true
    group.add(frame)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), signMat)
    sign.position.set(0, 4.35, 0.11)
    group.add(sign)
    for (const sx of [-d.w * 0.36, d.w * 0.36]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.1, 6), poleMat)
      pole.position.set(sx, GROUND_Y + 2.05, 0)
      pole.castShadow = true
      group.add(pole)
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.9, 0.12, 0.12), poleMat)
    cross.position.set(0, GROUND_Y + 2.7, 0)
    group.add(cross)
  }
}

function buildRoad(ctx) {
  buildGround(ctx, {
    base: 0x555049, fleck: 0x6d685f, seed: 333, repeat: [36, 26], cracks: true, roughness: 0.97,
  })
  buildSky(ctx)
  buildSun(ctx)
  buildClouds(ctx, { tint: 0xffd8b0, count: 9, minY: 22, spreadY: 16, opacity: 0.28 })
  buildRoadMarkings(ctx)
  buildPlatform(ctx, 'road')
  buildRailing(ctx, 'road')
  buildShops(ctx)
  buildChaiThela(ctx)
  buildHoardings(ctx)
  buildWiresAndLights(ctx)
  buildTraffic(ctx)
  buildTrees(ctx, [[-28, -22], [29, -23], [-32, -31]], 0x355a2c)
  buildCrowd(ctx, 'road')
  buildParticles(ctx, {
    count: 260, color: 0xffe0a8, size: 0.095, opacity: 0.44,
    spreadX: 56, height: 13, rise: 0.14,
  })
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

function disposeObject(root) {
  root.traverse((o) => {
    if (o.isSprite) {
      // Sprite geometry is shared internally by three.js; never dispose it.
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if (m.map) m.map.dispose()
          m.dispose()
        }
      }
      return
    }
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (m.map) m.map.dispose()
        m.dispose()
      }
    }
    if (o.isInstancedMesh && o.dispose) o.dispose()
  })
}

function initialAspect(renderer) {
  let w = 0
  let h = 0
  if (renderer && renderer.getSize) {
    const size = new THREE.Vector2()
    renderer.getSize(size)
    w = size.x
    h = size.y
  }
  if (!w || !h) {
    w = typeof window !== 'undefined' ? window.innerWidth : 16
    h = typeof window !== 'undefined' ? window.innerHeight : 9
  }
  return w / Math.max(1, h)
}

export function createArena(scene, renderer, stageId = 'sansad') {
  if (!scene) throw new Error('createArena requires a THREE.Scene')
  const group = new THREE.Group()
  group.name = 'arena'
  scene.add(group)

  const stageRoot = new THREE.Group()
  stageRoot.name = 'stage-root'
  group.add(stageRoot)

  const camera = new THREE.PerspectiveCamera(42, initialAspect(renderer), 0.1, 300)
  camera.position.set(0, 2.6, 9.5)
  camera.lookAt(0, 1.25, 0)
  camera.updateProjectionMatrix()

  let stage = 'sansad'
  let quality = 'high'
  let disposed = false
  let elapsed = 0
  let animators = []
  let particleSystems = []
  let fog = null
  const priorFog = scene.fog || null

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2)
  group.add(hemi)

  const sun = new THREE.DirectionalLight(0xffffff, 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.00045
  sun.shadow.normalBias = 0.025
  const shadowCam = sun.shadow.camera
  shadowCam.left = -21
  shadowCam.right = 21
  shadowCam.top = 21
  shadowCam.bottom = -21
  shadowCam.near = 1
  shadowCam.far = 80
  shadowCam.updateProjectionMatrix()
  group.add(sun)
  group.add(sun.target)

  const rim = new THREE.DirectionalLight(0xffffff, 0.4)
  group.add(rim)
  group.add(rim.target)

  function addAnimator(fn) {
    animators.push(fn)
  }

  function applyEnvironment(pal) {
    fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar)
    scene.fog = fog

    hemi.color.setHex(pal.hemiSky)
    hemi.groundColor.setHex(pal.hemiGround)
    hemi.intensity = pal.hemiIntensity

    sun.color.setHex(pal.sunColor)
    sun.intensity = pal.sunIntensity
    sun.position.set(pal.sunPos[0], pal.sunPos[1], pal.sunPos[2])
    sun.target.position.set(0, 0.2, 0)
    sun.target.updateMatrixWorld()

    rim.color.setHex(pal.hemiSky)
    rim.intensity = stage === 'sansad' ? 0.55 : 0.32
    rim.position.set(-pal.sunPos[0] * 0.8, Math.max(5, pal.sunPos[1] * 0.55), -12)
    rim.target.position.set(0, 1.2, 0)
    rim.target.updateMatrixWorld()

    if (renderer) {
      if (renderer.toneMapping === THREE.NoToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping
      }
      renderer.toneMappingExposure = pal.exposure
      if (renderer.shadowMap) renderer.shadowMap.enabled = true
    }
  }

  function clearStage() {
    animators = []
    particleSystems = []
    disposeObject(stageRoot)
    stageRoot.clear()
  }

  function setStage(id) {
    if (disposed) return
    const info = STAGES[id] || STAGES.sansad
    stage = info.id
    const pal = STAGE_PALETTES[stage] || STAGE_PALETTES.sansad
    group.name = `arena-${stage}`
    clearStage()
    applyEnvironment(pal)
    const rng = stageSeed(stage === 'sansad' ? 917 : stage === 'jantar' ? 731 : 559)
    const ctx = {
      root: stageRoot,
      pal,
      rng,
      stage,
      quality,
      addAnimator,
      particleSystems,
      groundY: GROUND_Y,
      platformTop: 0,
    }
    if (stage === 'jantar') buildJantar(ctx)
    else if (stage === 'road') buildRoad(ctx)
    else buildSansad(ctx)
    for (const p of particleSystems) p.visible = quality !== 'low'
  }

  function update(dt, time) {
    if (disposed) return
    const d = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 1 / 60
    elapsed += d
    const t = Number.isFinite(time) ? time : elapsed
    for (let i = 0; i < animators.length; i++) animators[i](d, t)
  }

  function setQuality(q) {
    quality = q === 'low' ? 'low' : 'high'
    for (const p of particleSystems) p.visible = quality !== 'low'
  }

  function dispose() {
    if (disposed) return
    disposed = true
    clearStage()
    group.remove(stageRoot)
    group.remove(hemi)
    group.remove(sun)
    group.remove(sun.target)
    group.remove(rim)
    group.remove(rim.target)
    scene.remove(group)
    if (scene.fog === fog) scene.fog = priorFog
    if (hemi.dispose) hemi.dispose()
    if (sun.dispose) sun.dispose()
    if (rim.dispose) rim.dispose()
  }

  setStage(stageId)

  return {
    group,
    camera,
    setStage,
    update,
    setQuality,
    dispose,
  }
}
