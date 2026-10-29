import * as THREE from 'three'

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })

function box(parent, w, h, d, color, pos, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  m.position.set(...pos)
  m.rotation.set(...rot)
  m.castShadow = true
  parent.add(m)
  return m
}

/** A cartoon stray cow that walks across the stage during a lull in the fight. */
export function createCow(scene, z = 1.7) {
  const group = new THREE.Group()
  group.position.set(-13.5, 0, z)
  group.rotation.y = 0
  scene.add(group)

  const white = 0xf2ede0
  const black = 0x2a2622
  const pink = 0xd88a8a

  const body = box(group, 1.5, 0.78, 0.78, white, [0, 0.92, 0])
  box(group, 0.55, 0.5, 0.8, black, [-0.35, 0.95, 0.02])
  box(group, 0.3, 0.26, 0.78, black, [0.42, 0.78, 0.02])
  const neck = box(group, 0.42, 0.55, 0.46, white, [0.86, 1.05, 0], [0, 0, -0.25])
  const head = box(group, 0.52, 0.46, 0.46, white, [1.12, 1.3, 0], [0, 0, -0.1])
  box(group, 0.28, 0.24, 0.4, pink, [1.38, 1.2, 0])
  for (const s of [-1, 1]) {
    box(group, 0.14, 0.14, 0.1, black, [1.12, 1.46, s * 0.24])
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), mat(0xd8c8a0))
    horn.position.set(1.02, 1.58, s * 0.2)
    horn.rotation.z = s * 0.25
    group.add(horn)
    box(group, 0.12, 0.42, 0.12, white, [0.55, 0.32, s * 0.24])
    box(group, 0.12, 0.42, 0.12, white, [-0.5, 0.32, s * 0.24])
  }
  const udder = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(pink))
  udder.position.set(-0.15, 0.55, 0)
  udder.scale.set(1.4, 0.8, 1)
  group.add(udder)
  const tail = box(group, 0.08, 0.7, 0.08, white, [-0.8, 0.9, 0], [0, 0, 0.5])
  const tuft = box(group, 0.12, 0.22, 0.12, black, [-0.95, 0.55, 0])

  const legs = []
  for (const x of [-0.55, 0.55]) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Group()
      leg.position.set(x, 0.55, s * 0.24)
      group.add(leg)
      box(leg, 0.12, 0.55, 0.12, white, [0, -0.25, 0])
      legs.push(leg)
    }
  }

  let walked = 0
  let t = 0
  const total = 27

  function update(dt) {
    t += dt
    const speed = 5.0
    group.position.x += speed * dt
    walked += speed * dt
    const swing = Math.sin(walked * 3.4) * 0.45
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = i % 2 ? swing : -swing
    head.rotation.y = Math.sin(t * 2.2) * 0.12
    tail.rotation.z = 0.5 + Math.sin(t * 4) * 0.2
    group.position.y = Math.abs(Math.sin(walked * 3.4)) * 0.015
    return walked >= total
  }

  function dispose() {
    scene.remove(group)
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }

  return { group, update, dispose }
}
