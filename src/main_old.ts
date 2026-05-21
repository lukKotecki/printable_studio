import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { geometries, modifiers } from '@jscad/modeling'
import { serialize as serializeStl } from '@jscad/stl-serializer'

type TagShape = 'rounded' | 'capsule' | 'circle'
type TextMode = 'emboss' | 'deboss'

interface TagConfig {
  text: string
  shape: TagShape
  width: number
  height: number
  thickness: number
  cornerRadius: number
  holeDiameter: number
  holeMargin: number
  fontSize: number
  textDepth: number
  textMode: TextMode
}

const defaultConfig: TagConfig = {
  text: 'LUNA',
  shape: 'rounded',
  width: 62,
  height: 28,
  thickness: 3,
  cornerRadius: 5,
  holeDiameter: 5,
  holeMargin: 6,
  fontSize: 9,
  textDepth: 1,
  textMode: 'emboss',
}

const presetsStorageKey = 'printable-studio-presets-v1'

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing element: ${selector}`)
  }
  return element
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Missing app root')
}

app.innerHTML = `
  <main class="layout">
    <aside class="panel">
      <h1>Printable Studio</h1>
      <p class="subtitle">Lokalny generator tagow 3D z eksportem STL.</p>

      <div class="field">
        <label for="text">Napis</label>
        <input id="text" type="text" maxlength="18" value="${defaultConfig.text}" />
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="shape">Ksztalt</label>
          <select id="shape">
            <option value="rounded">Zaokraglony prostokat</option>
            <option value="capsule">Kapsula</option>
            <option value="circle">Kolo</option>
          </select>
        </div>
        <div class="field">
          <label for="textMode">Tryb tekstu</label>
          <select id="textMode">
            <option value="emboss">Wypukly</option>
            <option value="deboss">Wklesly</option>
          </select>
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="width">Szerokosc (mm)</label>
          <input id="width" type="number" min="20" max="120" step="1" value="${defaultConfig.width}" />
        </div>
        <div class="field">
          <label for="height">Wysokosc (mm)</label>
          <input id="height" type="number" min="15" max="60" step="1" value="${defaultConfig.height}" />
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="thickness">Grubosc (mm)</label>
          <input id="thickness" type="number" min="1.5" max="8" step="0.1" value="${defaultConfig.thickness}" />
        </div>
        <div class="field">
          <label for="cornerRadius">Promien rogu (mm)</label>
          <input id="cornerRadius" type="number" min="0" max="20" step="0.5" value="${defaultConfig.cornerRadius}" />
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="holeDiameter">Srednica otworu (mm)</label>
          <input id="holeDiameter" type="number" min="2" max="12" step="0.5" value="${defaultConfig.holeDiameter}" />
        </div>
        <div class="field">
          <label for="holeMargin">Margines otworu (mm)</label>
          <input id="holeMargin" type="number" min="2" max="20" step="0.5" value="${defaultConfig.holeMargin}" />
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="fontSize">Rozmiar tekstu (mm)</label>
          <input id="fontSize" type="number" min="4" max="22" step="0.5" value="${defaultConfig.fontSize}" />
        </div>
        <div class="field">
          <label for="textDepth">Glebokosc tekstu (mm)</label>
          <input id="textDepth" type="number" min="0.4" max="3" step="0.1" value="${defaultConfig.textDepth}" />
        </div>
      </div>

      <div class="actions">
        <button id="resetBtn" type="button">Reset</button>
        <button id="exportBtn" type="button" class="primary">Eksport STL</button>
      </div>

      <div class="preset-card">
        <h2>Presety lokalne</h2>
        <div class="field">
          <label for="presetName">Nazwa presetu</label>
          <input id="presetName" type="text" maxlength="30" placeholder="np. Tag dla psa" />
        </div>
        <div class="grid-2">
          <button id="savePresetBtn" type="button">Zapisz preset</button>
          <button id="deletePresetBtn" type="button">Usun preset</button>
        </div>
        <div class="field">
          <label for="presetSelect">Wczytaj preset</label>
          <select id="presetSelect"></select>
        </div>
      </div>
    </aside>

    <section class="viewer-wrap">
      <canvas id="viewer" aria-label="Podglad 3D"></canvas>
      <div class="legend">
        <span>Lewy przycisk: obrot</span>
        <span>Scroll: zoom</span>
        <span>Prawy przycisk: przesuniecie</span>
      </div>
    </section>
  </main>
`

const canvas = requiredElement<HTMLCanvasElement>('#viewer')

const controlsMap = {
  text: requiredElement<HTMLInputElement>('#text'),
  shape: requiredElement<HTMLSelectElement>('#shape'),
  width: requiredElement<HTMLInputElement>('#width'),
  height: requiredElement<HTMLInputElement>('#height'),
  thickness: requiredElement<HTMLInputElement>('#thickness'),
  cornerRadius: requiredElement<HTMLInputElement>('#cornerRadius'),
  holeDiameter: requiredElement<HTMLInputElement>('#holeDiameter'),
  holeMargin: requiredElement<HTMLInputElement>('#holeMargin'),
  fontSize: requiredElement<HTMLInputElement>('#fontSize'),
  textDepth: requiredElement<HTMLInputElement>('#textDepth'),
  textMode: requiredElement<HTMLSelectElement>('#textMode'),
  exportBtn: requiredElement<HTMLButtonElement>('#exportBtn'),
  resetBtn: requiredElement<HTMLButtonElement>('#resetBtn'),
  presetName: requiredElement<HTMLInputElement>('#presetName'),
  savePresetBtn: requiredElement<HTMLButtonElement>('#savePresetBtn'),
  deletePresetBtn: requiredElement<HTMLButtonElement>('#deletePresetBtn'),
  presetSelect: requiredElement<HTMLSelectElement>('#presetSelect'),
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color('#f7efe1')

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000)
camera.position.set(0, -70, 60)
camera.lookAt(0, 0, 0)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

const hemi = new THREE.HemisphereLight('#fff7e8', '#5e5d5b', 1)
scene.add(hemi)

const keyLight = new THREE.DirectionalLight('#ffffff', 1.1)
keyLight.position.set(30, -40, 45)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight('#ffd9a1', 0.7)
fillLight.position.set(-20, 35, 20)
scene.add(fillLight)

const baseMaterial = new THREE.MeshStandardMaterial({
  color: '#d88539',
  metalness: 0.15,
  roughness: 0.5,
})

const shadowPlate = new THREE.Mesh(
  new THREE.CircleGeometry(140, 80),
  new THREE.MeshBasicMaterial({ color: '#f0dcc2' }),
)
shadowPlate.position.set(0, 0, -0.6)
scene.add(shadowPlate)

let activeTagObject: THREE.Object3D | null = null
let loadedFont: unknown | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function disposeObjectDeep(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
    }
  })
}

function getConfigFromForm(): TagConfig {
  const rawShape = controlsMap.shape.value as TagShape
  const shape: TagShape = rawShape === 'capsule' || rawShape === 'circle' ? rawShape : 'rounded'
  const rawMode = controlsMap.textMode.value as TextMode
  const textMode: TextMode = rawMode === 'deboss' ? 'deboss' : 'emboss'

  const width = clamp(Number(controlsMap.width.value), 20, 120)
  const height = clamp(Number(controlsMap.height.value), 15, 60)
  const thickness = clamp(Number(controlsMap.thickness.value), 1.5, 8)
  const textDepth = clamp(Number(controlsMap.textDepth.value), 0.4, Math.max(0.4, thickness - 0.2))
  const maxCorner = Math.min(width, height) * 0.49

  return {
    text: controlsMap.text.value.trim().slice(0, 18) || 'TAG',
    shape,
    width,
    height,
    thickness,
    cornerRadius: clamp(Number(controlsMap.cornerRadius.value), 0, maxCorner),
    holeDiameter: clamp(Number(controlsMap.holeDiameter.value), 2, 12),
    holeMargin: clamp(Number(controlsMap.holeMargin.value), 2, 20),
    fontSize: clamp(Number(controlsMap.fontSize.value), 4, 22),
    textDepth,
    textMode,
  }
}

function applyConfigToForm(config: TagConfig): void {
  controlsMap.text.value = config.text
  controlsMap.shape.value = config.shape
  controlsMap.width.value = String(config.width)
  controlsMap.height.value = String(config.height)
  controlsMap.thickness.value = String(config.thickness)
  controlsMap.cornerRadius.value = String(config.cornerRadius)
  controlsMap.holeDiameter.value = String(config.holeDiameter)
  controlsMap.holeMargin.value = String(config.holeMargin)
  controlsMap.fontSize.value = String(config.fontSize)
  controlsMap.textDepth.value = String(config.textDepth)
  controlsMap.textMode.value = config.textMode
}

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
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

function createBaseShape(config: TagConfig): THREE.Shape {
  const halfWidth = config.width / 2
  const holeRadius = config.holeDiameter / 2

  let shape: THREE.Shape
  if (config.shape === 'circle') {
    shape = new THREE.Shape()
    shape.absarc(0, 0, halfWidth, 0, Math.PI * 2, false)
  } else {
    const radius = config.shape === 'capsule' ? config.height / 2 : config.cornerRadius
    shape = roundedRectShape(config.width, config.height, radius)
  }

  const minHoleX = -halfWidth + holeRadius + 0.7
  const maxHoleX = halfWidth - holeRadius - 0.7
  const requestedHoleX = -halfWidth + holeRadius + config.holeMargin
  const holeX = clamp(requestedHoleX, minHoleX, maxHoleX)

  const holePath = new THREE.Path()
  holePath.absarc(holeX, 0, holeRadius, 0, Math.PI * 2, true)
  shape.holes.push(holePath)

  return shape
}

function createBaseMesh(config: TagConfig): THREE.Mesh {
  const shape = createBaseShape(config)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.thickness,
    bevelEnabled: false,
    curveSegments: 64,
  })

  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, baseMaterial)
}

function pathFromPoints(points: THREE.Vector2[]): THREE.Path {
  const path = new THREE.Path()
  if (points.length === 0) {
    return path
  }
  path.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y)
  }
  path.closePath()
  return path
}

function shapeFromPoints(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape()
  if (points.length === 0) {
    return shape
  }
  shape.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i].x, points[i].y)
  }
  shape.closePath()
  return shape
}

function centeredGlyphShapes(config: TagConfig): THREE.Shape[] {
  if (!loadedFont) {
    return []
  }

  const font = loadedFont as {
    generateShapes: (text: string, size: number) => THREE.Shape[]
  }
  const glyphShapes = font.generateShapes(config.text, config.fontSize)
  if (glyphShapes.length === 0) {
    return []
  }

  const bounds = new THREE.Box2(
    new THREE.Vector2(Infinity, Infinity),
    new THREE.Vector2(-Infinity, -Infinity),
  )

  glyphShapes.forEach((shape) => {
    shape.getPoints(24).forEach((p) => bounds.expandByPoint(p))
  })

  const center = new THREE.Vector2((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2)
  const centeredShapes: THREE.Shape[] = []

  glyphShapes.forEach((sourceShape) => {
    const outer = sourceShape.getPoints(26).map((p) => new THREE.Vector2(p.x - center.x, p.y - center.y))
    const centeredShape = shapeFromPoints(outer)

    sourceShape.holes.forEach((holePath) => {
      const hole = holePath.getPoints(26).map((p) => new THREE.Vector2(p.x - center.x, p.y - center.y))
      centeredShape.holes.push(pathFromPoints(hole))
    })

    centeredShapes.push(centeredShape)
  })

  return centeredShapes
}

function createEmbossTextMesh(config: TagConfig): THREE.Mesh | null {
  if (!loadedFont) {
    return null
  }

  const seamOverlap = 0.5

  const textGeometry = new TextGeometry(config.text, {
    font: loadedFont as never,
    size: config.fontSize,
    depth: config.textDepth + seamOverlap,
    curveSegments: 48,
    bevelEnabled: false,
  })

  textGeometry.computeBoundingBox()
  const box = textGeometry.boundingBox
  if (!box) {
    return null
  }

  const centerX = (box.max.x + box.min.x) / 2
  const centerY = (box.max.y + box.min.y) / 2
  textGeometry.translate(-centerX, -centerY, 0)

  const textMesh = new THREE.Mesh(textGeometry, baseMaterial)
  textMesh.position.z = config.thickness - seamOverlap
  return textMesh
}

function createDebossMeshes(config: TagConfig): THREE.Mesh[] {
  const seamOverlap = 0.15

  const lowerShape = createBaseShape(config)
  const lowerGeometry = new THREE.ExtrudeGeometry(lowerShape, {
    depth: config.thickness - config.textDepth + seamOverlap,
    bevelEnabled: false,
    curveSegments: 64,
  })
  lowerGeometry.computeVertexNormals()
  const lowerMesh = new THREE.Mesh(lowerGeometry, baseMaterial)

  const topShape = createBaseShape(config)
  const counterIslandMeshes: THREE.Mesh[] = []
  centeredGlyphShapes(config).forEach((glyphShape) => {
    topShape.holes.push(pathFromPoints(glyphShape.getPoints(26)))

    // Preserve internal counters like in A/O/P/R/B/D as solid islands.
    glyphShape.holes.forEach((counterPath) => {
      const counterShape = shapeFromPoints(counterPath.getPoints(26))
      const counterGeometry = new THREE.ExtrudeGeometry(counterShape, {
        depth: config.textDepth + seamOverlap,
        bevelEnabled: false,
        curveSegments: 64,
      })
      counterGeometry.computeVertexNormals()
      const counterMesh = new THREE.Mesh(counterGeometry, baseMaterial)
      counterMesh.position.z = config.thickness - config.textDepth - seamOverlap
      counterIslandMeshes.push(counterMesh)
    })
  })

  const topGeometry = new THREE.ExtrudeGeometry(topShape, {
    depth: config.textDepth + seamOverlap,
    bevelEnabled: false,
    curveSegments: 64,
  })
  topGeometry.computeVertexNormals()
  const topMesh = new THREE.Mesh(topGeometry, baseMaterial)
  topMesh.position.z = config.thickness - config.textDepth - seamOverlap

  return [lowerMesh, topMesh, ...counterIslandMeshes]
}

function rebuildTag(): void {
  if (!loadedFont) {
    return
  }

  const config = getConfigFromForm()
  if (activeTagObject) {
    scene.remove(activeTagObject)
    disposeObjectDeep(activeTagObject)
  }

  const tagGroup = new THREE.Group()
  if (config.textMode === 'deboss') {
    createDebossMeshes(config).forEach((mesh) => tagGroup.add(mesh))
  } else {
    tagGroup.add(createBaseMesh(config))
    const textMesh = createEmbossTextMesh(config)
    if (textMesh) {
      tagGroup.add(textMesh)
    }
  }

  tagGroup.position.set(0, 0, 0)
  activeTagObject = tagGroup
  scene.add(activeTagObject)
}

function resizeRenderer(): void {
  const wrapper = canvas.parentElement
  if (!wrapper) {
    return
  }
  const width = wrapper.clientWidth
  const height = wrapper.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate(): void {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

function repairSolid(solid: unknown): unknown {
  try {
    const generalized = (modifiers.generalize as unknown as (options: unknown, geometry: unknown) => unknown)(
      { snap: true, simplify: true, triangulate: true },
      solid,
    )
    const retessellated = (modifiers.retessellate as unknown as (geometry: unknown) => unknown)(generalized)
    return (modifiers.generalize as unknown as (options: unknown, geometry: unknown) => unknown)(
      { snap: true, triangulate: true },
      retessellated,
    )
  } catch {
    return solid
  }
}

function buildWatertightSolid(root: THREE.Object3D): unknown | null {
  const positions: number[] = []
  const normals: number[] = []
  root.updateWorldMatrix(true, true)

  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) {
      return
    }

    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    if (!geometry.attributes.position) {
      return
    }

    const geomPos = geometry.getAttribute('position') as THREE.BufferAttribute
    const geomNorm = geometry.getAttribute('normal') as THREE.BufferAttribute

    for (let i = 0; i < geomPos.count; i++) {
      positions.push(geomPos.getX(i), geomPos.getY(i), geomPos.getZ(i))
      if (geomNorm) {
        normals.push(geomNorm.getX(i), geomNorm.getY(i), geomNorm.getZ(i))
      }
    }

    geometry.dispose()
  })

  if (positions.length === 0) {
    return null
  }

  // Convert merged geometry to JSCAD solid for repair and export
  const triangles: number[][][] = []
  for (let i = 0; i < positions.length; i += 9) {
    triangles.push([
      [positions[i], positions[i + 1], positions[i + 2]],
      [positions[i + 3], positions[i + 4], positions[i + 5]],
      [positions[i + 6], positions[i + 7], positions[i + 8]],
    ])
  }

  if (triangles.length === 0) {
    return null
  }

  const solid = (geometries.geom3.fromPoints as (points: number[][][]) => unknown)(triangles)
  return repairSolid(solid)
}

function toUint8Array(parts: Array<ArrayBuffer | Uint8Array | string>): Uint8Array {
  const chunks = parts.map((part) => {
    if (typeof part === 'string') {
      return new TextEncoder().encode(part)
    }
    if (part instanceof Uint8Array) {
      return part
    }
    return new Uint8Array(part)
  })

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    joined.set(chunk, offset)
    offset += chunk.length
  })
  return joined
}

function downloadStl(): void {
  if (!activeTagObject) {
    return
  }

  let binaryStl: Uint8Array
  let usedFallback = false

  try {
    const solid = buildWatertightSolid(activeTagObject)
    if (!solid) {
      throw new Error('Brak geometrii do eksportu STL.')
    }
    const serialized = serializeStl({ binary: true }, solid) as Array<ArrayBuffer | Uint8Array | string>
    const jscadBinary = toUint8Array(serialized)
    binaryStl = new Uint8Array(jscadBinary.length)
    binaryStl.set(jscadBinary)
  } catch (error) {
    console.error('JSCAD STL export failed. Falling back to THREE exporter.', error)
    const exporter = new STLExporter()
    const fallbackData = exporter.parse(activeTagObject, { binary: true }) as DataView
    binaryStl = new Uint8Array(fallbackData.byteLength)
    binaryStl.set(new Uint8Array(fallbackData.buffer, fallbackData.byteOffset, fallbackData.byteLength))
    usedFallback = true
  }

  const arrayBuffer = new ArrayBuffer(binaryStl.byteLength)
  new Uint8Array(arrayBuffer).set(binaryStl)
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${getConfigFromForm().text.toLowerCase().replace(/\s+/g, '-') || 'tag'}.stl`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)

  if (usedFallback) {
    window.alert('Eksport STL zakonczony trybem awaryjnym. Plik moze wymagac naprawy watertight w narzedziu CAD.')
  }
}

function readPresets(): Record<string, TagConfig> {
  try {
    const raw = localStorage.getItem(presetsStorageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, TagConfig>
    return parsed || {}
  } catch {
    return {}
  }
}

function writePresets(presets: Record<string, TagConfig>): void {
  localStorage.setItem(presetsStorageKey, JSON.stringify(presets))
}

function refreshPresetSelect(): void {
  const presets = readPresets()
  const names = Object.keys(presets).sort((a, b) => a.localeCompare(b))
  controlsMap.presetSelect.innerHTML = '<option value="">-- wybierz --</option>'
  names.forEach((name) => {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    controlsMap.presetSelect.append(option)
  })
}

function wireEvents(): void {
  const updateInputs = [
    controlsMap.text,
    controlsMap.shape,
    controlsMap.width,
    controlsMap.height,
    controlsMap.thickness,
    controlsMap.cornerRadius,
    controlsMap.holeDiameter,
    controlsMap.holeMargin,
    controlsMap.fontSize,
    controlsMap.textDepth,
    controlsMap.textMode,
  ]

  let rebuildTimer: number | null = null
  const queueRebuild = (): void => {
    if (rebuildTimer !== null) {
      window.clearTimeout(rebuildTimer)
    }
    rebuildTimer = window.setTimeout(() => {
      rebuildTag()
    }, 90)
  }

  updateInputs.forEach((el) => el.addEventListener('input', queueRebuild))
  updateInputs.forEach((el) => el.addEventListener('change', queueRebuild))

  controlsMap.exportBtn.addEventListener('click', downloadStl)

  controlsMap.resetBtn.addEventListener('click', () => {
    applyConfigToForm(defaultConfig)
    rebuildTag()
  })

  controlsMap.savePresetBtn.addEventListener('click', () => {
    const presetName = controlsMap.presetName.value.trim()
    if (!presetName) {
      return
    }
    const presets = readPresets()
    presets[presetName] = getConfigFromForm()
    writePresets(presets)
    refreshPresetSelect()
    controlsMap.presetSelect.value = presetName
  })

  controlsMap.presetSelect.addEventListener('change', () => {
    const presetName = controlsMap.presetSelect.value
    if (!presetName) {
      return
    }
    const presets = readPresets()
    const preset = presets[presetName]
    if (!preset) {
      return
    }
    applyConfigToForm(preset)
    controlsMap.presetName.value = presetName
    rebuildTag()
  })

  controlsMap.deletePresetBtn.addEventListener('click', () => {
    const presetName = controlsMap.presetSelect.value || controlsMap.presetName.value.trim()
    if (!presetName) {
      return
    }
    const presets = readPresets()
    if (!presets[presetName]) {
      return
    }
    delete presets[presetName]
    writePresets(presets)
    refreshPresetSelect()
    controlsMap.presetName.value = ''
  })

  window.addEventListener('resize', resizeRenderer)
}

function start(): void {
  const fontLoader = new FontLoader()
  fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
    loadedFont = font
    refreshPresetSelect()
    wireEvents()
    resizeRenderer()
    rebuildTag()
    animate()
  })
}

start()
