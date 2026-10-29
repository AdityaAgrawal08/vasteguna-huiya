import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createSuperSequence } from '../src/game/supers.js'
import { CHARACTERS } from '../src/game/data.js'

const audio = { play() {} }
const fx = { burst() {}, ring() {} }

function fakeRig(x) {
  const root = new THREE.Group()
  root.position.x = x
  return { root, update() {}, setFacing() {}, head: root, dispose() {} }
}

for (const id of Object.keys(CHARACTERS)) {
  const scene = new THREE.Scene()
  const rigs = [fakeRig(-3), fakeRig(3)]
  const seq = createSuperSequence({
    scene, camera: new THREE.PerspectiveCamera(), rigs, side: 0, charId: id,
    audio, fx, fighters: [{}, {}],
  })
  let n = 0
  while (!seq.step(1 / 60) && n < 400) n++
  assert.ok(n < 400, `${id} super should finish`)
  assert.ok(seq.camera.position.isVector3, `${id} camera exists`)
  seq.dispose()
  assert.equal(scene.children.length, 0, `${id} super should clean up its scene graph`)
}
console.log('super sequences passed for all six characters')
