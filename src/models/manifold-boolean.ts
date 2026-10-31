import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Manifold, ManifoldToplevel, Mat4, Vec2 } from 'manifold-3d'

function extrudedCutterToSolid(engine: ManifoldToplevel, mesh: THREE.Mesh): Manifold {
  // Rebuild the cross-section from side walls: font cap triangulations can
  // contain non-manifold triangles even when their contours are valid.
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!position) throw new Error('Cutter has no positions')

  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < position.count; i += 1) {
    minZ = Math.min(minZ, position.getZ(i))
    maxZ = Math.max(maxZ, position.getZ(i))
  }
  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || maxZ <= minZ) {
    throw new Error('Cutter has invalid extrusion depth')
  }

  const edges = new Map<string, { point: Vec2, next: string }>()
  const count = index ? index.count : position.count
  const vertex = (i: number) => {
    const n = index ? index.getX(i) : i
    return { x: position.getX(n), y: position.getY(n), z: position.getZ(n) }
  }
  const key = (x: number, y: number) => `${x},${y}`
  for (let i = 0; i < count; i += 3) {
    const points = [vertex(i), vertex(i + 1), vertex(i + 2)]
    for (let j = 0; j < 3; j += 1) {
      const a = points[j], b = points[(j + 1) % 3], c = points[(j + 2) % 3]
      if (a.z !== minZ || b.z !== minZ || c.z !== maxZ || (a.x === b.x && a.y === b.y)) continue
      const start = key(a.x, a.y)
      if (edges.has(start)) throw new Error('Cutter has ambiguous contour')
      edges.set(start, { point: [a.x, a.y], next: key(b.x, b.y) })
    }
  }

  const contours: Vec2[][] = []
  while (edges.size > 0) {
    const start = edges.keys().next().value
    if (start === undefined) break
    const contour: Vec2[] = []
    let current = start
    do {
      const edge = edges.get(current)
      if (!edge) throw new Error('Cutter has an open contour')
      contour.push(edge.point)
      edges.delete(current)
      current = edge.next
    } while (current !== start)
    if (contour.length < 3) throw new Error('Cutter has a degenerate contour')
    contours.push(contour)
  }
  if (contours.length === 0) throw new Error('Cutter has no extrusion contours')

  const section = new engine.CrossSection(contours)
  try {
    if (section.isEmpty()) throw new Error('Cutter contours form an empty cross-section')
    const solid = section.extrude(maxZ - minZ)
    try {
      mesh.updateMatrix()
      const matrix = mesh.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, minZ))
      const e = matrix.elements
      const transform: Mat4 = [
        e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7],
        e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15],
      ]
      return solid.transform(transform)
    } finally {
      solid.delete()
    }
  } finally {
    section.delete()
  }
}

function toSolid(engine: ManifoldToplevel, mesh: THREE.Mesh): Manifold {
  const geometry = mesh.geometry.clone()
  mesh.updateMatrix()
  geometry.applyMatrix4(mesh.matrix)
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  geometry.deleteAttribute('color')
  const welded = mergeVertices(geometry, 1e-6)
  geometry.dispose()

  try {
    const position = welded.getAttribute('position')
    const index = welded.getIndex()
    if (!position || !index) {
      throw new Error('Geometry has no indexed positions')
    }
    const vertices = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i += 1) {
      vertices[i * 3] = position.getX(i)
      vertices[i * 3 + 1] = position.getY(i)
      vertices[i * 3 + 2] = position.getZ(i)
    }
    const triangles = new Uint32Array(index.count)
    for (let i = 0; i < index.count; i += 1) {
      triangles[i] = index.getX(i)
    }
    return new engine.Manifold(new engine.Mesh({ numProp: 3, vertProperties: vertices, triVerts: triangles }))
  } finally {
    welded.dispose()
  }
}

export function subtractSolidMeshes(
  engine: ManifoldToplevel,
  base: THREE.Mesh,
  cutters: THREE.Mesh[],
  additions: THREE.Mesh[] = [],
): THREE.Mesh {
  let solid = toSolid(engine, base)
  try {
    for (const [meshes, subtract] of [[cutters, true], [additions, false]] as const) {
      for (const mesh of meshes) {
        const operand = subtract ? extrudedCutterToSolid(engine, mesh) : toSolid(engine, mesh)
        try {
          const next = subtract ? solid.subtract(operand) : solid.add(operand)
          solid.delete()
          solid = next
        } finally {
          operand.delete()
        }
      }
    }
    const status = solid.status()
    if (status !== 'NoError') {
      throw new Error(`Boolean operation failed: ${status}`)
    }
    const result = solid.getMesh()
    if (result.numTri === 0) {
      throw new Error('Boolean operation produced an empty model')
    }
    const positions = new Float32Array(result.numVert * 3)
    for (let i = 0; i < result.numVert; i += 1) {
      positions.set(result.vertProperties.subarray(i * result.numProp, i * result.numProp + 3), i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(result.triVerts, 1))
    geometry.computeVertexNormals()
    return new THREE.Mesh(geometry, base.material)
  } finally {
    solid.delete()
  }
}
