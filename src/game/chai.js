import * as THREE from 'three'

/** A little chai cup on the stage edge. It survives until a body lands on it. */
export function createChaiCup(scene, x = 8.1, z = 3.1) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  scene.add(group)

  const clay = new THREE.MeshStandardMaterial({ color: 0xd8a06a, roughness: 0.8 })
  const tea = new THREE.MeshStandardMaterial({ color: 0x8a4a20, roughness: 0.4 })
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.025, 16), clay)
  saucer.position.y = 0.012
  saucer.castShadow = true
  group.add(saucer)
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.15, 16), clay)
  cup.position.y = 0.1
  cup.castShadow = true
  group.add(cup)
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.105, 16), tea)
  surface.rotation.x = -Math.PI / 2
  surface.position.y = 0.178
  group.add(surface)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 12, Math.PI), clay)
  handle.position.set(0.13, 0.11, 0)
  handle.rotation.z = -Math.PI / 2
  group.add(handle)

  const shards = new THREE.Group()
  shards.visible = false
  group.add(shards)
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), clay)
    shard.position.set((Math.random() - 0.5) * 0.35, 0.02, (Math.random() - 0.5) * 0.35)
    shard.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2)
    shards.add(shard)
  }

  let broken = false
  function shatter() {
    if (broken) return false
    broken = true
    saucer.visible = false
    cup.visible = false
    surface.visible = false
    handle.visible = false
    shards.visible = true
    return true
  }
  function reset() {
    broken = false
    saucer.visible = true
    cup.visible = true
    surface.visible = true
    handle.visible = true
    shards.visible = false
  }
  function dispose() {
    scene.remove(group)
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }

  return { group, x, z, shatter, reset, dispose, get broken() { return broken } }
}
