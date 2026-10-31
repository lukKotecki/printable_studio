import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import createManifold from 'manifold-3d'
import { subtractSolidMeshes } from '../src/models/manifold-boolean.ts'
import { createBaseMesh } from '../src/models/tag-puzzle.ts'
import { defaultConfig } from '../src/config/app-config.ts'

const engine = await createManifold()
engine.setup()
const font = new FontLoader().parse(JSON.parse(await readFile('public/fonts/helvetiker_regular.typeface.json', 'utf8')))
const material = new THREE.MeshBasicMaterial()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const shapeFromPoints = (points) => new THREE.Shape(points)

function textCutter(text, depth, thickness, back = false, typeface = font) {
  const geometry = new TextGeometry(text, { font: typeface, size: 9, depth: depth + 0.2, curveSegments: 18, bevelEnabled: false })
  geometry.computeBoundingBox()
  const center = geometry.boundingBox.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, 0)
  const mesh = new THREE.Mesh(geometry, material)
  if (back) {
    mesh.rotation.y = Math.PI
    mesh.position.z = depth
  } else {
    mesh.position.z = thickness - depth
  }
  return mesh
}

function volume(geometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const count = index ? index.count : position.count
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let total = 0
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i)
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1)
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2)
    total += a.dot(b.cross(c)) / 6
  }
  return total
}

function assertClosedStl(mesh) {
  const data = new STLExporter().parse(mesh, { binary: true })
  const geometry = new STLLoader().parse(data.buffer)
  const position = geometry.getAttribute('position')
  const edges = new Map()
  const key = (i) => [position.getX(i), position.getY(i), position.getZ(i)].map((n) => Object.is(n, -0) ? 0 : n).join(',')
  for (let i = 0; i < position.count; i += 3) {
    const points = [key(i), key(i + 1), key(i + 2)]
    assert.equal(new Set(points).size, 3, 'degenerate triangle in STL')
    for (let j = 0; j < 3; j += 1) {
      const a = points[j], b = points[(j + 1) % 3]
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`
      const entry = edges.get(edge) ?? [0, 0]
      entry[0] += 1
      entry[1] += a < b ? 1 : -1
      edges.set(edge, entry)
    }
  }
  for (const [edge, [count, direction]] of edges) {
    assert.equal(count, 2, `open or non-manifold edge ${edge}`)
    assert.equal(direction, 0, `incorrect winding at ${edge}`)
  }
  geometry.dispose()
}

for (const shape of ['rounded', 'circle', 'capsule']) {
  const config = { ...defaultConfig, shape, width: 62, height: 28, thickness: 3 }
  const base = createBaseMesh(config, material, { clamp, shapeFromPoints })
  const baseVolume = volume(base.geometry)
  const front = textCutter('O8B', 0.8, config.thickness)
  const back = textCutter('O8B', 0.6, config.thickness, true)
  const frontOnly = subtractSolidMeshes(engine, base, [front])
  const backOnly = subtractSolidMeshes(engine, base, [back])
  const both = subtractSolidMeshes(engine, base, [front, back])
  const frontVolume = volume(frontOnly.geometry)
  const bothVolume = volume(both.geometry)
  assert.ok(baseVolume - frontVolume > 5, `${shape}: front engraving missing`)
  assert.ok(baseVolume - volume(backOnly.geometry) > 5, `${shape}: back engraving missing`)
  assert.ok(frontVolume - bothVolume > 5, `${shape}: back engraving missing`)
  assert.ok(Math.abs((baseVolume - frontVolume) / (frontVolume - bothVolume) - 0.8 / 0.6) < 0.01, `${shape}: incorrect depth`)
  assertClosedStl(frontOnly)
  assertClosedStl(backOnly)
  assertClosedStl(both)
  for (const mesh of [base, front, back, frontOnly, backOnly, both]) mesh.geometry.dispose()
  console.log(`${shape}: front and double-sided O8B are closed, oriented and cut to depth`)
}

{
  const config = { ...defaultConfig, shape: 'circle', width: 62, height: 28, thickness: 3 }
  const base = createBaseMesh(config, material, { clamp, shapeFromPoints })
  const through = textCutter('O', 3, 3)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1, 15, 3), material)
  bridge.position.z = 1.5
  const back = textCutter('B', 0.6, 3, true)
  const frontResult = subtractSolidMeshes(engine, base, [through], [bridge])
  const result = subtractSolidMeshes(engine, frontResult, [back])
  assert.ok(volume(result.geometry) < volume(base.geometry) - 5, 'through-cut missing')
  assertClosedStl(result)
  for (const mesh of [base, through, bridge, back, frontResult, result]) mesh.geometry.dispose()
  console.log('through-cut with bridge and back engraving is closed')
}

for (const path of [
  'public/fonts/pl/noto_sans_regular.typeface.json',
  'public/fonts/pl/noto_serif_regular.typeface.json',
  'public/fonts/optimer_regular.typeface.json',
  'public/fonts/gentilis_regular.typeface.json',
  'public/fonts/droid/droid_sans_regular.typeface.json',
  'public/fonts/droid/droid_serif_regular.typeface.json',
]) {
  const typeface = new FontLoader().parse(JSON.parse(await readFile(path, 'utf8')))
  const base = createBaseMesh(defaultConfig, material, { clamp, shapeFromPoints })
  const front = textCutter('O8B', 0.8, 3, false, typeface)
  const back = textCutter('O8B', 0.6, 3, true, typeface)
  const result = subtractSolidMeshes(engine, base, [front, back])
  assert.ok(volume(base.geometry) - volume(result.geometry) > 5, `${path}: engraving missing`)
  assertClosedStl(result)
  for (const mesh of [base, front, back, result]) mesh.geometry.dispose()
  console.log(`${path}: double-sided engraving is closed`)
}

{
  const base = createBaseMesh(defaultConfig, material, { clamp, shapeFromPoints })
  const ring = new THREE.Shape()
  ring.absarc(0, 0, 5, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 2, 0, Math.PI * 2, true)
  ring.holes.push(hole)
  const front = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 1.2, bevelEnabled: false, curveSegments: 28 }), material)
  front.position.z = 2
  const back = front.clone()
  back.geometry = front.geometry.clone()
  back.rotation.y = Math.PI
  back.position.z = 1
  const result = subtractSolidMeshes(engine, base, [front, back])
  assert.ok(volume(base.geometry) - volume(result.geometry) > 5, 'ring engraving missing')
  assertClosedStl(result)
  for (const mesh of [base, front, back, result]) mesh.geometry.dispose()
  console.log('double-sided circular logo with counter is closed')
}
