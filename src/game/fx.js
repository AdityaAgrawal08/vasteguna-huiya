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

export function createFX(scene) {
  const bursts = []
  const rings = []
  const texWhite = radialTexture('rgba(255,220,120,0.95)')
  const texRed = radialTexture('rgba(255,90,60,0.95)')
  const texBlue = radialTexture('rgba(120,190,255,0.95)')

  function burst(pos, color = 'gold', count = 14, power = 3) {
    const tex = color === 'red' ? texRed : color === 'blue' ? texBlue : texWhite
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const vels = []
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      const a = Math.random() * Math.PI * 2
      const b = Math.random() * Math.PI - Math.PI / 2
      const s = (0.6 + Math.random()) * power
      vels.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 1.2, Math.sin(a) * Math.cos(b) * s * 0.4))
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.22, map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffffff, opacity: 1,
    })
    const pts = new THREE.Points(geo, mat)
    scene.add(pts)
    bursts.push({ pts, vels, life: 0, ttl: 0.6 + Math.random() * 0.2 })
  }

  function ring(pos, color = 0xffc040) {
    const geo = new THREE.RingGeometry(0.15, 0.25, 28)
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.rotation.x = -Math.PI / 2
    scene.add(mesh)
    rings.push({ mesh, life: 0, ttl: 0.45 })
  }

  function update(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      b.life += dt
      const arr = b.pts.geometry.attributes.position.array
      for (let j = 0; j < b.vels.length; j++) {
        const v = b.vels[j]
        arr[j * 3] += v.x * dt
        arr[j * 3 + 1] += v.y * dt
        arr[j * 3 + 2] += v.z * dt
        v.y -= 7 * dt
      }
      b.pts.geometry.attributes.position.needsUpdate = true
      b.pts.material.opacity = Math.max(0, 1 - b.life / b.ttl)
      if (b.life >= b.ttl) {
        scene.remove(b.pts)
        b.pts.geometry.dispose()
        b.pts.material.dispose()
        bursts.splice(i, 1)
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.life += dt
      const k = r.life / r.ttl
      r.mesh.scale.setScalar(1 + k * 8)
      r.mesh.material.opacity = 0.9 * (1 - k)
      if (r.life >= r.ttl) {
        scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        r.mesh.material.dispose()
        rings.splice(i, 1)
      }
    }
  }

  function dispose() {
    for (const b of bursts) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose() }
    for (const r of rings) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose() }
    bursts.length = rings.length = 0
    texWhite.dispose(); texRed.dispose(); texBlue.dispose()
  }

  return { burst, ring, update, dispose }
}
