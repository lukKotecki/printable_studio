import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import createManifold from 'manifold-3d'
import { subtractSolidMeshes } from '../src/models/manifold-boolean.ts'
import { assertClosedStl, volume } from './mesh-test-utils.mjs'

const engine = await createManifold()
engine.setup()
const font = new FontLoader().parse(JSON.parse(await readFile('public/fonts/droid/droid_serif_regular.typeface.json', 'utf8')))
const material = new THREE.MeshBasicMaterial()
const faces = [
  [[0, 0, 1], [0, 0, 0]], [[0, 0, -1], [0, Math.PI, 0]],
  [[1, 0, 0], [0, Math.PI / 2, 0]], [[-1, 0, 0], [0, -Math.PI / 2, 0]],
  [[0, 1, 0], [-Math.PI / 2, 0, 0]], [[0, -1, 0], [Math.PI / 2, 0, Math.PI]],
]

function cutter(index, depth = 1) {
  const geometry = new TextGeometry('O8B', { font, size: 5, depth: depth + 0.2, curveSegments: 18, bevelEnabled: false })
  geometry.computeBoundingBox()
  const center = geometry.boundingBox.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, 0)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.set(...faces[index][1])
  mesh.position.fromArray(faces[index][0]).multiplyScalar(10 - depth)
  return mesh
}

for (const radius of [0, 2, 3.6]) {
  const base = new THREE.Mesh(new RoundedBoxGeometry(20, 20, 20, 4, radius), material)
  const cutters = faces.map((_, i) => cutter(i))
  const originalVolume = volume(base.geometry)
  for (const [i, face] of cutters.entries()) {
    const result = subtractSolidMeshes(engine, base, [face])
    assert.ok(originalVolume - volume(result.geometry) > 5, `face ${i + 1} missing engraving`)
    const deeperCutter = cutter(i, 2)
    const deeperResult = subtractSolidMeshes(engine, base, [deeperCutter])
    assert.ok(
      Math.abs((originalVolume - volume(deeperResult.geometry)) / (originalVolume - volume(result.geometry)) - 2) < 0.02,
      `face ${i + 1} has incorrect engraving depth`,
    )
    assertClosedStl(result)
    deeperCutter.geometry.dispose()
    deeperResult.geometry.dispose()
    result.geometry.dispose()
  }
  const result = subtractSolidMeshes(engine, base, cutters)
  assert.ok(originalVolume - volume(result.geometry) > 30, 'six-sided engraving missing')
  assertClosedStl(result)
  assert.ok(volume(result.geometry) > 0)
  for (const mesh of [base, result, ...cutters]) mesh.geometry.dispose()
  console.log(`radius ${radius}: all six engraved faces form a closed STL`)
}

{
  const base = new THREE.Mesh(new RoundedBoxGeometry(20, 20, 20, 4, 2), material)
  const cutters = [cutter(0), cutter(1), cutter(4), cutter(5)]
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 22, 48), material)
  hole.rotation.z = Math.PI / 2
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(13, 64, 32), material)
  const clipped = subtractSolidMeshes(engine, base, [], [], [hole], [sphere])
  const result = subtractSolidMeshes(engine, base, cutters, [], [hole], [sphere])
  assert.ok(volume(clipped.geometry) < volume(base.geometry) - 100, 'hole or sphere clipping missing')
  assert.ok(volume(result.geometry) < volume(clipped.geometry) - 20, 'engraving missing from clipped dice')
  assertClosedStl(clipped)
  assertClosedStl(result)
  for (const mesh of [base, hole, sphere, clipped, result, ...cutters]) mesh.geometry.dispose()
  console.log('engraving with side hole and sphere clipping forms a closed STL')
}

{
  const base = new THREE.Mesh(new RoundedBoxGeometry(20, 20, 20, 4, 2), material)
  const shape = new THREE.Shape()
  shape.absarc(0, 0, 4, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 2, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const logos = faces.map(([normal, rotation]) => {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 28 }), material)
    mesh.rotation.set(...rotation)
    mesh.position.fromArray(normal).multiplyScalar(9)
    return mesh
  })
  const result = subtractSolidMeshes(engine, base, logos)
  assert.ok(volume(base.geometry) - volume(result.geometry) > 100, 'circular logos missing')
  assertClosedStl(result)
  for (const mesh of [base, result, ...logos]) mesh.geometry.dispose()
  console.log('circular logo engraving with counters on six faces is closed')
}
