import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CSG } from 'three-csg-ts'

type ModelType = 'tag' | 'dice'
type TagShape = 'rounded' | 'capsule' | 'circle'
type FontChoice =
  | 'helvetiker'
  | 'optimer'
  | 'gentilis'
  | 'droidSans'
  | 'droidSerif'
  | 'notoSansPl'
  | 'notoSerifPl'
  | 'custom'

interface TagConfig {
  modelType: ModelType
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
  diceSize: number
  diceRoundness: number
  diceSphereRadius: number
  diceShowCube: boolean
  diceShowText: boolean
  diceShowSphere: boolean
  diceFace1: string
  diceFace2: string
  diceFace3: string
  diceFace4: string
  diceFace5: string
  diceFace6: string
  diceFaceDepth1: number
  diceFaceDepth2: number
  diceFaceDepth3: number
  diceFaceDepth4: number
  diceFaceDepth5: number
  diceFaceDepth6: number
}

const maxTextLines = 4
const maxCharsPerLine = 18
const textLineSpacingFactor = 1.2

const defaultConfig: TagConfig = {
  modelType: 'tag',
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
  diceSize: 20,
  diceRoundness: 2,
  diceSphereRadius: 0,
  diceShowCube: true,
  diceShowText: true,
  diceShowSphere: false,
  diceFace1: '1',
  diceFace2: '2',
  diceFace3: '3',
  diceFace4: '4',
  diceFace5: '5',
  diceFace6: '6',
  diceFaceDepth1: -1,
  diceFaceDepth2: -1,
  diceFaceDepth3: -1,
  diceFaceDepth4: -1,
  diceFaceDepth5: -1,
  diceFaceDepth6: -1,
}

const presetsStorageKey = 'printable-studio-presets-v1'
const lastStateStorageKey = 'printable-studio-last-state-v1'
const defaultFontChoice: Exclude<FontChoice, 'custom'> = 'helvetiker'

interface PersistedAppState {
  config: TagConfig
  fontChoice: Exclude<FontChoice, 'custom'>
}

const builtinFontUrls: Record<Exclude<FontChoice, 'custom'>, string> = {
  helvetiker: '/fonts/helvetiker_regular.typeface.json',
  optimer: '/fonts/optimer_regular.typeface.json',
  gentilis: '/fonts/gentilis_regular.typeface.json',
  droidSans: '/fonts/droid/droid_sans_regular.typeface.json',
  droidSerif: '/fonts/droid/droid_serif_regular.typeface.json',
  notoSansPl: '/fonts/pl/noto_sans_regular.typeface.json',
  notoSerifPl: '/fonts/pl/noto_serif_regular.typeface.json',
}

const polishGlyphFallback: Record<string, string> = {
  '\u0105': 'a',
  '\u0107': 'c',
  '\u0119': 'e',
  '\u0142': 'l',
  '\u0144': 'n',
  '\u00f3': 'o',
  '\u015b': 's',
  '\u017a': 'z',
  '\u017c': 'z',
  '\u0104': 'A',
  '\u0106': 'C',
  '\u0118': 'E',
  '\u0141': 'L',
  '\u0143': 'N',
  '\u00d3': 'O',
  '\u015a': 'S',
  '\u0179': 'Z',
  '\u017b': 'Z',
}

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
        <label for="modelType">Typ modelu</label>
        <select id="modelType">
          <option value="tag">Plaski tag</option>
          <option value="dice">Kostka (kosc do gry)</option>
        </select>
      </div>

      <div class="field">
        <label for="fontChoice">Font</label>
        <select id="fontChoice">
          <option value="helvetiker">Helvetiker (domyslny)</option>
          <option value="notoSansPl">Noto Sans (PL)</option>
          <option value="notoSerifPl">Noto Serif (PL)</option>
          <option value="optimer">Optimer</option>
          <option value="gentilis">Gentilis</option>
          <option value="droidSans">Droid Sans</option>
          <option value="droidSerif">Droid Serif</option>
          <option value="custom">Wlasny font (typeface.json)</option>
        </select>
      </div>

      <div class="field" id="customFontWrap" style="display: none;">
        <label for="customFontFile">Wlasny plik fontu</label>
        <input id="customFontFile" type="file" accept=".json,application/json" />
        <small id="fontStatus">Wybierz plik typeface.json.</small>
      </div>

      <div id="tagControls">
        <div class="field">
          <label for="text">Napis</label>
          <textarea id="text" rows="3" placeholder="Wpisz kilka linii tekstu">${defaultConfig.text}</textarea>
        </div>

        <div class="field">
          <label for="shape">Ksztalt</label>
          <select id="shape">
            <option value="rounded">Zaokraglony prostokat</option>
            <option value="capsule">Kapsula</option>
            <option value="circle">Kolo</option>
          </select>
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
            <label for="textDepth">Glebokosc tekstu (mm, ujemna = wklesly)</label>
            <input id="textDepth" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.textDepth}" />
          </div>
        </div>
      </div>

      <div id="diceControls" style="display: none;">
        <div class="grid-2">
          <div class="field">
            <label for="diceSize">Rozmiar kostki (mm)</label>
            <input id="diceSize" type="number" min="10" max="60" step="0.5" value="${defaultConfig.diceSize}" />
          </div>
          <div class="field">
            <label for="diceRoundness">Okraglosc krawedzi (mm)</label>
            <input id="diceRoundness" type="number" min="0" max="10" step="0.1" value="${defaultConfig.diceRoundness}" />
          </div>
        </div>

        <div class="field">
          <label for="diceSphereRadius">Promien kuli podgladu (mm)</label>
          <input id="diceSphereRadius" type="number" min="0" max="100" step="0.1" value="${defaultConfig.diceSphereRadius}" />
        </div>

        <details class="dice-faces-panel" id="dicePreviewPanel" open>
          <summary>Podglad tymczasowy</summary>
          <div class="grid-2">
            <label class="field-inline">
              <input id="diceShowCube" type="checkbox" checked />
              <span>Widoczny sześcian</span>
            </label>
            <label class="field-inline">
              <input id="diceShowText" type="checkbox" checked />
              <span>Widoczny tekst</span>
            </label>
          </div>
          <label class="field-inline">
            <input id="diceShowSphere" type="checkbox" />
            <span>Widoczna kula ograniczająca</span>
          </label>
        </details>

        <details class="dice-faces-panel" id="diceFacesPanel">
          <summary>Sciany kostki (kliknij, aby rozwinac)</summary>

          <div class="grid-2">
            <div class="field">
              <label for="diceDepthAll">Glebokosc wszystkich scian (mm)</label>
              <input id="diceDepthAll" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth1}" />
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button id="applyDiceDepthAllBtn" type="button">Ustaw wszystkie</button>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="diceFace1">Sciana 1 (+Z)</label>
              <input id="diceFace1" type="text" maxlength="10" value="${defaultConfig.diceFace1}" />
              <input id="diceFaceDepth1" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth1}" />
            </div>
            <div class="field">
              <label for="diceFace2">Sciana 2 (-Z)</label>
              <input id="diceFace2" type="text" maxlength="10" value="${defaultConfig.diceFace2}" />
              <input id="diceFaceDepth2" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth2}" />
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="diceFace3">Sciana 3 (+X)</label>
              <input id="diceFace3" type="text" maxlength="10" value="${defaultConfig.diceFace3}" />
              <input id="diceFaceDepth3" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth3}" />
            </div>
            <div class="field">
              <label for="diceFace4">Sciana 4 (-X)</label>
              <input id="diceFace4" type="text" maxlength="10" value="${defaultConfig.diceFace4}" />
              <input id="diceFaceDepth4" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth4}" />
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="diceFace5">Sciana 5 (+Y)</label>
              <input id="diceFace5" type="text" maxlength="10" value="${defaultConfig.diceFace5}" />
              <input id="diceFaceDepth5" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth5}" />
            </div>
            <div class="field">
              <label for="diceFace6">Sciana 6 (-Y)</label>
              <input id="diceFace6" type="text" maxlength="10" value="${defaultConfig.diceFace6}" />
              <input id="diceFaceDepth6" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth6}" />
            </div>
          </div>
        </details>
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
  modelType: requiredElement<HTMLSelectElement>('#modelType'),
  tagControls: requiredElement<HTMLDivElement>('#tagControls'),
  diceControls: requiredElement<HTMLDivElement>('#diceControls'),
  text: requiredElement<HTMLTextAreaElement>('#text'),
  fontChoice: requiredElement<HTMLSelectElement>('#fontChoice'),
  customFontWrap: requiredElement<HTMLDivElement>('#customFontWrap'),
  customFontFile: requiredElement<HTMLInputElement>('#customFontFile'),
  fontStatus: requiredElement<HTMLElement>('#fontStatus'),
  shape: requiredElement<HTMLSelectElement>('#shape'),
  width: requiredElement<HTMLInputElement>('#width'),
  height: requiredElement<HTMLInputElement>('#height'),
  thickness: requiredElement<HTMLInputElement>('#thickness'),
  cornerRadius: requiredElement<HTMLInputElement>('#cornerRadius'),
  holeDiameter: requiredElement<HTMLInputElement>('#holeDiameter'),
  holeMargin: requiredElement<HTMLInputElement>('#holeMargin'),
  diceSize: requiredElement<HTMLInputElement>('#diceSize'),
  diceRoundness: requiredElement<HTMLInputElement>('#diceRoundness'),
  diceSphereRadius: requiredElement<HTMLInputElement>('#diceSphereRadius'),
  diceShowCube: requiredElement<HTMLInputElement>('#diceShowCube'),
  diceShowText: requiredElement<HTMLInputElement>('#diceShowText'),
  diceShowSphere: requiredElement<HTMLInputElement>('#diceShowSphere'),
  diceDepthAll: requiredElement<HTMLInputElement>('#diceDepthAll'),
  applyDiceDepthAllBtn: requiredElement<HTMLButtonElement>('#applyDiceDepthAllBtn'),
  diceFace1: requiredElement<HTMLInputElement>('#diceFace1'),
  diceFace2: requiredElement<HTMLInputElement>('#diceFace2'),
  diceFace3: requiredElement<HTMLInputElement>('#diceFace3'),
  diceFace4: requiredElement<HTMLInputElement>('#diceFace4'),
  diceFace5: requiredElement<HTMLInputElement>('#diceFace5'),
  diceFace6: requiredElement<HTMLInputElement>('#diceFace6'),
  diceFaceDepth1: requiredElement<HTMLInputElement>('#diceFaceDepth1'),
  diceFaceDepth2: requiredElement<HTMLInputElement>('#diceFaceDepth2'),
  diceFaceDepth3: requiredElement<HTMLInputElement>('#diceFaceDepth3'),
  diceFaceDepth4: requiredElement<HTMLInputElement>('#diceFaceDepth4'),
  diceFaceDepth5: requiredElement<HTMLInputElement>('#diceFaceDepth5'),
  diceFaceDepth6: requiredElement<HTMLInputElement>('#diceFaceDepth6'),
  fontSize: requiredElement<HTMLInputElement>('#fontSize'),
  textDepth: requiredElement<HTMLInputElement>('#textDepth'),
  exportBtn: requiredElement<HTMLButtonElement>('#exportBtn'),
  resetBtn: requiredElement<HTMLButtonElement>('#resetBtn'),
  presetName: requiredElement<HTMLInputElement>('#presetName'),
  savePresetBtn: requiredElement<HTMLButtonElement>('#savePresetBtn'),
  deletePresetBtn: requiredElement<HTMLButtonElement>('#deletePresetBtn'),
  presetSelect: requiredElement<HTMLSelectElement>('#presetSelect'),
}

controlsMap.modelType.value = defaultConfig.modelType
controlsMap.fontChoice.value = defaultFontChoice

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
const fontLoader = new FontLoader()
let fontLoadToken = 0

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sanitizeTextInput(raw: string): string {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .slice(0, maxTextLines)
    .map((line) => line.slice(0, maxCharsPerLine).trimEnd())

  while (lines.length > 1 && lines.at(-1) === '') {
    lines.pop()
  }

  return lines.some((line) => line.trim().length > 0) ? lines.join('\n') : 'TAG'
}

function sanitizeDiceFaceText(raw: string): string {
  return raw.replace(/\r|\n/g, '').trim().slice(0, 10)
}

function getTextLines(text: string): string[] {
  return text.replace(/\r/g, '').split('\n').slice(0, maxTextLines)
}

function fontHasGlyph(char: string): boolean {
  if (!loadedFont) {
    return false
  }

  const fontData = (loadedFont as { data?: { glyphs?: Record<string, unknown> } }).data
  const glyphs = fontData?.glyphs
  if (!glyphs) {
    return false
  }

  return glyphs[char] !== undefined
}

function normalizeTextForFont(text: string): string {
  return Array.from(text, (char) => {
    if (fontHasGlyph(char)) {
      return char
    }
    return polishGlyphFallback[char] ?? char
  }).join('')
}

function setFontStatus(message: string, isError: boolean): void {
  controlsMap.fontStatus.textContent = message
  controlsMap.fontStatus.style.color = isError ? '#a03939' : ''
}

function isBuiltinFontChoice(choice: FontChoice): choice is Exclude<FontChoice, 'custom'> {
  return choice !== 'custom'
}

function updateCustomFontVisibility(): void {
  const isCustom = controlsMap.fontChoice.value === 'custom'
  controlsMap.customFontWrap.style.display = isCustom ? '' : 'none'
}

function updateModelControlsVisibility(): void {
  const modelType = controlsMap.modelType.value as ModelType
  const isDice = modelType === 'dice'
  controlsMap.tagControls.style.display = isDice ? 'none' : ''
  controlsMap.diceControls.style.display = isDice ? '' : 'none'
  shadowPlate.visible = !isDice
}

function loadFontFromUrl(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    fontLoader.load(url, (font) => resolve(font), undefined, (error) => reject(error))
  })
}

async function applyBuiltinFont(choice: Exclude<FontChoice, 'custom'>): Promise<void> {
  const token = ++fontLoadToken
  setFontStatus('Ladowanie fontu...', false)

  try {
    const font = await loadFontFromUrl(builtinFontUrls[choice])
    if (token !== fontLoadToken) {
      return
    }
    loadedFont = font
    setFontStatus('Font zaladowany.', false)
    rebuildTag()
  } catch {
    if (token !== fontLoadToken) {
      return
    }
    setFontStatus('Nie udalo sie zaladowac fontu.', true)
  }
}

async function applyCustomFontFromFile(file: File): Promise<void> {
  const token = ++fontLoadToken
  setFontStatus(`Ladowanie: ${file.name}`, false)

  try {
    const raw = await file.text()
    const parsed = JSON.parse(raw)
    const font = fontLoader.parse(parsed as never)
    if (token !== fontLoadToken) {
      return
    }
    loadedFont = font
    setFontStatus(`Wlasny font zaladowany: ${file.name}`, false)
    rebuildTag()
  } catch {
    if (token !== fontLoadToken) {
      return
    }
    setFontStatus('Niepoprawny plik fontu. Uzyj typeface.json.', true)
  }
}

function disposeObjectDeep(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
    }
  })
}

function createLaidOutTextGeometries(config: TagConfig, depth: number): TextGeometry[] {
  if (!loadedFont) {
    return []
  }

  const lines = getTextLines(config.text)
  const lineSpacing = config.fontSize * textLineSpacingFactor
  const verticalCenterOffset = ((lines.length - 1) * lineSpacing) / 2
  const geometries: TextGeometry[] = []

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  lines.forEach((line, index) => {
    const normalizedLine = normalizeTextForFont(line)
    if (normalizedLine.length === 0) {
      return
    }

    const geometry = new TextGeometry(normalizedLine, {
      font: loadedFont as never,
      size: config.fontSize,
      depth,
      curveSegments: 18,
      bevelEnabled: false,
    })

    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) {
      geometry.dispose()
      return
    }

    const centerX = (box.max.x + box.min.x) / 2
    const centerY = (box.max.y + box.min.y) / 2
    const lineOffsetY = verticalCenterOffset - index * lineSpacing

    minX = Math.min(minX, box.min.x - centerX)
    maxX = Math.max(maxX, box.max.x - centerX)
    minY = Math.min(minY, box.min.y - centerY + lineOffsetY)
    maxY = Math.max(maxY, box.max.y - centerY + lineOffsetY)

    geometry.translate(-centerX, -centerY + lineOffsetY, 0)
    geometries.push(geometry)
  })

  if (geometries.length === 0) {
    return []
  }

  const overallCenterX = (minX + maxX) / 2
  const overallCenterY = (minY + maxY) / 2
  geometries.forEach((geometry) => geometry.translate(-overallCenterX, -overallCenterY, 0))

  return geometries
}

function cloneShiftedShape(shape: THREE.Shape, offsetX: number, offsetY: number): THREE.Shape {
  const shiftedOuter = shape
    .getPoints(26)
    .map((p) => new THREE.Vector2(p.x + offsetX, p.y + offsetY))
  const shiftedShape = shapeFromPoints(shiftedOuter)

  shape.holes.forEach((holePath) => {
    const shiftedHole = holePath
      .getPoints(26)
      .map((p) => new THREE.Vector2(p.x + offsetX, p.y + offsetY))
    shiftedShape.holes.push(pathFromPoints(shiftedHole))
  })

  return shiftedShape
}

function createLaidOutTextShapes(config: TagConfig): THREE.Shape[] {
  if (!loadedFont) {
    return []
  }

  const font = loadedFont as {
    generateShapes: (text: string, size: number) => THREE.Shape[]
  }

  const lines = getTextLines(config.text)
  const lineSpacing = config.fontSize * textLineSpacingFactor
  const verticalCenterOffset = ((lines.length - 1) * lineSpacing) / 2
  const translatedShapes: THREE.Shape[] = []

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  lines.forEach((line, index) => {
    const normalizedLine = normalizeTextForFont(line)
    if (normalizedLine.length === 0) {
      return
    }

    const lineShapes = font.generateShapes(normalizedLine, config.fontSize)
    if (lineShapes.length === 0) {
      return
    }

    const lineBounds = new THREE.Box2(
      new THREE.Vector2(Infinity, Infinity),
      new THREE.Vector2(-Infinity, -Infinity),
    )

    lineShapes.forEach((shape) => {
      shape.getPoints(24).forEach((p) => lineBounds.expandByPoint(p))
    })

    if (!Number.isFinite(lineBounds.min.x) || !Number.isFinite(lineBounds.min.y)) {
      return
    }

    const lineCenterX = (lineBounds.max.x + lineBounds.min.x) / 2
    const lineCenterY = (lineBounds.max.y + lineBounds.min.y) / 2
    const lineOffsetY = verticalCenterOffset - index * lineSpacing

    lineShapes.forEach((shape) => {
      const shiftedShape = cloneShiftedShape(shape, -lineCenterX, -lineCenterY + lineOffsetY)
      translatedShapes.push(shiftedShape)

      shiftedShape.getPoints(24).forEach((p) => {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      })
    })
  })

  if (translatedShapes.length === 0) {
    return []
  }

  const overallCenterX = (minX + maxX) / 2
  const overallCenterY = (minY + maxY) / 2
  return translatedShapes.map((shape) => cloneShiftedShape(shape, -overallCenterX, -overallCenterY))
}

function createThroughCutBridges(config: TagConfig): THREE.Mesh[] {
  const shapes = createLaidOutTextShapes(config)
  if (shapes.length === 0) {
    return []
  }

  const bridgeWidth = clamp(config.fontSize * 0.1, 0.35, 1.25) * 0.5
  const bridgeDepth = config.thickness
  const bridges: THREE.Mesh[] = []

  shapes.forEach((shape) => {
    const outerBounds = new THREE.Box2(
      new THREE.Vector2(Infinity, Infinity),
      new THREE.Vector2(-Infinity, -Infinity),
    )
    shape.getPoints(30).forEach((p) => outerBounds.expandByPoint(p))
    const outerHeight = outerBounds.max.y - outerBounds.min.y

    shape.holes.forEach((holePath) => {
      const holeBounds = new THREE.Box2(
        new THREE.Vector2(Infinity, Infinity),
        new THREE.Vector2(-Infinity, -Infinity),
      )
      holePath.getPoints(30).forEach((p) => holeBounds.expandByPoint(p))

      const holeCenterX = (holeBounds.min.x + holeBounds.max.x) / 2
      if (outerHeight > bridgeWidth * 0.8) {
        const bridgeGeometry = new THREE.BoxGeometry(bridgeWidth, outerHeight, bridgeDepth)
        const bridgeMesh = new THREE.Mesh(bridgeGeometry, baseMaterial)
        bridgeMesh.position.set(holeCenterX, (outerBounds.min.y + outerBounds.max.y) / 2, config.thickness / 2)
        bridges.push(bridgeMesh)
      }
    })
  })

  return bridges
}

function getConfigFromForm(): TagConfig {
  const rawModelType = controlsMap.modelType.value as ModelType
  const modelType: ModelType = rawModelType === 'dice' ? 'dice' : 'tag'
  const rawShape = controlsMap.shape.value as TagShape
  const shape: TagShape = rawShape === 'capsule' || rawShape === 'circle' ? rawShape : 'rounded'

  const width = clamp(Number(controlsMap.width.value), 20, 120)
  const height = clamp(Number(controlsMap.height.value), 15, 60)
  const thickness = clamp(Number(controlsMap.thickness.value), 1.5, 8)
  const textDepth = clamp(Number(controlsMap.textDepth.value), -20, 20)
  const maxCorner = Math.min(width, height) * 0.49
  const text = sanitizeTextInput(controlsMap.text.value)
  const diceSize = clamp(Number(controlsMap.diceSize.value), 10, 60)
  const maxDiceRoundness = Math.max(0, diceSize * 0.18)
  const diceRoundness = clamp(Number(controlsMap.diceRoundness.value), 0, maxDiceRoundness)
  const diceSphereRadius = clamp(Number(controlsMap.diceSphereRadius.value), 0, 100)
  const diceShowCube = controlsMap.diceShowCube.checked
  const diceShowText = controlsMap.diceShowText.checked
  const diceShowSphere = controlsMap.diceShowSphere.checked
  const diceFaceDepth1 = clamp(Number(controlsMap.diceFaceDepth1.value), -20, 20)
  const diceFaceDepth2 = clamp(Number(controlsMap.diceFaceDepth2.value), -20, 20)
  const diceFaceDepth3 = clamp(Number(controlsMap.diceFaceDepth3.value), -20, 20)
  const diceFaceDepth4 = clamp(Number(controlsMap.diceFaceDepth4.value), -20, 20)
  const diceFaceDepth5 = clamp(Number(controlsMap.diceFaceDepth5.value), -20, 20)
  const diceFaceDepth6 = clamp(Number(controlsMap.diceFaceDepth6.value), -20, 20)

  return {
    modelType,
    text,
    shape,
    width,
    height,
    thickness,
    cornerRadius: clamp(Number(controlsMap.cornerRadius.value), 0, maxCorner),
    holeDiameter: clamp(Number(controlsMap.holeDiameter.value), 2, 12),
    holeMargin: clamp(Number(controlsMap.holeMargin.value), 2, 20),
    fontSize: clamp(Number(controlsMap.fontSize.value), 4, 22),
    textDepth,
    diceSize,
    diceRoundness,
    diceSphereRadius,
    diceShowCube,
    diceShowText,
    diceShowSphere,
    diceFace1: sanitizeDiceFaceText(controlsMap.diceFace1.value),
    diceFace2: sanitizeDiceFaceText(controlsMap.diceFace2.value),
    diceFace3: sanitizeDiceFaceText(controlsMap.diceFace3.value),
    diceFace4: sanitizeDiceFaceText(controlsMap.diceFace4.value),
    diceFace5: sanitizeDiceFaceText(controlsMap.diceFace5.value),
    diceFace6: sanitizeDiceFaceText(controlsMap.diceFace6.value),
    diceFaceDepth1,
    diceFaceDepth2,
    diceFaceDepth3,
    diceFaceDepth4,
    diceFaceDepth5,
    diceFaceDepth6,
  }
}

function applyConfigToForm(config: TagConfig): void {
  controlsMap.modelType.value = config.modelType
  controlsMap.text.value = config.text
  controlsMap.shape.value = config.shape
  controlsMap.width.value = String(config.width)
  controlsMap.height.value = String(config.height)
  controlsMap.thickness.value = String(config.thickness)
  controlsMap.cornerRadius.value = String(config.cornerRadius)
  controlsMap.holeDiameter.value = String(config.holeDiameter)
  controlsMap.holeMargin.value = String(config.holeMargin)
  controlsMap.diceSize.value = String(config.diceSize)
  controlsMap.diceRoundness.value = String(config.diceRoundness)
  controlsMap.diceSphereRadius.value = String(config.diceSphereRadius)
  controlsMap.diceShowCube.checked = Boolean(config.diceShowCube)
  controlsMap.diceShowText.checked = Boolean(config.diceShowText)
  controlsMap.diceShowSphere.checked = Boolean(config.diceShowSphere)
  controlsMap.diceFace1.value = config.diceFace1
  controlsMap.diceFace2.value = config.diceFace2
  controlsMap.diceFace3.value = config.diceFace3
  controlsMap.diceFace4.value = config.diceFace4
  controlsMap.diceFace5.value = config.diceFace5
  controlsMap.diceFace6.value = config.diceFace6
  controlsMap.diceFaceDepth1.value = String(config.diceFaceDepth1)
  controlsMap.diceFaceDepth2.value = String(config.diceFaceDepth2)
  controlsMap.diceFaceDepth3.value = String(config.diceFaceDepth3)
  controlsMap.diceFaceDepth4.value = String(config.diceFaceDepth4)
  controlsMap.diceFaceDepth5.value = String(config.diceFaceDepth5)
  controlsMap.diceFaceDepth6.value = String(config.diceFaceDepth6)
  controlsMap.diceDepthAll.value = String(config.diceFaceDepth1)
  controlsMap.fontSize.value = String(config.fontSize)
  controlsMap.textDepth.value = String(config.textDepth)
  updateModelControlsVisibility()
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
    curveSegments: 40,
  })

  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, baseMaterial)
}

function createCenteredTextGeometry(text: string, fontSize: number, depth: number): TextGeometry | null {
  if (!loadedFont) {
    return null
  }

  const normalizedText = normalizeTextForFont(text)
  if (normalizedText.length === 0) {
    return null
  }

  const geometry = new TextGeometry(normalizedText, {
    font: loadedFont as never,
    size: fontSize,
    depth,
    curveSegments: 18,
    bevelEnabled: false,
  })

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) {
    geometry.dispose()
    return null
  }

  const centerX = (box.max.x + box.min.x) / 2
  const centerY = (box.max.y + box.min.y) / 2
  geometry.translate(-centerX, -centerY, 0)
  return geometry
}

function setDicePreviewVisibility(object: THREE.Object3D, config: TagConfig): void {
  object.traverse((child) => {
    const previewRole = (child.userData as { previewRole?: string }).previewRole
    if (previewRole === 'cube') {
      child.visible = config.diceShowCube
    } else if (previewRole === 'text') {
      child.visible = config.diceShowText
    } else if (previewRole === 'sphere') {
      child.visible = config.diceShowSphere && config.diceSphereRadius > 0
    }
  })
}

function createDiceObject(config: TagConfig): THREE.Object3D {
  const size = config.diceSize
  const maxRoundness = size * 0.18
  const roundness = clamp(config.diceRoundness, 0, maxRoundness)
  const baseGeometry = new RoundedBoxGeometry(size, size, size, 4, roundness)
  baseGeometry.computeVertexNormals()
  let baseMesh: THREE.Mesh = new THREE.Mesh(baseGeometry, baseMaterial)
  baseMesh.userData.previewRole = 'cube'

  const faceDefs: Array<{
    text: string
    depth: number
    normal: THREE.Vector3
    rotation: THREE.Euler
  }> = [
    { text: config.diceFace1, depth: config.diceFaceDepth1, normal: new THREE.Vector3(0, 0, 1), rotation: new THREE.Euler(0, 0, 0) },
    { text: config.diceFace2, depth: config.diceFaceDepth2, normal: new THREE.Vector3(0, 0, -1), rotation: new THREE.Euler(0, Math.PI, 0) },
    { text: config.diceFace3, depth: config.diceFaceDepth3, normal: new THREE.Vector3(1, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) },
    { text: config.diceFace4, depth: config.diceFaceDepth4, normal: new THREE.Vector3(-1, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) },
    { text: config.diceFace5, depth: config.diceFaceDepth5, normal: new THREE.Vector3(0, 1, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0) },
    { text: config.diceFace6, depth: config.diceFaceDepth6, normal: new THREE.Vector3(0, -1, 0), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI) },
  ]

  const availableTextArea = size * 0.62
  const faceFontSize = Math.min(config.fontSize, availableTextArea)
  const embossMeshes: THREE.Mesh[] = []
  const cutters: THREE.Mesh[] = []
  const seamOverlap = 0.2

  faceDefs.forEach((face) => {
    const faceDepth = clamp(face.depth, -20, 20)
    const absDepth = Math.abs(faceDepth)
    if (absDepth < 0.001) {
      return
    }

    if (faceDepth > 0) {
      const geometry = createCenteredTextGeometry(face.text, faceFontSize, absDepth)
      if (!geometry) {
        return
      }

      const mesh = new THREE.Mesh(geometry, baseMaterial)
      mesh.rotation.copy(face.rotation)
      mesh.position.copy(face.normal.clone().multiplyScalar(size / 2 - 0.02))
      embossMeshes.push(mesh)
      return
    }

    const cutterDepth = absDepth + seamOverlap
    const cutterGeometry = createCenteredTextGeometry(face.text, faceFontSize, cutterDepth)
    if (!cutterGeometry) {
      return
    }

    const cutter = new THREE.Mesh(cutterGeometry, baseMaterial)
    cutter.rotation.copy(face.rotation)
    cutter.position.copy(face.normal.clone().multiplyScalar(size / 2 - cutterDepth + seamOverlap * 0.5))
    cutter.updateMatrix()
    cutters.push(cutter)
  })

  if (cutters.length > 0) {
    let mergedCutter: THREE.Mesh = cutters[0]
    for (let i = 1; i < cutters.length; i += 1) {
      mergedCutter.updateMatrix()
      cutters[i].updateMatrix()
      const nextMerged = CSG.union(mergedCutter, cutters[i])
      nextMerged.material = baseMaterial

      if (mergedCutter !== cutters[0]) {
        mergedCutter.geometry.dispose()
      }
      cutters[i].geometry.dispose()
      mergedCutter = nextMerged
    }

    baseMesh.updateMatrix()
    mergedCutter.updateMatrix()

    const debossedDice = CSG.subtract(baseMesh, mergedCutter)
    debossedDice.material = baseMaterial
    debossedDice.geometry.computeVertexNormals()

    baseMesh.geometry.dispose()
    mergedCutter.geometry.dispose()
    baseMesh = debossedDice
    baseMesh.userData.previewRole = 'cube'
  }

  if (config.diceSphereRadius > 0) {
    const clipSphere = new THREE.Mesh(new THREE.SphereGeometry(config.diceSphereRadius, 64, 32), baseMaterial)
    clipSphere.updateMatrix()

    baseMesh.updateMatrix()
    const clippedBase = CSG.intersect(baseMesh, clipSphere)
    clippedBase.material = baseMaterial
    clippedBase.geometry.computeVertexNormals()
    baseMesh.geometry.dispose()
    baseMesh = clippedBase
    baseMesh.userData.previewRole = 'cube'

    for (let i = 0; i < embossMeshes.length; i += 1) {
      embossMeshes[i].updateMatrix()
      clipSphere.updateMatrix()

      const clippedText = CSG.intersect(embossMeshes[i], clipSphere)
      clippedText.material = baseMaterial
      clippedText.geometry.computeVertexNormals()

      embossMeshes[i].geometry.dispose()
      clippedText.userData.previewRole = 'text'
      embossMeshes[i] = clippedText
    }

    clipSphere.geometry.dispose()
  }

  const group = new THREE.Group()
  group.add(baseMesh)
  embossMeshes.forEach((mesh) => {
    mesh.userData.previewRole = 'text'
    group.add(mesh)
  })

  if (config.diceSphereRadius > 0) {
    const sphereGeometry = new THREE.SphereGeometry(config.diceSphereRadius, 48, 24)
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: '#2b6cb0',
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    sphereMesh.userData.previewRole = 'sphere'
    group.add(sphereMesh)
  }

  setDicePreviewVisibility(group, config)
  return group
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
  const glyphShapes = font.generateShapes(normalizeTextForFont(config.text), config.fontSize)
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

function createEmbossTextMesh(config: TagConfig): THREE.Object3D | null {
  if (!loadedFont) {
    return null
  }

  const textGeometries = createLaidOutTextGeometries(config, Math.abs(config.textDepth))
  if (textGeometries.length === 0) {
    return null
  }

  if (textGeometries.length === 1) {
    const textMesh = new THREE.Mesh(textGeometries[0], baseMaterial)
    textMesh.position.z = config.thickness - 0.05
    return textMesh
  }

  const textGroup = new THREE.Group()
  textGeometries.forEach((geometry) => {
    const lineMesh = new THREE.Mesh(geometry, baseMaterial)
    lineMesh.position.z = config.thickness - 0.05
    textGroup.add(lineMesh)
  })

  return textGroup
}

function createDebossMeshesLegacy(config: TagConfig): THREE.Mesh[] {
  const lowerShape = createBaseShape(config)
  const lowerGeometry = new THREE.ExtrudeGeometry(lowerShape, {
    depth: config.thickness - Math.abs(config.textDepth),
    bevelEnabled: false,
    curveSegments: 40,
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
        depth: Math.abs(config.textDepth),
        bevelEnabled: false,
        curveSegments: 28,
      })
      counterGeometry.computeVertexNormals()
      const counterMesh = new THREE.Mesh(counterGeometry, baseMaterial)
      counterMesh.position.z = config.thickness - Math.abs(config.textDepth)
      counterIslandMeshes.push(counterMesh)
    })
  })

  const topGeometry = new THREE.ExtrudeGeometry(topShape, {
    depth: Math.abs(config.textDepth),
    bevelEnabled: false,
    curveSegments: 40,
  })
  topGeometry.computeVertexNormals()
  const topMesh = new THREE.Mesh(topGeometry, baseMaterial)
  topMesh.position.z = config.thickness - Math.abs(config.textDepth)

  return [lowerMesh, topMesh, ...counterIslandMeshes]
}

function createDebossMeshes(config: TagConfig): THREE.Mesh[] {
  if (!loadedFont) {
    return [createBaseMesh(config)]
  }

  try {
    const baseMesh = createBaseMesh(config)

    const seamOverlap = 0.2
    const textGeometries = createLaidOutTextGeometries(config, Math.abs(config.textDepth) + seamOverlap)
    if (textGeometries.length === 0) {
      baseMesh.geometry.computeVertexNormals()
      return [baseMesh]
    }

    const cutterMeshes: THREE.Mesh[] = textGeometries.map((geometry) => {
      const cutterMesh = new THREE.Mesh(geometry, baseMaterial)
      cutterMesh.position.z = config.thickness - Math.abs(config.textDepth) - seamOverlap * 0.5
      cutterMesh.updateMatrix()
      return cutterMesh
    })

    let mergedCutter: THREE.Mesh = cutterMeshes[0]
    for (let i = 1; i < cutterMeshes.length; i += 1) {
      mergedCutter.updateMatrix()
      cutterMeshes[i].updateMatrix()
      const nextMerged = CSG.union(mergedCutter, cutterMeshes[i])
      nextMerged.material = baseMaterial

      if (mergedCutter !== cutterMeshes[0]) {
        mergedCutter.geometry.dispose()
      }
      cutterMeshes[i].geometry.dispose()
      mergedCutter = nextMerged
    }

    baseMesh.updateMatrix()
    mergedCutter.updateMatrix()

    const debossMesh = CSG.subtract(baseMesh, mergedCutter)
    debossMesh.material = baseMaterial
    debossMesh.geometry.computeVertexNormals()

    const isThroughCut = config.textDepth >= config.thickness
    if (isThroughCut) {
      const bridges = createThroughCutBridges(config)
      let bridgedMesh = debossMesh

      bridges.forEach((bridgeMesh) => {
        bridgedMesh.updateMatrix()
        bridgeMesh.updateMatrix()

        const nextMesh = CSG.union(bridgedMesh, bridgeMesh)
        nextMesh.material = baseMaterial
        nextMesh.geometry.computeVertexNormals()

        bridgedMesh.geometry.dispose()
        bridgeMesh.geometry.dispose()
        bridgedMesh = nextMesh
      })

      baseMesh.geometry.dispose()
      mergedCutter.geometry.dispose()
      return [bridgedMesh]
    }

    baseMesh.geometry.dispose()
    mergedCutter.geometry.dispose()

    return [debossMesh]
  } catch {
    return createDebossMeshesLegacy(config)
  }
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

  const modelGroup = new THREE.Group()
  if (config.modelType === 'dice') {
    modelGroup.add(createDiceObject(config))
  } else if (config.textDepth < 0) {
    createDebossMeshes(config).forEach((mesh) => modelGroup.add(mesh))
  } else {
    modelGroup.add(createBaseMesh(config))
    const textMesh = createEmbossTextMesh(config)
    if (textMesh) {
      modelGroup.add(textMesh)
    }
  }

  modelGroup.position.set(0, 0, 0)
  activeTagObject = modelGroup
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

function downloadStl(): void {
  if (!activeTagObject) {
    return
  }

  const exporter = new STLExporter()
  const config = getConfigFromForm()
  const exportGroup = new THREE.Group()

  activeTagObject.updateMatrixWorld(true)
  activeTagObject.traverse((child) => {
    const mesh = child as THREE.Mesh
    const previewRole = (child.userData as { previewRole?: string }).previewRole
    if (!mesh.isMesh || !mesh.visible || previewRole === 'sphere') {
      return
    }

    const exportGeometry = mesh.geometry.clone()
    exportGeometry.applyMatrix4(mesh.matrixWorld)
    const exportMesh = new THREE.Mesh(exportGeometry, mesh.material)
    exportGroup.add(exportMesh)
  })

  if (exportGroup.children.length === 0) {
    return
  }

  exportGroup.updateMatrixWorld(true)
  const data = exporter.parse(exportGroup, { binary: true }) as DataView

  exportGroup.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
    }
  })

  const binaryStl = new Uint8Array(data.byteLength)
  binaryStl.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))

  const blob = new Blob([binaryStl], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${config.text.toLowerCase().replace(/\s+/g, '-') || 'tag'}.stl`
  link.click()
  URL.revokeObjectURL(url)
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

function readLastState(): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(lastStateStorageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>
    if (!parsed || typeof parsed !== 'object' || !parsed.config) {
      return null
    }

    const mergedConfig = { ...defaultConfig, ...parsed.config }
    const parsedFontChoice = parsed.fontChoice as FontChoice | undefined
    const fontChoice =
      parsedFontChoice && isBuiltinFontChoice(parsedFontChoice)
        ? parsedFontChoice
        : defaultFontChoice

    return {
      config: mergedConfig,
      fontChoice,
    }
  } catch {
    return null
  }
}

function saveLastState(): void {
  const selectedChoice = controlsMap.fontChoice.value as FontChoice
  const fontChoice = isBuiltinFontChoice(selectedChoice) ? selectedChoice : defaultFontChoice
  const payload: PersistedAppState = {
    config: getConfigFromForm(),
    fontChoice,
  }
  localStorage.setItem(lastStateStorageKey, JSON.stringify(payload))
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
    controlsMap.modelType,
    controlsMap.text,
    controlsMap.shape,
    controlsMap.width,
    controlsMap.height,
    controlsMap.thickness,
    controlsMap.cornerRadius,
    controlsMap.holeDiameter,
    controlsMap.holeMargin,
    controlsMap.diceSize,
    controlsMap.diceRoundness,
    controlsMap.diceSphereRadius,
    controlsMap.diceShowCube,
    controlsMap.diceShowText,
    controlsMap.diceShowSphere,
    controlsMap.diceFace1,
    controlsMap.diceFace2,
    controlsMap.diceFace3,
    controlsMap.diceFace4,
    controlsMap.diceFace5,
    controlsMap.diceFace6,
    controlsMap.diceFaceDepth1,
    controlsMap.diceFaceDepth2,
    controlsMap.diceFaceDepth3,
    controlsMap.diceFaceDepth4,
    controlsMap.diceFaceDepth5,
    controlsMap.diceFaceDepth6,
    controlsMap.diceDepthAll,
    controlsMap.fontSize,
    controlsMap.textDepth,
  ]

  let rebuildTimer: number | null = null
  const queueRebuild = (): void => {
    if (rebuildTimer !== null) {
      window.clearTimeout(rebuildTimer)
    }
    rebuildTimer = window.setTimeout(() => {
      saveLastState()
      rebuildTag()
    }, 90)
  }

  updateInputs.forEach((el) => el.addEventListener('input', queueRebuild))
  updateInputs.forEach((el) => el.addEventListener('change', queueRebuild))

  controlsMap.modelType.addEventListener('change', () => {
    updateModelControlsVisibility()
  })

  controlsMap.applyDiceDepthAllBtn.addEventListener('click', () => {
    const depth = clamp(Number(controlsMap.diceDepthAll.value), -20, 20)
    const asText = String(depth)
    controlsMap.diceFaceDepth1.value = asText
    controlsMap.diceFaceDepth2.value = asText
    controlsMap.diceFaceDepth3.value = asText
    controlsMap.diceFaceDepth4.value = asText
    controlsMap.diceFaceDepth5.value = asText
    controlsMap.diceFaceDepth6.value = asText
    queueRebuild()
  })

  controlsMap.fontChoice.addEventListener('change', () => {
    const choice = controlsMap.fontChoice.value as FontChoice
    updateCustomFontVisibility()
    if (isBuiltinFontChoice(choice)) {
      saveLastState()
      void applyBuiltinFont(choice)
    } else {
      setFontStatus('Wybierz plik typeface.json.', false)
    }
  })

  controlsMap.customFontFile.addEventListener('change', () => {
    const file = controlsMap.customFontFile.files?.[0]
    if (!file) {
      return
    }
    void applyCustomFontFromFile(file)
  })

  controlsMap.exportBtn.addEventListener('click', downloadStl)

  controlsMap.resetBtn.addEventListener('click', () => {
    applyConfigToForm(defaultConfig)
    saveLastState()
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
    applyConfigToForm({ ...defaultConfig, ...preset })
    controlsMap.presetName.value = presetName
    saveLastState()
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
  const persistedState = readLastState()
  if (persistedState) {
    applyConfigToForm(persistedState.config)
    controlsMap.fontChoice.value = persistedState.fontChoice
  }

  refreshPresetSelect()
  wireEvents()
  resizeRenderer()
  animate()
  updateModelControlsVisibility()
  updateCustomFontVisibility()
  const initialFontChoice = controlsMap.fontChoice.value as FontChoice
  const fontToLoad = isBuiltinFontChoice(initialFontChoice) ? initialFontChoice : defaultFontChoice
  void applyBuiltinFont(fontToLoad)
}

start()

