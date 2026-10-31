import assert from 'node:assert/strict'
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export function volume(geometry) {
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

export function assertClosedStl(mesh) {
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
