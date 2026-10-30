import * as THREE from 'three'

function radialTexture(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const MAX_BURSTS = 14
const MAX_PARTICLES = 48
const MAX_RINGS = 8
const MAX_STREAKS = 6

/**
 * Pooled combat FX: no geometry/material is allocated during a fight, so impact
 * effects never trigger garbage collection mid-combo.
 *
 *   burst(pos, color, count, power)   impact sparks
 *   ring(pos, color)                  expanding shock ring (ground aligned)
 *   streak(a, b, color, life)         short motion slash between two points
 *   update(dt) / dispose()
 */
export function createFX(scene) {
  const texGold = radialTexture('rgba(255,220,120,0.95)')
  const texRed = radialTexture('rgba(255,90,60,0.95)')
  const texBlue = radialTexture('rgba(120,190,255,0.95)')
  const texWhite = radialTexture('rgba(255,255,255,0.98)')
  const TEX = { gold: texGold, red: texRed, blue: texBlue, white: texWhite, crit: texWhite }

  // ---- bursts -------------------------------------------------------------
  const bursts = []
  for (let i = 0; i < MAX_BURSTS; i++) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    geo.setDrawRange(0, 0)
    const mat = new THREE.PointsMaterial({
      size: 0.2, map: texGold, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, opacity: 1,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    pts.visible = false
    scene.add(pts)
    bursts.push({
      pts, geo, mat,
      vel: new Float32Array(MAX_PARTICLES * 3),
      n: 0, life: 0, ttl: 0.6, active: false,
    })
  }
  let burstCursor = 0

  // ---- rings --------------------------------------------------------------
  const ringGeo = new THREE.RingGeometry(0.15, 0.28, 28)
  const rings = []
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    const mesh = new THREE.Mesh(ringGeo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    scene.add(mesh)
    rings.push({ mesh, mat, life: 0, ttl: 0.45, active: false, scale0: 1 })
  }
  let ringCursor = 0

  // ---- streaks (impact slashes / limb trails) ------------------------------
  const streaks = []
  const streakMat = () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  for (let i = 0; i < MAX_STREAKS; i++) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    geo.setDrawRange(0, 0)
    const mat = streakMat()
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    line.visible = false
    scene.add(line)
    streaks.push({ line, geo, mat, life: 0, ttl: 0.18, active: false })
  }
  let streakCursor = 0

  const tmpColor = new THREE.Color()
  const PALETTE = {
    gold: new THREE.Color(1, 0.82, 0.35),
    red: new THREE.Color(1, 0.4, 0.3),
    blue: new THREE.Color(0.5, 0.78, 1),
    white: new THREE.Color(1, 1, 1),
    crit: new THREE.Color(1, 1, 1),
  }

  function burst(pos, color = 'gold', count = 14, power = 3) {
    const b = bursts[burstCursor]
    burstCursor = (burstCursor + 1) % MAX_BURSTS
    const n = Math.min(MAX_PARTICLES, Math.max(3, count | 0))
    const arr = b.geo.attributes.position.array
    const col = b.geo.attributes.color.array
    const base = PALETTE[color] || PALETTE.gold
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x
      arr[i * 3 + 1] = pos.y
      arr[i * 3 + 2] = pos.z
      const jitter = 0.72 + Math.random() * 0.55
      col[i * 3] = base.r * jitter
      col[i * 3 + 1] = base.g * jitter
      col[i * 3 + 2] = base.b * jitter
      const a = Math.random() * Math.PI * 2
      const el = Math.random() * Math.PI - Math.PI / 2
      const s = (0.55 + Math.random() * 0.9) * power
      b.vel[i * 3] = Math.cos(a) * Math.cos(el) * s
      b.vel[i * 3 + 1] = Math.sin(el) * s + 1.4
      b.vel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * s * 0.45
    }
    b.n = n
    b.life = 0
    b.ttl = 0.5 + Math.random() * 0.18
    b.active = true
    b.mat.map = TEX[color] || texGold
    b.mat.size = 0.16 + Math.min(0.16, power * 0.035)
    b.mat.opacity = 1
    b.geo.attributes.position.needsUpdate = true
    b.geo.attributes.color.needsUpdate = true
    b.geo.setDrawRange(0, n)
    b.pts.visible = true
  }

  function ring(pos, color = 0xffc040, radius = 1) {
    const r = rings[ringCursor]
    ringCursor = (ringCursor + 1) % MAX_RINGS
    r.mesh.position.set(pos.x, pos.y, pos.z)
    r.mat.color.setHex(color)
    r.mat.opacity = 0.85
    r.scale0 = radius
    r.life = 0
    r.ttl = 0.4
    r.active = true
    r.mesh.visible = true
    r.mesh.scale.setScalar(radius)
  }

  /** Short bright slash between two world points — reads as limb motion. */
  function streak(a, b, color = 0xffe8b0, life = 0.16) {
    const s = streaks[streakCursor]
    streakCursor = (streakCursor + 1) % MAX_STREAKS
    const arr = s.geo.attributes.position.array
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z
    arr[3] = b.x; arr[4] = b.y; arr[5] = b.z
    s.geo.attributes.position.needsUpdate = true
    s.geo.setDrawRange(0, 2)
    s.mat.color.setHex(color)
    s.mat.opacity = 0.9
    s.life = 0
    s.ttl = life
    s.active = true
    s.line.visible = true
  }

  function update(dt) {
    for (const b of bursts) {
      if (!b.active) continue
      b.life += dt
      const arr = b.geo.attributes.position.array
      for (let i = 0; i < b.n; i++) {
        const o = i * 3
        b.vel[o + 1] -= 7.5 * dt
        arr[o] += b.vel[o] * dt
        arr[o + 1] += b.vel[o + 1] * dt
        arr[o + 2] += b.vel[o + 2] * dt
      }
      b.geo.attributes.position.needsUpdate = true
      b.mat.opacity = Math.max(0, 1 - b.life / b.ttl)
      if (b.life >= b.ttl) { b.active = false; b.pts.visible = false; b.geo.setDrawRange(0, 0) }
    }
    for (const r of rings) {
      if (!r.active) continue
      r.life += dt
      const k = r.life / r.ttl
      r.mesh.scale.setScalar(r.scale0 * (1 + k * 7))
      r.mat.opacity = 0.85 * (1 - k)
      if (r.life >= r.ttl) { r.active = false; r.mesh.visible = false }
    }
    for (const s of streaks) {
      if (!s.active) continue
      s.life += dt
      s.mat.opacity = Math.max(0, 0.9 * (1 - s.life / s.ttl))
      if (s.life >= s.ttl) { s.active = false; s.line.visible = false; s.geo.setDrawRange(0, 0) }
    }
  }

  function dispose() {
    for (const b of bursts) { scene.remove(b.pts); b.geo.dispose(); b.mat.dispose() }
    for (const r of rings) { scene.remove(r.mesh); r.mat.dispose() }
    ringGeo.dispose()
    for (const s of streaks) { scene.remove(s.line); s.geo.dispose(); s.mat.dispose() }
    texGold.dispose(); texRed.dispose(); texBlue.dispose(); texWhite.dispose()
    bursts.length = 0; rings.length = 0; streaks.length = 0
  }

  return { burst, ring, streak, update, dispose }
}
