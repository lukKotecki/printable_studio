import * as THREE from 'three'

export function computeGeometryVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position')
  if (!position || position.count < 3) {
    return 0
  }

  const index = geometry.getIndex()
  let volume = 0

  const addTriangleVolume = (aIndex: number, bIndex: number, cIndex: number): void => {
    const ax = position.getX(aIndex)
    const ay = position.getY(aIndex)
    const az = position.getZ(aIndex)
    const bx = position.getX(bIndex)
    const by = position.getY(bIndex)
    const bz = position.getZ(bIndex)
    const cx = position.getX(cIndex)
    const cy = position.getY(cIndex)
    const cz = position.getZ(cIndex)

    volume += (ax * by * cz - ax * bz * cy - ay * bx * cz + ay * bz * cx + az * bx * cy - az * by * cx) / 6
  }

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      addTriangleVolume(index.getX(i), index.getX(i + 1), index.getX(i + 2))
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      addTriangleVolume(i, i + 1, i + 2)
    }
  }

  return Math.abs(volume)
}

export function isFiniteGeometry(geometry: THREE.BufferGeometry): boolean {
  const position = geometry.getAttribute('position')
  if (!position || position.count < 3) {
    return false
  }

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return false
    }
  }

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) {
    return false
  }

  const size = new THREE.Vector3()
  box.getSize(size)
  return Number.isFinite(size.x) && Number.isFinite(size.y) && Number.isFinite(size.z)
}

export function isDiceSubtractResultStable(
  previousMesh: THREE.Mesh,
  candidateMesh: THREE.Mesh,
  diceSize: number,
): boolean {
  if (!isFiniteGeometry(candidateMesh.geometry)) {
    return false
  }

  candidateMesh.geometry.computeBoundingBox()
  const box = candidateMesh.geometry.boundingBox
  if (!box) {
    return false
  }

  const boxSize = new THREE.Vector3()
  box.getSize(boxSize)
  const minExpectedSpan = diceSize * 0.55
  if (boxSize.x < minExpectedSpan || boxSize.y < minExpectedSpan || boxSize.z < minExpectedSpan) {
    return false
  }

  const previousVolume = computeGeometryVolume(previousMesh.geometry)
  if (previousVolume <= 0.0001) {
    return false
  }

  const candidateVolume = computeGeometryVolume(candidateMesh.geometry)
  const volumeRatio = candidateVolume / previousVolume
  return Number.isFinite(volumeRatio) && volumeRatio > 0.65 && volumeRatio < 1.001
}
