import * as THREE from 'three'
import type { TagConfig } from '../config/app-config'

type ClampFn = (value: number, min: number, max: number) => number

type ShapeFromPointsFn = (points: THREE.Vector2[]) => THREE.Shape

interface BaseShapeDeps {
  clamp: ClampFn
  shapeFromPoints: ShapeFromPointsFn
}

export function roundedRectShape(width: number, height: number, radius: number, clamp: ClampFn): THREE.Shape {
  const hw = width / 2
  const hh = height / 2
  const r = clamp(radius, 0, Math.min(hw, hh))
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(hw - r, -hh)
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r)
  shape.lineTo(hw, hh - r)
  shape.quadraticCurveTo(hw, hh, hw - r, hh)
  shape.lineTo(-hw + r, hh)
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
  shape.lineTo(-hw, -hh + r)
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return shape
}

export function createPuzzlePieceShape(
  width: number,
  height: number,
  shapeFromPoints: ShapeFromPointsFn,
): THREE.Shape {
  const size = Math.min(width, height)
  const halfSize = size / 2
  const toothSize = 5
  const toothDepth = 5
  const segmentCount = Math.max(1, Math.floor(size / toothSize))
  const coveredSpan = segmentCount * toothSize
  const edgeMargin = (size - coveredSpan) / 2
  const points: THREE.Vector2[] = []
  const isToothSegment = (index: number): boolean => index % 2 === 1

  const pushPoint = (x: number, y: number): void => {
    const lastPoint = points.at(-1)
    if (!lastPoint || Math.abs(lastPoint.x - x) > 0.0001 || Math.abs(lastPoint.y - y) > 0.0001) {
      points.push(new THREE.Vector2(x, y))
    }
  }

  pushPoint(-halfSize, -halfSize)
  pushPoint(-halfSize + edgeMargin, -halfSize)

  for (let i = 0; i < segmentCount; i += 1) {
    const x1 = -halfSize + edgeMargin + i * toothSize
    const x2 = x1 + toothSize
    const y = -halfSize + (isToothSegment(i) ? -toothDepth : 0)
    pushPoint(x1, y)
    pushPoint(x2, y)
    pushPoint(x2, -halfSize)
  }
  pushPoint(halfSize, -halfSize)
  pushPoint(halfSize, -halfSize + edgeMargin)

  for (let i = 0; i < segmentCount; i += 1) {
    const y1 = -halfSize + edgeMargin + i * toothSize
    const y2 = y1 + toothSize
    const x = halfSize + (isToothSegment(i) ? toothDepth : 0)
    pushPoint(x, y1)
    pushPoint(x, y2)
    pushPoint(halfSize, y2)
  }
  pushPoint(halfSize, halfSize)
  pushPoint(halfSize - edgeMargin, halfSize)

  for (let i = 0; i < segmentCount; i += 1) {
    const x1 = halfSize - edgeMargin - i * toothSize
    const x2 = x1 - toothSize
    const y = halfSize + (isToothSegment(i) ? -toothDepth : 0)
    pushPoint(x1, y)
    pushPoint(x2, y)
    pushPoint(x2, halfSize)
  }
  pushPoint(-halfSize, halfSize)
  pushPoint(-halfSize, halfSize - edgeMargin)

  for (let i = 0; i < segmentCount; i += 1) {
    const y1 = halfSize - edgeMargin - i * toothSize
    const y2 = y1 - toothSize
    const x = -halfSize + (isToothSegment(i) ? toothDepth : 0)
    pushPoint(x, y1)
    pushPoint(x, y2)
    pushPoint(-halfSize, y2)
  }
  pushPoint(-halfSize, -halfSize)

  return shapeFromPoints(points)
}

export function createBaseShape(config: TagConfig, deps: BaseShapeDeps): THREE.Shape {
  const halfWidth = config.width / 2
  const halfHeight = config.height / 2

  let shape: THREE.Shape
  if (config.shape === 'circle') {
    shape = new THREE.Shape()
    shape.absarc(0, 0, halfWidth, 0, Math.PI * 2, false)
  } else if (config.shape === 'puzzle') {
    shape = createPuzzlePieceShape(config.width, config.height, deps.shapeFromPoints)
  } else {
    const radius = config.shape === 'capsule' ? config.height / 2 : config.cornerRadius
    shape = roundedRectShape(config.width, config.height, radius, deps.clamp)
  }

  if (config.shape === 'puzzle') {
    return shape
  }

  const holeRadius = config.holeDiameter / 2
  const edgePadding = 0.7
  const requestedHoleX = -halfWidth + holeRadius + config.holeMargin + config.holeOffsetX
  const requestedHoleY = config.holeOffsetY
  let holeX = requestedHoleX
  let holeY = requestedHoleY

  if (config.shape === 'circle') {
    const maxDistance = Math.max(0, halfWidth - holeRadius - edgePadding)
    const currentDistance = Math.hypot(requestedHoleX, requestedHoleY)
    if (currentDistance > maxDistance && currentDistance > 0.0001) {
      const factor = maxDistance / currentDistance
      holeX = requestedHoleX * factor
      holeY = requestedHoleY * factor
    }
  } else {
    const minHoleX = -halfWidth + holeRadius + edgePadding
    const maxHoleX = halfWidth - holeRadius - edgePadding
    const minHoleY = -halfHeight + holeRadius + edgePadding
    const maxHoleY = halfHeight - holeRadius - edgePadding
    holeX = deps.clamp(requestedHoleX, minHoleX, maxHoleX)
    holeY = deps.clamp(requestedHoleY, minHoleY, maxHoleY)
  }

  const holePath = new THREE.Path()
  holePath.absarc(holeX, holeY, holeRadius, 0, Math.PI * 2, true)
  shape.holes.push(holePath)

  return shape
}

export function createBaseMesh(
  config: TagConfig,
  baseMaterial: THREE.Material,
  deps: BaseShapeDeps,
): THREE.Mesh {
  const shape = createBaseShape(config, deps)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.thickness,
    bevelEnabled: false,
    curveSegments: 40,
  })

  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, baseMaterial)
}
