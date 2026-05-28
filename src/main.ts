import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshBVH } from 'three-mesh-bvh'
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
  backText: string
  shape: TagShape
  width: number
  height: number
  thickness: number
  cornerRadius: number
  holeDiameter: number
  holeMargin: number
  fontSize: number
  backFontSize: number
  textDepth: number
  backTextDepth: number
  diceSize: number
  diceRoundness: number
  diceSphereRadius: number
  diceClipWithSphere: boolean
  diceShowCube: boolean
  diceShowText: boolean
  diceShowSphere: boolean
  diceFace1: string
  diceFace2: string
  diceFace3: string
  diceFace4: string
  diceFace5: string
  diceFace6: string
  diceFaceTextEnabled1: boolean
  diceFaceTextEnabled2: boolean
  diceFaceTextEnabled3: boolean
  diceFaceTextEnabled4: boolean
  diceFaceTextEnabled5: boolean
  diceFaceTextEnabled6: boolean
  diceFaceLogoEnabled1: boolean
  diceFaceLogoEnabled2: boolean
  diceFaceLogoEnabled3: boolean
  diceFaceLogoEnabled4: boolean
  diceFaceLogoEnabled5: boolean
  diceFaceLogoEnabled6: boolean
  diceFaceDepth1: number
  diceFaceDepth2: number
  diceFaceDepth3: number
  diceFaceDepth4: number
  diceFaceDepth5: number
  diceFaceDepth6: number
  diceFaceFontSize1: number
  diceFaceFontSize2: number
  diceFaceFontSize3: number
  diceFaceFontSize4: number
  diceFaceFontSize5: number
  diceFaceFontSize6: number
  diceFaceLogoSize1: number
  diceFaceLogoSize2: number
  diceFaceLogoSize3: number
  diceFaceLogoSize4: number
  diceFaceLogoSize5: number
  diceFaceLogoSize6: number
  diceFaceLogoDepth1: number
  diceFaceLogoDepth2: number
  diceFaceLogoDepth3: number
  diceFaceLogoDepth4: number
  diceFaceLogoDepth5: number
  diceFaceLogoDepth6: number
  logoEnabled: boolean
  logoSize: number
  logoDepth: number
  backLogoEnabled: boolean
  backLogoSize: number
  backLogoDepth: number
}

const maxTextLines = 4
const maxCharsPerLine = 18
const textLineSpacingFactor = 1.2

const defaultConfig: TagConfig = {
  modelType: 'tag',
  text: 'LUNA',
  backText: '',
  shape: 'rounded',
  width: 62,
  height: 28,
  thickness: 3,
  cornerRadius: 5,
  holeDiameter: 5,
  holeMargin: 6,
  fontSize: 9,
  textDepth: 1,
  backTextDepth: 1,
  backFontSize: 9,
  diceSize: 20,
  diceRoundness: 2,
  diceSphereRadius: 13.3,
  diceClipWithSphere: false,
  diceShowCube: true,
  diceShowText: true,
  diceShowSphere: false,
  diceFace1: '1',
  diceFace2: '2',
  diceFace3: '3',
  diceFace4: '4',
  diceFace5: '5',
  diceFace6: '6',
  diceFaceTextEnabled1: true,
  diceFaceTextEnabled2: true,
  diceFaceTextEnabled3: true,
  diceFaceTextEnabled4: true,
  diceFaceTextEnabled5: true,
  diceFaceTextEnabled6: true,
  diceFaceLogoEnabled1: false,
  diceFaceLogoEnabled2: false,
  diceFaceLogoEnabled3: false,
  diceFaceLogoEnabled4: false,
  diceFaceLogoEnabled5: false,
  diceFaceLogoEnabled6: false,
  diceFaceDepth1: -1,
  diceFaceDepth2: -1,
  diceFaceDepth3: -1,
  diceFaceDepth4: -1,
  diceFaceDepth5: -1,
  diceFaceDepth6: -1,
  diceFaceFontSize1: 8,
  diceFaceFontSize2: 8,
  diceFaceFontSize3: 8,
  diceFaceFontSize4: 8,
  diceFaceFontSize5: 8,
  diceFaceFontSize6: 8,
  diceFaceLogoSize1: 6,
  diceFaceLogoSize2: 6,
  diceFaceLogoSize3: 6,
  diceFaceLogoSize4: 6,
  diceFaceLogoSize5: 6,
  diceFaceLogoSize6: 6,
  diceFaceLogoDepth1: 0.8,
  diceFaceLogoDepth2: 0.8,
  diceFaceLogoDepth3: 0.8,
  diceFaceLogoDepth4: 0.8,
  diceFaceLogoDepth5: 0.8,
  diceFaceLogoDepth6: 0.8,
  logoEnabled: false,
  logoSize: 8,
  logoDepth: 0.8,
  backLogoEnabled: false,
  backLogoSize: 8,
  backLogoDepth: 0.8,
}

const presetsStorageKey = 'printable-studio-presets-v1'
const lastStateStorageKey = 'printable-studio-last-state-v1'
const panelWidthStorageKey = 'printable-studio-panel-width-v1'
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
          <option value="custom">Wlasny font (.ttf lub typeface.json)</option>
        </select>
      </div>

      <div class="field" id="customFontWrap" style="display: none;">
        <label for="customFontFile">Wlasny plik fontu</label>
        <input id="customFontFile" type="file" accept=".ttf,.json,application/json,font/ttf" />
        <small id="fontStatus">Wybierz plik .ttf lub typeface.json.</small>
      </div>

      <div id="tagControls">
        <details class="dice-faces-panel" id="tagBasePanel" open>
          <summary>Parametry tagu</summary>

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
        </details>

        <details class="dice-faces-panel" id="tagFrontPanel" open>
          <summary>Awers (gora)</summary>

          <div class="field">
            <label for="text">Napis</label>
            <textarea id="text" rows="3" placeholder="Wpisz kilka linii tekstu">${defaultConfig.text}</textarea>
          </div>

          <div class="field">
            <label for="textDepth">Glebokosc tekstu awersu (mm, ujemna = wklesly)</label>
            <input id="textDepth" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.textDepth}" />
          </div>

          <div class="field">
            <label for="fontSize">Rozmiar tekstu awersu (mm)</label>
            <input id="fontSize" type="number" min="4" max="22" step="0.5" value="${defaultConfig.fontSize}" />
          </div>

          <div class="field">
            <label class="field-inline">
              <input id="logoEnabled" type="checkbox" />
              <span>Dodaj logo SVG</span>
            </label>
          </div>

          <div class="field" id="logoFileWrap" style="display: none;">
            <label for="logoFile">Plik logo (SVG)</label>
            <input id="logoFile" type="file" accept=".svg,image/svg+xml" />
            <small id="logoStatus">Wybierz plik SVG dla awersu.</small>
          </div>

          <div class="grid-2" id="logoSettingsWrap" style="display: none;">
            <div class="field">
              <label for="logoSize">Rozmiar logo (mm)</label>
              <input id="logoSize" type="number" min="2" max="40" step="0.5" value="${defaultConfig.logoSize}" />
            </div>
            <div class="field">
              <label for="logoDepth">Glebokosc logo (mm, ujemna = wklesle)</label>
              <input id="logoDepth" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.logoDepth}" />
            </div>
          </div>
        </details>

        <details class="dice-faces-panel" id="tagBackPanel">
          <summary>Rewers (dol)</summary>

          <div class="field">
            <label for="backText">Napis</label>
            <textarea id="backText" rows="3" placeholder="Wpisz kilka linii tekstu">${defaultConfig.backText}</textarea>
          </div>

          <div class="field">
            <label for="backTextDepth">Glebokosc tekstu rewersu (mm, ujemna = wklesly)</label>
            <input id="backTextDepth" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.backTextDepth}" />
          </div>

          <div class="field">
            <label for="backFontSize">Rozmiar tekstu rewersu (mm)</label>
            <input id="backFontSize" type="number" min="4" max="22" step="0.5" value="${defaultConfig.backFontSize}" />
          </div>

          <div class="field">
            <label class="field-inline">
              <input id="backLogoEnabled" type="checkbox" />
              <span>Dodaj logo SVG</span>
            </label>
          </div>

          <div class="field" id="backLogoFileWrap" style="display: none;">
            <label for="backLogoFile">Plik logo (SVG)</label>
            <input id="backLogoFile" type="file" accept=".svg,image/svg+xml" />
            <small id="backLogoStatus">Wybierz plik SVG dla rewersu.</small>
          </div>

          <div class="grid-2" id="backLogoSettingsWrap" style="display: none;">
            <div class="field">
              <label for="backLogoSize">Rozmiar logo (mm)</label>
              <input id="backLogoSize" type="number" min="2" max="40" step="0.5" value="${defaultConfig.backLogoSize}" />
            </div>
            <div class="field">
              <label for="backLogoDepth">Glebokosc logo (mm, ujemna = wklesle)</label>
              <input id="backLogoDepth" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.backLogoDepth}" />
            </div>
          </div>
        </details>
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
              <span>Widoczny sze+�cian</span>
            </label>
            <label class="field-inline">
              <input id="diceShowText" type="checkbox" checked />
              <span>Widoczny tekst</span>
            </label>
          </div>
          <label class="field-inline">
            <input id="diceShowSphere" type="checkbox" />
            <span>Widoczna kula ograniczaj��ca</span>
          </label>
          <label class="field-inline">
            <input id="diceClipWithSphere" type="checkbox" />
            <span>Scinanie kula ograniczajaca</span>
          </label>
        </details>

        <details class="dice-faces-panel" id="diceFacesPanel">
          <summary>Sciany kostki (kliknij, aby rozwinac)</summary>

          <div class="grid-2">
            <label class="field-inline">
              <input id="diceSvgAutoSimplify" type="checkbox" checked />
              <span>Auto-upraszczanie SVG kostki</span>
            </label>
            <div class="field">
              <label for="diceSvgSimplifyStrength">Sila uproszczenia (1-5)</label>
              <input id="diceSvgSimplifyStrength" type="number" min="1" max="5" step="1" value="3" />
            </div>
          </div>

          <div class="field">
            <button id="simplifyDiceSvgBtn" type="button">Uprosc zaladowane SVG</button>
          </div>

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
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled1">
                  <input id="diceFaceTextEnabled1" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap1">
                <div class="face-option-row">
                  <label for="diceFace1">Napis sciany</label>
                  <input id="diceFace1" type="text" maxlength="10" value="${defaultConfig.diceFace1}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth1">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth1" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth1}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize1">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize1" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize1}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled1">
                  <input id="diceFaceLogoEnabled1" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap1">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile1">Plik logo SVG</label>
                  <input id="diceFaceLogoFile1" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize1">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize1" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize1}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth1">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth1" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth1}" />
                </div>
                <small id="diceFaceLogoStatus1">SVG: brak</small>
              </div>
            </div>
            <div class="field">
              <label for="diceFace2">Sciana 2 (-Z)</label>
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled2">
                  <input id="diceFaceTextEnabled2" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap2">
                <div class="face-option-row">
                  <label for="diceFace2">Napis sciany</label>
                  <input id="diceFace2" type="text" maxlength="10" value="${defaultConfig.diceFace2}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth2">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth2" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth2}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize2">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize2" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize2}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled2">
                  <input id="diceFaceLogoEnabled2" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap2">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile2">Plik logo SVG</label>
                  <input id="diceFaceLogoFile2" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize2">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize2" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize2}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth2">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth2" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth2}" />
                </div>
                <small id="diceFaceLogoStatus2">SVG: brak</small>
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="diceFace3">Sciana 3 (+X)</label>
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled3">
                  <input id="diceFaceTextEnabled3" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap3">
                <div class="face-option-row">
                  <label for="diceFace3">Napis sciany</label>
                  <input id="diceFace3" type="text" maxlength="10" value="${defaultConfig.diceFace3}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth3">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth3" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth3}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize3">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize3" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize3}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled3">
                  <input id="diceFaceLogoEnabled3" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap3">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile3">Plik logo SVG</label>
                  <input id="diceFaceLogoFile3" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize3">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize3" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize3}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth3">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth3" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth3}" />
                </div>
                <small id="diceFaceLogoStatus3">SVG: brak</small>
              </div>
            </div>
            <div class="field">
              <label for="diceFace4">Sciana 4 (-X)</label>
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled4">
                  <input id="diceFaceTextEnabled4" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap4">
                <div class="face-option-row">
                  <label for="diceFace4">Napis sciany</label>
                  <input id="diceFace4" type="text" maxlength="10" value="${defaultConfig.diceFace4}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth4">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth4" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth4}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize4">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize4" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize4}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled4">
                  <input id="diceFaceLogoEnabled4" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap4">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile4">Plik logo SVG</label>
                  <input id="diceFaceLogoFile4" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize4">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize4" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize4}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth4">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth4" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth4}" />
                </div>
                <small id="diceFaceLogoStatus4">SVG: brak</small>
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="diceFace5">Sciana 5 (+Y)</label>
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled5">
                  <input id="diceFaceTextEnabled5" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap5">
                <div class="face-option-row">
                  <label for="diceFace5">Napis sciany</label>
                  <input id="diceFace5" type="text" maxlength="10" value="${defaultConfig.diceFace5}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth5">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth5" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth5}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize5">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize5" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize5}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled5">
                  <input id="diceFaceLogoEnabled5" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap5">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile5">Plik logo SVG</label>
                  <input id="diceFaceLogoFile5" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize5">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize5" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize5}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth5">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth5" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth5}" />
                </div>
                <small id="diceFaceLogoStatus5">SVG: brak</small>
              </div>
            </div>
            <div class="field">
              <label for="diceFace6">Sciana 6 (-Y)</label>
              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceTextEnabled6">
                  <input id="diceFaceTextEnabled6" type="checkbox" checked />
                  <span>Wlacz tekst</span>
                </label>
              </div>
              <div id="diceFaceTextWrap6">
                <div class="face-option-row">
                  <label for="diceFace6">Napis sciany</label>
                  <input id="diceFace6" type="text" maxlength="10" value="${defaultConfig.diceFace6}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceDepth6">Glebokosc tekstu (mm)</label>
                  <input id="diceFaceDepth6" type="number" min="-20" max="20" step="0.1" value="${defaultConfig.diceFaceDepth6}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceFontSize6">Rozmiar czcionki (mm)</label>
                  <input id="diceFaceFontSize6" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceFontSize6}" />
                </div>
              </div>

              <div class="face-option-row face-option-toggle">
                <label class="field-inline" for="diceFaceLogoEnabled6">
                  <input id="diceFaceLogoEnabled6" type="checkbox" />
                  <span>Wlacz grafike SVG</span>
                </label>
              </div>
              <div id="diceFaceLogoWrap6">
                <div class="face-option-row">
                  <label for="diceFaceLogoFile6">Plik logo SVG</label>
                  <input id="diceFaceLogoFile6" type="file" accept=".svg,image/svg+xml" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize6">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize6" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize6}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth6">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth6" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth6}" />
                </div>
                <small id="diceFaceLogoStatus6">SVG: brak</small>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div class="actions">
        <button id="resetBtn" type="button">Reset</button>
        <button id="exportBtn" type="button" class="primary">Eksport STL</button>
      </div>
      <small id="exportStatus">Eksport: gotowy</small>

      <details class="preset-card">
        <summary>Presety lokalne</summary>
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
      </details>
    </aside>

    <div id="panelResizeHandle" class="panel-resize-handle" role="separator" aria-orientation="vertical" aria-label="Zmien szerokosc panelu"></div>

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
  panel: requiredElement<HTMLElement>('.panel'),
  panelResizeHandle: requiredElement<HTMLElement>('#panelResizeHandle'),
  modelType: requiredElement<HTMLSelectElement>('#modelType'),
  tagControls: requiredElement<HTMLDivElement>('#tagControls'),
  diceControls: requiredElement<HTMLDivElement>('#diceControls'),
  text: requiredElement<HTMLTextAreaElement>('#text'),
  backText: requiredElement<HTMLTextAreaElement>('#backText'),
  backTextDepth: requiredElement<HTMLInputElement>('#backTextDepth'),
  backFontSize: requiredElement<HTMLInputElement>('#backFontSize'),
  fontChoice: requiredElement<HTMLSelectElement>('#fontChoice'),
  customFontWrap: requiredElement<HTMLDivElement>('#customFontWrap'),
  customFontFile: requiredElement<HTMLInputElement>('#customFontFile'),
  fontStatus: requiredElement<HTMLElement>('#fontStatus'),
  logoEnabled: requiredElement<HTMLInputElement>('#logoEnabled'),
  logoFileWrap: requiredElement<HTMLDivElement>('#logoFileWrap'),
  logoFile: requiredElement<HTMLInputElement>('#logoFile'),
  logoStatus: requiredElement<HTMLElement>('#logoStatus'),
  logoSettingsWrap: requiredElement<HTMLDivElement>('#logoSettingsWrap'),
  logoSize: requiredElement<HTMLInputElement>('#logoSize'),
  logoDepth: requiredElement<HTMLInputElement>('#logoDepth'),
  backLogoEnabled: requiredElement<HTMLInputElement>('#backLogoEnabled'),
  backLogoFileWrap: requiredElement<HTMLDivElement>('#backLogoFileWrap'),
  backLogoFile: requiredElement<HTMLInputElement>('#backLogoFile'),
  backLogoStatus: requiredElement<HTMLElement>('#backLogoStatus'),
  backLogoSettingsWrap: requiredElement<HTMLDivElement>('#backLogoSettingsWrap'),
  backLogoSize: requiredElement<HTMLInputElement>('#backLogoSize'),
  backLogoDepth: requiredElement<HTMLInputElement>('#backLogoDepth'),
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
  diceClipWithSphere: requiredElement<HTMLInputElement>('#diceClipWithSphere'),
  diceShowCube: requiredElement<HTMLInputElement>('#diceShowCube'),
  diceShowText: requiredElement<HTMLInputElement>('#diceShowText'),
  diceShowSphere: requiredElement<HTMLInputElement>('#diceShowSphere'),
  diceSvgAutoSimplify: requiredElement<HTMLInputElement>('#diceSvgAutoSimplify'),
  diceSvgSimplifyStrength: requiredElement<HTMLInputElement>('#diceSvgSimplifyStrength'),
  simplifyDiceSvgBtn: requiredElement<HTMLButtonElement>('#simplifyDiceSvgBtn'),
  diceDepthAll: requiredElement<HTMLInputElement>('#diceDepthAll'),
  applyDiceDepthAllBtn: requiredElement<HTMLButtonElement>('#applyDiceDepthAllBtn'),
  diceFace1: requiredElement<HTMLInputElement>('#diceFace1'),
  diceFace2: requiredElement<HTMLInputElement>('#diceFace2'),
  diceFace3: requiredElement<HTMLInputElement>('#diceFace3'),
  diceFace4: requiredElement<HTMLInputElement>('#diceFace4'),
  diceFace5: requiredElement<HTMLInputElement>('#diceFace5'),
  diceFace6: requiredElement<HTMLInputElement>('#diceFace6'),
  diceFaceTextEnabled1: requiredElement<HTMLInputElement>('#diceFaceTextEnabled1'),
  diceFaceTextEnabled2: requiredElement<HTMLInputElement>('#diceFaceTextEnabled2'),
  diceFaceTextEnabled3: requiredElement<HTMLInputElement>('#diceFaceTextEnabled3'),
  diceFaceTextEnabled4: requiredElement<HTMLInputElement>('#diceFaceTextEnabled4'),
  diceFaceTextEnabled5: requiredElement<HTMLInputElement>('#diceFaceTextEnabled5'),
  diceFaceTextEnabled6: requiredElement<HTMLInputElement>('#diceFaceTextEnabled6'),
  diceFaceLogoEnabled1: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled1'),
  diceFaceLogoEnabled2: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled2'),
  diceFaceLogoEnabled3: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled3'),
  diceFaceLogoEnabled4: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled4'),
  diceFaceLogoEnabled5: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled5'),
  diceFaceLogoEnabled6: requiredElement<HTMLInputElement>('#diceFaceLogoEnabled6'),
  diceFaceTextWrap1: requiredElement<HTMLDivElement>('#diceFaceTextWrap1'),
  diceFaceTextWrap2: requiredElement<HTMLDivElement>('#diceFaceTextWrap2'),
  diceFaceTextWrap3: requiredElement<HTMLDivElement>('#diceFaceTextWrap3'),
  diceFaceTextWrap4: requiredElement<HTMLDivElement>('#diceFaceTextWrap4'),
  diceFaceTextWrap5: requiredElement<HTMLDivElement>('#diceFaceTextWrap5'),
  diceFaceTextWrap6: requiredElement<HTMLDivElement>('#diceFaceTextWrap6'),
  diceFaceLogoWrap1: requiredElement<HTMLDivElement>('#diceFaceLogoWrap1'),
  diceFaceLogoWrap2: requiredElement<HTMLDivElement>('#diceFaceLogoWrap2'),
  diceFaceLogoWrap3: requiredElement<HTMLDivElement>('#diceFaceLogoWrap3'),
  diceFaceLogoWrap4: requiredElement<HTMLDivElement>('#diceFaceLogoWrap4'),
  diceFaceLogoWrap5: requiredElement<HTMLDivElement>('#diceFaceLogoWrap5'),
  diceFaceLogoWrap6: requiredElement<HTMLDivElement>('#diceFaceLogoWrap6'),
  diceFaceDepth1: requiredElement<HTMLInputElement>('#diceFaceDepth1'),
  diceFaceDepth2: requiredElement<HTMLInputElement>('#diceFaceDepth2'),
  diceFaceDepth3: requiredElement<HTMLInputElement>('#diceFaceDepth3'),
  diceFaceDepth4: requiredElement<HTMLInputElement>('#diceFaceDepth4'),
  diceFaceDepth5: requiredElement<HTMLInputElement>('#diceFaceDepth5'),
  diceFaceDepth6: requiredElement<HTMLInputElement>('#diceFaceDepth6'),
  diceFaceFontSize1: requiredElement<HTMLInputElement>('#diceFaceFontSize1'),
  diceFaceFontSize2: requiredElement<HTMLInputElement>('#diceFaceFontSize2'),
  diceFaceFontSize3: requiredElement<HTMLInputElement>('#diceFaceFontSize3'),
  diceFaceFontSize4: requiredElement<HTMLInputElement>('#diceFaceFontSize4'),
  diceFaceFontSize5: requiredElement<HTMLInputElement>('#diceFaceFontSize5'),
  diceFaceFontSize6: requiredElement<HTMLInputElement>('#diceFaceFontSize6'),
  diceFaceLogoFile1: requiredElement<HTMLInputElement>('#diceFaceLogoFile1'),
  diceFaceLogoFile2: requiredElement<HTMLInputElement>('#diceFaceLogoFile2'),
  diceFaceLogoFile3: requiredElement<HTMLInputElement>('#diceFaceLogoFile3'),
  diceFaceLogoFile4: requiredElement<HTMLInputElement>('#diceFaceLogoFile4'),
  diceFaceLogoFile5: requiredElement<HTMLInputElement>('#diceFaceLogoFile5'),
  diceFaceLogoFile6: requiredElement<HTMLInputElement>('#diceFaceLogoFile6'),
  diceFaceLogoSize1: requiredElement<HTMLInputElement>('#diceFaceLogoSize1'),
  diceFaceLogoSize2: requiredElement<HTMLInputElement>('#diceFaceLogoSize2'),
  diceFaceLogoSize3: requiredElement<HTMLInputElement>('#diceFaceLogoSize3'),
  diceFaceLogoSize4: requiredElement<HTMLInputElement>('#diceFaceLogoSize4'),
  diceFaceLogoSize5: requiredElement<HTMLInputElement>('#diceFaceLogoSize5'),
  diceFaceLogoSize6: requiredElement<HTMLInputElement>('#diceFaceLogoSize6'),
  diceFaceLogoDepth1: requiredElement<HTMLInputElement>('#diceFaceLogoDepth1'),
  diceFaceLogoDepth2: requiredElement<HTMLInputElement>('#diceFaceLogoDepth2'),
  diceFaceLogoDepth3: requiredElement<HTMLInputElement>('#diceFaceLogoDepth3'),
  diceFaceLogoDepth4: requiredElement<HTMLInputElement>('#diceFaceLogoDepth4'),
  diceFaceLogoDepth5: requiredElement<HTMLInputElement>('#diceFaceLogoDepth5'),
  diceFaceLogoDepth6: requiredElement<HTMLInputElement>('#diceFaceLogoDepth6'),
  diceFaceLogoStatus1: requiredElement<HTMLElement>('#diceFaceLogoStatus1'),
  diceFaceLogoStatus2: requiredElement<HTMLElement>('#diceFaceLogoStatus2'),
  diceFaceLogoStatus3: requiredElement<HTMLElement>('#diceFaceLogoStatus3'),
  diceFaceLogoStatus4: requiredElement<HTMLElement>('#diceFaceLogoStatus4'),
  diceFaceLogoStatus5: requiredElement<HTMLElement>('#diceFaceLogoStatus5'),
  diceFaceLogoStatus6: requiredElement<HTMLElement>('#diceFaceLogoStatus6'),
  fontSize: requiredElement<HTMLInputElement>('#fontSize'),
  textDepth: requiredElement<HTMLInputElement>('#textDepth'),
  exportBtn: requiredElement<HTMLButtonElement>('#exportBtn'),
  exportStatus: requiredElement<HTMLElement>('#exportStatus'),
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

const detailMaterial = new THREE.MeshStandardMaterial({
  color: '#2f241b',
  metalness: 0.05,
  roughness: 0.7,
})

function createTableGridTexture(): THREE.CanvasTexture {
  const size = 1024
  const minorStep = 32
  const majorStep = 128

  const canvasElement = document.createElement('canvas')
  canvasElement.width = size
  canvasElement.height = size

  const context = canvasElement.getContext('2d')
  if (!context) {
    const fallbackTexture = new THREE.CanvasTexture(canvasElement)
    fallbackTexture.colorSpace = THREE.SRGBColorSpace
    return fallbackTexture
  }

  context.fillStyle = '#f0dcc2'
  context.fillRect(0, 0, size, size)

  context.strokeStyle = 'rgba(120, 90, 60, 0.16)'
  context.lineWidth = 1
  for (let i = 0; i <= size; i += minorStep) {
    context.beginPath()
    context.moveTo(i + 0.5, 0)
    context.lineTo(i + 0.5, size)
    context.stroke()

    context.beginPath()
    context.moveTo(0, i + 0.5)
    context.lineTo(size, i + 0.5)
    context.stroke()
  }

  context.strokeStyle = 'rgba(95, 68, 40, 0.28)'
  context.lineWidth = 1.5
  for (let i = 0; i <= size; i += majorStep) {
    context.beginPath()
    context.moveTo(i + 0.5, 0)
    context.lineTo(i + 0.5, size)
    context.stroke()

    context.beginPath()
    context.moveTo(0, i + 0.5)
    context.lineTo(size, i + 0.5)
    context.stroke()
  }

  const texture = new THREE.CanvasTexture(canvasElement)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5.5, 5.5)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const tableGridTexture = createTableGridTexture()

const shadowPlate = new THREE.Mesh(
  new THREE.CircleGeometry(140, 80),
  new THREE.MeshStandardMaterial({
    map: tableGridTexture,
    color: '#f7efe1',
    roughness: 0.9,
    metalness: 0,
  }),
)
shadowPlate.position.set(0, 0, -0.6)
scene.add(shadowPlate)

let activeTagObject: THREE.Object3D | null = null
let loadedFont: unknown | null = null
const fontLoader = new FontLoader()
const ttfLoader = new TTFLoader()
const svgLoader = new SVGLoader()
let fontLoadToken = 0
let frontLogoLoadToken = 0
let backLogoLoadToken = 0
let loadedLogoShapes: THREE.Shape[] = []
let loadedBackLogoShapes: THREE.Shape[] = []
let diceFaceLogoLoadToken1 = 0
let diceFaceLogoLoadToken2 = 0
let diceFaceLogoLoadToken3 = 0
let diceFaceLogoLoadToken4 = 0
let diceFaceLogoLoadToken5 = 0
let diceFaceLogoLoadToken6 = 0
let loadedDiceFaceLogoShapes1: THREE.Shape[] = []
let loadedDiceFaceLogoShapes2: THREE.Shape[] = []
let loadedDiceFaceLogoShapes3: THREE.Shape[] = []
let loadedDiceFaceLogoShapes4: THREE.Shape[] = []
let loadedDiceFaceLogoShapes5: THREE.Shape[] = []
let loadedDiceFaceLogoShapes6: THREE.Shape[] = []

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

  return lines.some((line) => line.trim().length > 0) ? lines.join('\n') : ''
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

function setLogoStatus(message: string, isError: boolean): void {
  controlsMap.logoStatus.textContent = message
  controlsMap.logoStatus.style.color = isError ? '#a03939' : ''
}

function setBackLogoStatus(message: string, isError: boolean): void {
  controlsMap.backLogoStatus.textContent = message
  controlsMap.backLogoStatus.style.color = isError ? '#a03939' : ''
}

function setExportStatus(message: string, isError: boolean): void {
  controlsMap.exportStatus.textContent = message
  controlsMap.exportStatus.style.color = isError ? '#a03939' : ''
}

function setDiceFaceLogoStatus(face: number, message: string, isError: boolean): void {
  const statusMap: Record<number, HTMLElement> = {
    1: controlsMap.diceFaceLogoStatus1,
    2: controlsMap.diceFaceLogoStatus2,
    3: controlsMap.diceFaceLogoStatus3,
    4: controlsMap.diceFaceLogoStatus4,
    5: controlsMap.diceFaceLogoStatus5,
    6: controlsMap.diceFaceLogoStatus6,
  }
  const target = statusMap[face]
  target.textContent = message
  target.style.color = isError ? '#a03939' : ''
}

function setDiceFaceLogoEnabled(face: number, enabled: boolean): void {
  const enabledMap: Record<number, HTMLInputElement> = {
    1: controlsMap.diceFaceLogoEnabled1,
    2: controlsMap.diceFaceLogoEnabled2,
    3: controlsMap.diceFaceLogoEnabled3,
    4: controlsMap.diceFaceLogoEnabled4,
    5: controlsMap.diceFaceLogoEnabled5,
    6: controlsMap.diceFaceLogoEnabled6,
  }
  enabledMap[face].checked = enabled
  updateDiceFaceOptionVisibility(face)
}

function getDiceFaceLogoShapes(face: number): THREE.Shape[] {
  if (face === 1) return loadedDiceFaceLogoShapes1
  if (face === 2) return loadedDiceFaceLogoShapes2
  if (face === 3) return loadedDiceFaceLogoShapes3
  if (face === 4) return loadedDiceFaceLogoShapes4
  if (face === 5) return loadedDiceFaceLogoShapes5
  return loadedDiceFaceLogoShapes6
}

function setDiceFaceLogoShapes(face: number, shapes: THREE.Shape[]): void {
  if (face === 1) loadedDiceFaceLogoShapes1 = shapes
  else if (face === 2) loadedDiceFaceLogoShapes2 = shapes
  else if (face === 3) loadedDiceFaceLogoShapes3 = shapes
  else if (face === 4) loadedDiceFaceLogoShapes4 = shapes
  else if (face === 5) loadedDiceFaceLogoShapes5 = shapes
  else loadedDiceFaceLogoShapes6 = shapes
}

function nextDiceFaceLogoToken(face: number): number {
  if (face === 1) return ++diceFaceLogoLoadToken1
  if (face === 2) return ++diceFaceLogoLoadToken2
  if (face === 3) return ++diceFaceLogoLoadToken3
  if (face === 4) return ++diceFaceLogoLoadToken4
  if (face === 5) return ++diceFaceLogoLoadToken5
  return ++diceFaceLogoLoadToken6
}

function isDiceFaceLogoTokenCurrent(face: number, token: number): boolean {
  if (face === 1) return token === diceFaceLogoLoadToken1
  if (face === 2) return token === diceFaceLogoLoadToken2
  if (face === 3) return token === diceFaceLogoLoadToken3
  if (face === 4) return token === diceFaceLogoLoadToken4
  if (face === 5) return token === diceFaceLogoLoadToken5
  return token === diceFaceLogoLoadToken6
}

function isBuiltinFontChoice(choice: FontChoice): choice is Exclude<FontChoice, 'custom'> {
  return choice !== 'custom'
}

function updateCustomFontVisibility(): void {
  const isCustom = controlsMap.fontChoice.value === 'custom'
  controlsMap.customFontWrap.style.display = isCustom ? '' : 'none'
}

function updateLogoControlsVisibility(): void {
  const enabled = controlsMap.logoEnabled.checked
  controlsMap.logoFileWrap.style.display = enabled ? '' : 'none'
  controlsMap.logoSettingsWrap.style.display = enabled ? '' : 'none'
}

function updateBackLogoControlsVisibility(): void {
  const enabled = controlsMap.backLogoEnabled.checked
  controlsMap.backLogoFileWrap.style.display = enabled ? '' : 'none'
  controlsMap.backLogoSettingsWrap.style.display = enabled ? '' : 'none'
}

function updateDiceFaceOptionVisibility(face: number): void {
  const textEnabledMap: Record<number, HTMLInputElement> = {
    1: controlsMap.diceFaceTextEnabled1,
    2: controlsMap.diceFaceTextEnabled2,
    3: controlsMap.diceFaceTextEnabled3,
    4: controlsMap.diceFaceTextEnabled4,
    5: controlsMap.diceFaceTextEnabled5,
    6: controlsMap.diceFaceTextEnabled6,
  }
  const logoEnabledMap: Record<number, HTMLInputElement> = {
    1: controlsMap.diceFaceLogoEnabled1,
    2: controlsMap.diceFaceLogoEnabled2,
    3: controlsMap.diceFaceLogoEnabled3,
    4: controlsMap.diceFaceLogoEnabled4,
    5: controlsMap.diceFaceLogoEnabled5,
    6: controlsMap.diceFaceLogoEnabled6,
  }
  const textWrapMap: Record<number, HTMLDivElement> = {
    1: controlsMap.diceFaceTextWrap1,
    2: controlsMap.diceFaceTextWrap2,
    3: controlsMap.diceFaceTextWrap3,
    4: controlsMap.diceFaceTextWrap4,
    5: controlsMap.diceFaceTextWrap5,
    6: controlsMap.diceFaceTextWrap6,
  }
  const logoWrapMap: Record<number, HTMLDivElement> = {
    1: controlsMap.diceFaceLogoWrap1,
    2: controlsMap.diceFaceLogoWrap2,
    3: controlsMap.diceFaceLogoWrap3,
    4: controlsMap.diceFaceLogoWrap4,
    5: controlsMap.diceFaceLogoWrap5,
    6: controlsMap.diceFaceLogoWrap6,
  }

  textWrapMap[face].style.display = textEnabledMap[face].checked ? '' : 'none'
  logoWrapMap[face].style.display = logoEnabledMap[face].checked ? '' : 'none'
}

function updateAllDiceFaceOptionVisibility(): void {
  updateDiceFaceOptionVisibility(1)
  updateDiceFaceOptionVisibility(2)
  updateDiceFaceOptionVisibility(3)
  updateDiceFaceOptionVisibility(4)
  updateDiceFaceOptionVisibility(5)
  updateDiceFaceOptionVisibility(6)
}

function updateModelControlsVisibility(): void {
  const modelType = controlsMap.modelType.value as ModelType
  const isDice = modelType === 'dice'
  controlsMap.tagControls.style.display = isDice ? 'none' : ''
  controlsMap.diceControls.style.display = isDice ? '' : 'none'
  shadowPlate.visible = !isDice
}

function applyPanelWidth(width: number): void {
  const clampedWidth = clamp(width, 300, 760)
  document.documentElement.style.setProperty('--panel-width', `${Math.round(clampedWidth)}px`)
}

function readPanelWidth(): number | null {
  try {
    const raw = localStorage.getItem(panelWidthStorageKey)
    if (!raw) {
      return null
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return clamp(parsed, 300, 760)
  } catch {
    return null
  }
}

function savePanelWidth(width: number): void {
  localStorage.setItem(panelWidthStorageKey, String(Math.round(clamp(width, 300, 760))))
}

function wirePanelResize(): void {
  const handle = controlsMap.panelResizeHandle

  handle.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 980) {
      return
    }

    event.preventDefault()
    const startX = event.clientX
    const startWidth = controlsMap.panel.getBoundingClientRect().width

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      applyPanelWidth(nextWidth)
      resizeRenderer()
    }

    const onPointerUp = (): void => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      const currentWidth = controlsMap.panel.getBoundingClientRect().width
      savePanelWidth(currentWidth)
      resizeRenderer()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  })
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
    const isTtf = file.name.toLowerCase().endsWith('.ttf')
    const font = isTtf
      ? fontLoader.parse(ttfLoader.parse(await file.arrayBuffer()) as never)
      : fontLoader.parse(JSON.parse(await file.text()) as never)
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
    setFontStatus('Niepoprawny plik fontu. Uzyj .ttf lub typeface.json.', true)
  }
}

function normalizeSvgShapes(shapes: THREE.Shape[], samplePoints = 28, flipY = false): THREE.Shape[] {
  const normalizedSamplePoints = clamp(Math.round(samplePoints), 8, 80)
  const sampled = shapes.map((shape) => ({
    outer: shape.getPoints(normalizedSamplePoints),
    holes: shape.holes.map((holePath) => holePath.getPoints(normalizedSamplePoints)),
  }))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  sampled.forEach((part) => {
    part.outer.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })

    part.holes.forEach((hole) => {
      hole.forEach((point) => {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      })
    })
  })

  const width = maxX - minX
  const height = maxY - minY
  const maxDim = Math.max(width, height)
  if (!Number.isFinite(maxDim) || maxDim <= 0.0001) {
    return []
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = 1 / maxDim

  return sampled.map((part) => {
    const normalizedOuter = part.outer.map((point) =>
      new THREE.Vector2(
        (point.x - centerX) * scale,
        ((point.y - centerY) * scale) * (flipY ? -1 : 1),
      ),
    )
    const normalizedShape = shapeFromPoints(normalizedOuter)

    part.holes.forEach((hole) => {
      const normalizedHole = hole.map((point) =>
        new THREE.Vector2(
          (point.x - centerX) * scale,
          ((point.y - centerY) * scale) * (flipY ? -1 : 1),
        ),
      )
      normalizedShape.holes.push(pathFromPoints(normalizedHole))
    })

    return normalizedShape
  })
}

function estimateSvgShapeComplexity(shapes: THREE.Shape[]): number {
  const samplePoints = 12
  let pointsCount = 0

  shapes.forEach((shape) => {
    pointsCount += shape.getPoints(samplePoints).length
    shape.holes.forEach((holePath) => {
      pointsCount += holePath.getPoints(samplePoints).length
    })
  })

  return pointsCount
}

function simplifyClosedPoints(points: THREE.Vector2[], targetCount: number): THREE.Vector2[] {
  if (points.length <= 3) {
    return points
  }

  const clampedTarget = clamp(Math.round(targetCount), 3, points.length)
  if (clampedTarget >= points.length) {
    return points
  }

  const stride = (points.length - 1) / (clampedTarget - 1)
  const simplified: THREE.Vector2[] = []

  for (let i = 0; i < clampedTarget; i += 1) {
    const sourceIndex = clamp(Math.round(i * stride), 0, points.length - 1)
    simplified.push(points[sourceIndex])
  }

  return simplified
}

function simplifyShapeSet(shapes: THREE.Shape[], strength: number): THREE.Shape[] {
  const clampedStrength = clamp(Math.round(strength), 1, 5)
  const samplePoints = clamp(26 - clampedStrength * 4, 8, 24)
  const keepRatio = clamp(0.9 - clampedStrength * 0.14, 0.2, 0.9)

  return shapes
    .map((shape) => {
      const outer = shape.getPoints(samplePoints)
      const simplifiedOuter = simplifyClosedPoints(outer, Math.max(6, outer.length * keepRatio))
      if (simplifiedOuter.length < 3) {
        return null
      }

      const simplifiedShape = shapeFromPoints(simplifiedOuter)

      shape.holes.forEach((holePath) => {
        const hole = holePath.getPoints(samplePoints)
        const simplifiedHole = simplifyClosedPoints(hole, Math.max(4, hole.length * keepRatio))
        if (simplifiedHole.length >= 3) {
          simplifiedShape.holes.push(pathFromPoints(simplifiedHole))
        }
      })

      return simplifiedShape
    })
    .filter((shape): shape is THREE.Shape => shape !== null)
}

function getDiceSvgSimplifyStrength(): number {
  const value = Number(controlsMap.diceSvgSimplifyStrength.value)
  if (!Number.isFinite(value)) {
    return 3
  }
  return clamp(Math.round(value), 1, 5)
}

function simplifyDiceFaceShapesForLoad(shapes: THREE.Shape[]): THREE.Shape[] {
  let simplified = shapes
  const strength = getDiceSvgSimplifyStrength()
  const complexityLimit = 1800

  if (!controlsMap.diceSvgAutoSimplify.checked) {
    return simplified
  }

  const maxPasses = 5
  for (let pass = 0; pass < maxPasses; pass += 1) {
    if (estimateSvgShapeComplexity(simplified) <= complexityLimit) {
      return simplified
    }
    simplified = simplifyShapeSet(simplified, clamp(strength + pass, 1, 5))
    if (simplified.length === 0) {
      return []
    }
  }

  return simplified
}

function simplifyAllLoadedDiceSvg(): void {
  const faceIds = [1, 2, 3, 4, 5, 6]
  let changedFaces = 0

  faceIds.forEach((face) => {
    const currentShapes = getDiceFaceLogoShapes(face)
    if (currentShapes.length === 0) {
      return
    }

    const beforeComplexity = estimateSvgShapeComplexity(currentShapes)
    const simplifiedShapes = simplifyDiceFaceShapesForLoad(currentShapes)
    if (simplifiedShapes.length === 0) {
      setDiceFaceLogoShapes(face, [])
      setDiceFaceLogoStatus(face, 'SVG usuniete po uproszczeniu (zbyt malo danych).', true)
      changedFaces += 1
      return
    }

    setDiceFaceLogoShapes(face, simplifiedShapes)
    const afterComplexity = estimateSvgShapeComplexity(simplifiedShapes)
    setDiceFaceLogoStatus(face, `SVG uproszczone: ${beforeComplexity} -> ${afterComplexity} pkt`, false)
    changedFaces += 1
  })

  if (changedFaces > 0) {
    saveLastState()
    rebuildTag()
  }
}

async function applyFrontLogoFromFile(file: File): Promise<void> {
  const token = ++frontLogoLoadToken
  setLogoStatus(`Ladowanie logo: ${file.name}`, false)

  try {
    const raw = await file.text()
    const parsed = svgLoader.parse(raw)
    const sourceShapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path))
    const normalizedShapes = normalizeSvgShapes(sourceShapes, 24)

    if (normalizedShapes.length === 0) {
      throw new Error('empty-svg')
    }

    if (token !== frontLogoLoadToken) {
      return
    }

    loadedLogoShapes = normalizedShapes
    controlsMap.logoEnabled.checked = true
    updateLogoControlsVisibility()
    setLogoStatus(`Logo zaladowane: ${file.name}`, false)
    rebuildTag()
  } catch {
    if (token !== frontLogoLoadToken) {
      return
    }
    loadedLogoShapes = []
    setLogoStatus('Niepoprawny plik SVG albo brak sciezek wektorowych.', true)
  }
}

async function applyBackLogoFromFile(file: File): Promise<void> {
  const token = ++backLogoLoadToken
  setBackLogoStatus(`Ladowanie logo: ${file.name}`, false)

  try {
    const raw = await file.text()
    const parsed = svgLoader.parse(raw)
    const sourceShapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path))
    const normalizedShapes = normalizeSvgShapes(sourceShapes, 24)

    if (normalizedShapes.length === 0) {
      throw new Error('empty-svg')
    }

    if (token !== backLogoLoadToken) {
      return
    }

    loadedBackLogoShapes = normalizedShapes
    controlsMap.backLogoEnabled.checked = true
    updateBackLogoControlsVisibility()
    setBackLogoStatus(`Logo zaladowane: ${file.name}`, false)
    rebuildTag()
  } catch {
    if (token !== backLogoLoadToken) {
      return
    }
    loadedBackLogoShapes = []
    setBackLogoStatus('Niepoprawny plik SVG albo brak sciezek wektorowych.', true)
  }
}

async function applyDiceFaceLogoFromFile(face: number, file: File): Promise<void> {
  const token = nextDiceFaceLogoToken(face)
  setDiceFaceLogoStatus(face, `Ladowanie logo: ${file.name}`, false)

  try {
    const raw = await file.text()
    const parsed = svgLoader.parse(raw)
    const sourceShapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path))
    const normalizedShapes = normalizeSvgShapes(sourceShapes, 40, true)

    if (normalizedShapes.length === 0) {
      throw new Error('empty-svg')
    }

    const simplifiedShapes = simplifyDiceFaceShapesForLoad(normalizedShapes)
    if (simplifiedShapes.length === 0) {
      throw new Error('empty-svg')
    }

    const complexityLimit = 2600
    if (estimateSvgShapeComplexity(simplifiedShapes) > complexityLimit) {
      throw new Error('svg-too-complex')
    }

    if (!isDiceFaceLogoTokenCurrent(face, token)) {
      return
    }

    setDiceFaceLogoShapes(face, simplifiedShapes)
    setDiceFaceLogoEnabled(face, true)
    setDiceFaceLogoStatus(face, `Logo zaladowane: ${file.name}`, false)
    rebuildTag()
  } catch (error) {
    if (!isDiceFaceLogoTokenCurrent(face, token)) {
      return
    }
    setDiceFaceLogoShapes(face, [])
    const message = error instanceof Error && error.message === 'svg-too-complex'
      ? 'SVG jest zbyt zlozony. Wlacz auto-upraszczanie lub kliknij "Uprosc zaladowane SVG".'
      : 'Niepoprawny plik SVG.'
    setDiceFaceLogoStatus(face, message, true)
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

function cloneScaledShape(shape: THREE.Shape, scale: number, samplePoints = 30): THREE.Shape {
  const pointCount = clamp(Math.round(samplePoints), 8, 80)
  const scaledOuter = shape.getPoints(pointCount).map((p) => new THREE.Vector2(p.x * scale, p.y * scale))
  const scaledShape = shapeFromPoints(scaledOuter)

  shape.holes.forEach((holePath) => {
    const scaledHole = holePath.getPoints(pointCount).map((p) => new THREE.Vector2(p.x * scale, p.y * scale))
    scaledShape.holes.push(pathFromPoints(scaledHole))
  })

  return scaledShape
}

function createLogoGeometries(shapes: THREE.Shape[], size: number, depth: number, curveSegments = 28): THREE.ExtrudeGeometry[] {
  if (shapes.length === 0) {
    return []
  }

  const extrudeDepth = clamp(Math.abs(depth), 0.2, 8)
  const scale = clamp(size, 2, 40)
  const shapeSamplePoints = clamp(Math.round(curveSegments * 1.5), 8, 80)

  return shapes.map((shape) => {
    const scaledShape = cloneScaledShape(shape, scale, shapeSamplePoints)
    const geometry = new THREE.ExtrudeGeometry(scaledShape, {
      depth: extrudeDepth,
      bevelEnabled: false,
      curveSegments,
    })
    geometry.computeVertexNormals()
    return geometry
  })
}

function createTagLogoObject(config: TagConfig): THREE.Object3D | null {
  if (!config.logoEnabled || loadedLogoShapes.length === 0 || config.logoDepth <= 0.001) {
    return null
  }

  const geometries = createLogoGeometries(loadedLogoShapes, config.logoSize, Math.abs(config.logoDepth))
  if (geometries.length === 0) {
    return null
  }

  const logoGroup = new THREE.Group()
    geometries.forEach((geometry) => {
      const mesh = new THREE.Mesh(geometry, detailMaterial)
    mesh.position.z = config.thickness - 0.05
    logoGroup.add(mesh)
  })

  return logoGroup
}

function createTagLogoCutters(config: TagConfig): THREE.Mesh[] {
  if (!config.logoEnabled || loadedLogoShapes.length === 0 || config.logoDepth >= -0.001) {
    return []
  }

  const seamOverlap = 0.2
  const cutterDepth = Math.abs(config.logoDepth) + seamOverlap
  const geometries = createLogoGeometries(loadedLogoShapes, config.logoSize, cutterDepth)

  return geometries.map((geometry) => {
    const cutter = new THREE.Mesh(geometry, baseMaterial)
    cutter.position.z = config.thickness - cutterDepth + seamOverlap * 0.5
    cutter.updateMatrix()
    return cutter
  })
}

function applyCuttersToTagMeshes(meshes: THREE.Mesh[], createCutters: () => THREE.Mesh[]): THREE.Mesh[] {
  return meshes.map((sourceMesh) => {
    const cutters = createCutters()
    if (cutters.length === 0) {
      return sourceMesh
    }

    try {
      let mergedCutter: THREE.Mesh = cutters[0]
      for (let i = 1; i < cutters.length; i += 1) {
        mergedCutter.updateMatrix()
        cutters[i].updateMatrix()
        const nextMerged = CSG.union(mergedCutter, cutters[i])
        nextMerged.material = baseMaterial

        mergedCutter.geometry.dispose()
        cutters[i].geometry.dispose()
        mergedCutter = nextMerged
      }

      sourceMesh.updateMatrix()
      mergedCutter.updateMatrix()

      const debossedMesh = CSG.subtract(sourceMesh, mergedCutter)
      debossedMesh.material = baseMaterial
      debossedMesh.geometry.computeVertexNormals()

      sourceMesh.geometry.dispose()
      mergedCutter.geometry.dispose()

      return debossedMesh
    } catch {
      cutters.forEach((cutter) => cutter.geometry.dispose())
      return sourceMesh
    }
  })
}

function applyDebossLogoToTagMeshes(meshes: THREE.Mesh[], config: TagConfig): THREE.Mesh[] {
  return applyCuttersToTagMeshes(meshes, () => createTagLogoCutters(config))
}

function createBackTextObject(config: TagConfig): THREE.Object3D | null {
  if (!loadedFont || config.backText.trim().length === 0 || config.backTextDepth <= 0.001) {
    return null
  }

  const sideConfig = { ...config, text: config.backText, fontSize: config.backFontSize }
  const textGeometries = createLaidOutTextGeometries(sideConfig, Math.abs(config.backTextDepth))
  if (textGeometries.length === 0) {
    return null
  }

  const backTextGroup = new THREE.Group()
    textGeometries.forEach((geometry) => {
      const lineMesh = new THREE.Mesh(geometry, detailMaterial)
    lineMesh.rotation.y = Math.PI
    // Keep the back emboss attached to the bottom face with a tiny overlap.
    lineMesh.position.z = 0.05
    backTextGroup.add(lineMesh)
  })

  return backTextGroup
}

function createBackTextCutters(config: TagConfig): THREE.Mesh[] {
  if (!loadedFont || config.backText.trim().length === 0 || config.backTextDepth >= -0.001) {
    return []
  }

  const seamOverlap = 0.2
  const cutterDepth = Math.abs(config.backTextDepth) + seamOverlap
  const sideConfig = { ...config, text: config.backText, fontSize: config.backFontSize }
  const textGeometries = createLaidOutTextGeometries(sideConfig, cutterDepth)

  return textGeometries.map((geometry) => {
    const cutterMesh = new THREE.Mesh(geometry, baseMaterial)
    cutterMesh.rotation.y = Math.PI
    // Position cutter so it enters the solid from the bottom by requested depth.
    cutterMesh.position.z = Math.abs(config.backTextDepth) - seamOverlap * 0.5
    cutterMesh.updateMatrix()
    return cutterMesh
  })
}

function applyDebossBackTextToTagMeshes(meshes: THREE.Mesh[], config: TagConfig): THREE.Mesh[] {
  return applyCuttersToTagMeshes(meshes, () => createBackTextCutters(config))
}

function createBackLogoObject(config: TagConfig): THREE.Object3D | null {
  if (!config.backLogoEnabled || loadedBackLogoShapes.length === 0 || config.backLogoDepth <= 0.001) {
    return null
  }

  const geometries = createLogoGeometries(loadedBackLogoShapes, config.backLogoSize, Math.abs(config.backLogoDepth))
  if (geometries.length === 0) {
    return null
  }

  const logoGroup = new THREE.Group()
  geometries.forEach((geometry) => {
      const mesh = new THREE.Mesh(geometry, detailMaterial)
    mesh.rotation.y = Math.PI
    // Keep the back emboss attached to the bottom face with a tiny overlap.
    mesh.position.z = 0.05
    logoGroup.add(mesh)
  })

  return logoGroup
}

function createBackLogoCutters(config: TagConfig): THREE.Mesh[] {
  if (!config.backLogoEnabled || loadedBackLogoShapes.length === 0 || config.backLogoDepth >= -0.001) {
    return []
  }

  const seamOverlap = 0.2
  const cutterDepth = Math.abs(config.backLogoDepth) + seamOverlap
  const geometries = createLogoGeometries(loadedBackLogoShapes, config.backLogoSize, cutterDepth)

  return geometries.map((geometry) => {
    const cutter = new THREE.Mesh(geometry, baseMaterial)
    cutter.rotation.y = Math.PI
    // Position cutter so it enters the solid from the bottom by requested depth.
    cutter.position.z = Math.abs(config.backLogoDepth) - seamOverlap * 0.5
    cutter.updateMatrix()
    return cutter
  })
}

function applyDebossBackLogoToTagMeshes(meshes: THREE.Mesh[], config: TagConfig): THREE.Mesh[] {
  return applyCuttersToTagMeshes(meshes, () => createBackLogoCutters(config))
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
  const backTextDepth = clamp(Number(controlsMap.backTextDepth.value), -20, 20)
  const maxCorner = Math.min(width, height) * 0.49
  const text = sanitizeTextInput(controlsMap.text.value)
  const backText = sanitizeTextInput(controlsMap.backText.value)
  const diceSize = clamp(Number(controlsMap.diceSize.value), 10, 60)
  const maxDiceRoundness = Math.max(0, diceSize * 0.18)
  const diceRoundness = clamp(Number(controlsMap.diceRoundness.value), 0, maxDiceRoundness)
  const diceSphereRadius = clamp(Number(controlsMap.diceSphereRadius.value), 0, 100)
  const diceClipWithSphere = controlsMap.diceClipWithSphere.checked
  const diceShowCube = controlsMap.diceShowCube.checked
  const diceShowText = controlsMap.diceShowText.checked
  const diceShowSphere = controlsMap.diceShowSphere.checked
  const diceFaceTextEnabled1 = controlsMap.diceFaceTextEnabled1.checked
  const diceFaceTextEnabled2 = controlsMap.diceFaceTextEnabled2.checked
  const diceFaceTextEnabled3 = controlsMap.diceFaceTextEnabled3.checked
  const diceFaceTextEnabled4 = controlsMap.diceFaceTextEnabled4.checked
  const diceFaceTextEnabled5 = controlsMap.diceFaceTextEnabled5.checked
  const diceFaceTextEnabled6 = controlsMap.diceFaceTextEnabled6.checked
  const diceFaceLogoEnabled1 = controlsMap.diceFaceLogoEnabled1.checked
  const diceFaceLogoEnabled2 = controlsMap.diceFaceLogoEnabled2.checked
  const diceFaceLogoEnabled3 = controlsMap.diceFaceLogoEnabled3.checked
  const diceFaceLogoEnabled4 = controlsMap.diceFaceLogoEnabled4.checked
  const diceFaceLogoEnabled5 = controlsMap.diceFaceLogoEnabled5.checked
  const diceFaceLogoEnabled6 = controlsMap.diceFaceLogoEnabled6.checked
  const diceFaceDepth1 = clamp(Number(controlsMap.diceFaceDepth1.value), -20, 20)
  const diceFaceDepth2 = clamp(Number(controlsMap.diceFaceDepth2.value), -20, 20)
  const diceFaceDepth3 = clamp(Number(controlsMap.diceFaceDepth3.value), -20, 20)
  const diceFaceDepth4 = clamp(Number(controlsMap.diceFaceDepth4.value), -20, 20)
  const diceFaceDepth5 = clamp(Number(controlsMap.diceFaceDepth5.value), -20, 20)
  const diceFaceDepth6 = clamp(Number(controlsMap.diceFaceDepth6.value), -20, 20)
  const diceFaceFontSize1 = clamp(Number(controlsMap.diceFaceFontSize1.value), 2, 20)
  const diceFaceFontSize2 = clamp(Number(controlsMap.diceFaceFontSize2.value), 2, 20)
  const diceFaceFontSize3 = clamp(Number(controlsMap.diceFaceFontSize3.value), 2, 20)
  const diceFaceFontSize4 = clamp(Number(controlsMap.diceFaceFontSize4.value), 2, 20)
  const diceFaceFontSize5 = clamp(Number(controlsMap.diceFaceFontSize5.value), 2, 20)
  const diceFaceFontSize6 = clamp(Number(controlsMap.diceFaceFontSize6.value), 2, 20)
  const diceFaceLogoSize1 = clamp(Number(controlsMap.diceFaceLogoSize1.value), 2, 20)
  const diceFaceLogoSize2 = clamp(Number(controlsMap.diceFaceLogoSize2.value), 2, 20)
  const diceFaceLogoSize3 = clamp(Number(controlsMap.diceFaceLogoSize3.value), 2, 20)
  const diceFaceLogoSize4 = clamp(Number(controlsMap.diceFaceLogoSize4.value), 2, 20)
  const diceFaceLogoSize5 = clamp(Number(controlsMap.diceFaceLogoSize5.value), 2, 20)
  const diceFaceLogoSize6 = clamp(Number(controlsMap.diceFaceLogoSize6.value), 2, 20)
  const diceFaceLogoDepth1 = clamp(Number(controlsMap.diceFaceLogoDepth1.value), -8, 8)
  const diceFaceLogoDepth2 = clamp(Number(controlsMap.diceFaceLogoDepth2.value), -8, 8)
  const diceFaceLogoDepth3 = clamp(Number(controlsMap.diceFaceLogoDepth3.value), -8, 8)
  const diceFaceLogoDepth4 = clamp(Number(controlsMap.diceFaceLogoDepth4.value), -8, 8)
  const diceFaceLogoDepth5 = clamp(Number(controlsMap.diceFaceLogoDepth5.value), -8, 8)
  const diceFaceLogoDepth6 = clamp(Number(controlsMap.diceFaceLogoDepth6.value), -8, 8)
  const logoEnabled = controlsMap.logoEnabled.checked
  const logoSize = clamp(Number(controlsMap.logoSize.value), 2, 40)
  const logoDepth = clamp(Number(controlsMap.logoDepth.value), -8, 8)
  const backLogoEnabled = controlsMap.backLogoEnabled.checked
  const backLogoSize = clamp(Number(controlsMap.backLogoSize.value), 2, 40)
  const backLogoDepth = clamp(Number(controlsMap.backLogoDepth.value), -8, 8)

  return {
    modelType,
    text,
    backText,
    shape,
    width,
    height,
    thickness,
    cornerRadius: clamp(Number(controlsMap.cornerRadius.value), 0, maxCorner),
    holeDiameter: clamp(Number(controlsMap.holeDiameter.value), 2, 12),
    holeMargin: clamp(Number(controlsMap.holeMargin.value), 2, 20),
    fontSize: clamp(Number(controlsMap.fontSize.value), 4, 22),
    backFontSize: clamp(Number(controlsMap.backFontSize.value), 4, 22),
    textDepth,
    backTextDepth,
    diceSize,
    diceRoundness,
    diceSphereRadius,
    diceClipWithSphere,
    diceShowCube,
    diceShowText,
    diceShowSphere,
    diceFaceTextEnabled1,
    diceFaceTextEnabled2,
    diceFaceTextEnabled3,
    diceFaceTextEnabled4,
    diceFaceTextEnabled5,
    diceFaceTextEnabled6,
    diceFaceLogoEnabled1,
    diceFaceLogoEnabled2,
    diceFaceLogoEnabled3,
    diceFaceLogoEnabled4,
    diceFaceLogoEnabled5,
    diceFaceLogoEnabled6,
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
    diceFaceFontSize1,
    diceFaceFontSize2,
    diceFaceFontSize3,
    diceFaceFontSize4,
    diceFaceFontSize5,
    diceFaceFontSize6,
    diceFaceLogoSize1,
    diceFaceLogoSize2,
    diceFaceLogoSize3,
    diceFaceLogoSize4,
    diceFaceLogoSize5,
    diceFaceLogoSize6,
    diceFaceLogoDepth1,
    diceFaceLogoDepth2,
    diceFaceLogoDepth3,
    diceFaceLogoDepth4,
    diceFaceLogoDepth5,
    diceFaceLogoDepth6,
    logoEnabled,
    logoSize,
    logoDepth,
    backLogoEnabled,
    backLogoSize,
    backLogoDepth,
  }
}

function applyConfigToForm(config: TagConfig): void {
  controlsMap.modelType.value = config.modelType
  controlsMap.text.value = config.text
  controlsMap.backText.value = config.backText
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
  controlsMap.diceClipWithSphere.checked = Boolean(config.diceClipWithSphere)
  controlsMap.diceShowCube.checked = Boolean(config.diceShowCube)
  controlsMap.diceShowText.checked = Boolean(config.diceShowText)
  controlsMap.diceShowSphere.checked = Boolean(config.diceShowSphere)
  controlsMap.diceFaceTextEnabled1.checked = Boolean(config.diceFaceTextEnabled1)
  controlsMap.diceFaceTextEnabled2.checked = Boolean(config.diceFaceTextEnabled2)
  controlsMap.diceFaceTextEnabled3.checked = Boolean(config.diceFaceTextEnabled3)
  controlsMap.diceFaceTextEnabled4.checked = Boolean(config.diceFaceTextEnabled4)
  controlsMap.diceFaceTextEnabled5.checked = Boolean(config.diceFaceTextEnabled5)
  controlsMap.diceFaceTextEnabled6.checked = Boolean(config.diceFaceTextEnabled6)
  controlsMap.diceFaceLogoEnabled1.checked = Boolean(config.diceFaceLogoEnabled1)
  controlsMap.diceFaceLogoEnabled2.checked = Boolean(config.diceFaceLogoEnabled2)
  controlsMap.diceFaceLogoEnabled3.checked = Boolean(config.diceFaceLogoEnabled3)
  controlsMap.diceFaceLogoEnabled4.checked = Boolean(config.diceFaceLogoEnabled4)
  controlsMap.diceFaceLogoEnabled5.checked = Boolean(config.diceFaceLogoEnabled5)
  controlsMap.diceFaceLogoEnabled6.checked = Boolean(config.diceFaceLogoEnabled6)
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
  controlsMap.diceFaceFontSize1.value = String(config.diceFaceFontSize1)
  controlsMap.diceFaceFontSize2.value = String(config.diceFaceFontSize2)
  controlsMap.diceFaceFontSize3.value = String(config.diceFaceFontSize3)
  controlsMap.diceFaceFontSize4.value = String(config.diceFaceFontSize4)
  controlsMap.diceFaceFontSize5.value = String(config.diceFaceFontSize5)
  controlsMap.diceFaceFontSize6.value = String(config.diceFaceFontSize6)
  controlsMap.diceFaceLogoSize1.value = String(config.diceFaceLogoSize1)
  controlsMap.diceFaceLogoSize2.value = String(config.diceFaceLogoSize2)
  controlsMap.diceFaceLogoSize3.value = String(config.diceFaceLogoSize3)
  controlsMap.diceFaceLogoSize4.value = String(config.diceFaceLogoSize4)
  controlsMap.diceFaceLogoSize5.value = String(config.diceFaceLogoSize5)
  controlsMap.diceFaceLogoSize6.value = String(config.diceFaceLogoSize6)
  controlsMap.diceFaceLogoDepth1.value = String(config.diceFaceLogoDepth1)
  controlsMap.diceFaceLogoDepth2.value = String(config.diceFaceLogoDepth2)
  controlsMap.diceFaceLogoDepth3.value = String(config.diceFaceLogoDepth3)
  controlsMap.diceFaceLogoDepth4.value = String(config.diceFaceLogoDepth4)
  controlsMap.diceFaceLogoDepth5.value = String(config.diceFaceLogoDepth5)
  controlsMap.diceFaceLogoDepth6.value = String(config.diceFaceLogoDepth6)
  controlsMap.diceDepthAll.value = String(config.diceFaceDepth1)
  controlsMap.fontSize.value = String(config.fontSize)
  controlsMap.backFontSize.value = String(config.backFontSize)
  controlsMap.textDepth.value = String(config.textDepth)
  controlsMap.backTextDepth.value = String(config.backTextDepth)
  controlsMap.logoEnabled.checked = Boolean(config.logoEnabled)
  controlsMap.logoSize.value = String(config.logoSize)
  controlsMap.logoDepth.value = String(config.logoDepth)
  controlsMap.backLogoEnabled.checked = Boolean(config.backLogoEnabled)
  controlsMap.backLogoSize.value = String(config.backLogoSize)
  controlsMap.backLogoDepth.value = String(config.backLogoDepth)
  updateAllDiceFaceOptionVisibility()
  updateModelControlsVisibility()
  updateLogoControlsVisibility()
  updateBackLogoControlsVisibility()
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
    } else if (previewRole === 'logo') {
      child.visible = true
    } else if (previewRole === 'sphere') {
      child.visible = config.diceShowSphere && config.diceSphereRadius > 0
    }
  })
}

function applySphereClippingToDice(
  baseMesh: THREE.Mesh,
  embossMeshes: THREE.Mesh[],
  radius: number,
): { baseMesh: THREE.Mesh; embossMeshes: THREE.Mesh[] } {
  if (radius <= 0) {
    return { baseMesh, embossMeshes }
  }

  const clipSphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), baseMaterial)
  clipSphere.updateMatrix()

  baseMesh.updateMatrix()
  const clippedBase = CSG.intersect(baseMesh, clipSphere)
  clippedBase.material = baseMaterial
  clippedBase.geometry.computeVertexNormals()
  baseMesh.geometry.dispose()
  let clippedBaseMesh: THREE.Mesh = clippedBase
  clippedBaseMesh.userData.previewRole = 'cube'

  clipSphere.geometry.dispose()

  return {
    baseMesh: clippedBaseMesh,
    embossMeshes,
  }
}

function computeGeometryVolume(geometry: THREE.BufferGeometry): number {
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

function isFiniteGeometry(geometry: THREE.BufferGeometry): boolean {
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

function isDiceSubtractResultStable(previousMesh: THREE.Mesh, candidateMesh: THREE.Mesh, diceSize: number): boolean {
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

function createDiceObject(config: TagConfig): THREE.Object3D {
  const size = config.diceSize
  const maxRoundness = size * 0.18
  const roundness = clamp(config.diceRoundness, 0, maxRoundness)
  const baseGeometry = new RoundedBoxGeometry(size, size, size, 4, roundness)
  baseGeometry.computeVertexNormals()
  let baseMesh: THREE.Mesh = new THREE.Mesh(baseGeometry, baseMaterial)
  baseMesh.userData.previewRole = 'cube'

  const faceDefs: Array<{
    face: number
    textEnabled: boolean
    logoEnabled: boolean
    text: string
    depth: number
    fontSize: number
    logoSize: number
    logoDepth: number
    normal: THREE.Vector3
    rotation: THREE.Euler
  }> = [
    { face: 1, textEnabled: config.diceFaceTextEnabled1, logoEnabled: config.diceFaceLogoEnabled1, text: config.diceFace1, depth: config.diceFaceDepth1, fontSize: config.diceFaceFontSize1, logoSize: config.diceFaceLogoSize1, logoDepth: config.diceFaceLogoDepth1, normal: new THREE.Vector3(0, 0, 1), rotation: new THREE.Euler(0, 0, 0) },
    { face: 2, textEnabled: config.diceFaceTextEnabled2, logoEnabled: config.diceFaceLogoEnabled2, text: config.diceFace2, depth: config.diceFaceDepth2, fontSize: config.diceFaceFontSize2, logoSize: config.diceFaceLogoSize2, logoDepth: config.diceFaceLogoDepth2, normal: new THREE.Vector3(0, 0, -1), rotation: new THREE.Euler(0, Math.PI, 0) },
    { face: 3, textEnabled: config.diceFaceTextEnabled3, logoEnabled: config.diceFaceLogoEnabled3, text: config.diceFace3, depth: config.diceFaceDepth3, fontSize: config.diceFaceFontSize3, logoSize: config.diceFaceLogoSize3, logoDepth: config.diceFaceLogoDepth3, normal: new THREE.Vector3(1, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) },
    { face: 4, textEnabled: config.diceFaceTextEnabled4, logoEnabled: config.diceFaceLogoEnabled4, text: config.diceFace4, depth: config.diceFaceDepth4, fontSize: config.diceFaceFontSize4, logoSize: config.diceFaceLogoSize4, logoDepth: config.diceFaceLogoDepth4, normal: new THREE.Vector3(-1, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) },
    { face: 5, textEnabled: config.diceFaceTextEnabled5, logoEnabled: config.diceFaceLogoEnabled5, text: config.diceFace5, depth: config.diceFaceDepth5, fontSize: config.diceFaceFontSize5, logoSize: config.diceFaceLogoSize5, logoDepth: config.diceFaceLogoDepth5, normal: new THREE.Vector3(0, 1, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0) },
    { face: 6, textEnabled: config.diceFaceTextEnabled6, logoEnabled: config.diceFaceLogoEnabled6, text: config.diceFace6, depth: config.diceFaceDepth6, fontSize: config.diceFaceFontSize6, logoSize: config.diceFaceLogoSize6, logoDepth: config.diceFaceLogoDepth6, normal: new THREE.Vector3(0, -1, 0), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI) },
  ]

  const availableTextArea = size * 0.62
  const embossMeshes: THREE.Mesh[] = []
  const cutters: THREE.Mesh[] = []
  const logoCutters: THREE.Mesh[] = []
  const seamOverlap = 0.2

  faceDefs.forEach((face) => {
    if (!face.textEnabled) {
      return
    }

    const faceDepth = clamp(face.depth, -20, 20)
    const absDepth = Math.abs(faceDepth)
    if (absDepth < 0.001) {
      return
    }

    const faceFontSize = clamp(face.fontSize, 2, availableTextArea)

    if (faceDepth > 0) {
      const geometry = createCenteredTextGeometry(face.text, faceFontSize, absDepth)
      if (!geometry) {
        return
      }

      const mesh = new THREE.Mesh(geometry, detailMaterial)
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

  faceDefs.forEach((face) => {
    if (!face.logoEnabled) {
      return
    }

    const faceLogoShapes = getDiceFaceLogoShapes(face.face)
    if (faceLogoShapes.length === 0) {
      return
    }

    const faceLogoDepth = clamp(face.logoDepth, -8, 8)
    if (Math.abs(faceLogoDepth) < 0.001) {
      return
    }

    const faceLogoSize = clamp(face.logoSize, 2, availableTextArea)

    if (faceLogoDepth > 0) {
      const logoGeometries = createLogoGeometries(faceLogoShapes, faceLogoSize, faceLogoDepth, 18)
      logoGeometries.forEach((logoGeometry) => {
        const mesh = new THREE.Mesh(logoGeometry, detailMaterial)
        mesh.userData.previewRole = 'logo'
        mesh.rotation.copy(face.rotation)
        mesh.position.copy(face.normal.clone().multiplyScalar(size / 2 - 0.02))
        embossMeshes.push(mesh)
      })
      return
    }

    const cutterDepth = Math.abs(faceLogoDepth) + seamOverlap
    const logoGeometries = createLogoGeometries(faceLogoShapes, faceLogoSize, cutterDepth, 28)
    if (logoGeometries.length === 0) {
      return
    }

    const facePosition = face.normal.clone().multiplyScalar(size / 2 - cutterDepth + seamOverlap * 0.5)
    const faceQuaternion = new THREE.Quaternion().setFromEuler(face.rotation)
    const transformMatrix = new THREE.Matrix4().compose(
      facePosition,
      faceQuaternion,
      new THREE.Vector3(1, 1, 1),
    )

    logoGeometries.forEach((logoGeometry) => {
      const transformedGeometry = logoGeometry.clone().applyMatrix4(transformMatrix)
      logoGeometry.dispose()

      const vertexCount = transformedGeometry.getAttribute('position')?.count ?? 0
      if (vertexCount > 25000) {
        transformedGeometry.dispose()
        return
      }

      const cutter = new THREE.Mesh(transformedGeometry, baseMaterial)
      cutter.updateMatrix()
      logoCutters.push(cutter)
    })
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

  if (logoCutters.length > 0) {
    let currentMesh: THREE.Mesh = baseMesh

    logoCutters.forEach((logoCutter) => {
      try {
        currentMesh.updateMatrix()
        logoCutter.updateMatrix()

        const candidateMesh = CSG.subtract(currentMesh, logoCutter)
        candidateMesh.material = baseMaterial
        candidateMesh.geometry.computeVertexNormals()

        if (!isDiceSubtractResultStable(currentMesh, candidateMesh, size)) {
          candidateMesh.geometry.dispose()
          return
        }

        if (currentMesh !== baseMesh) {
          currentMesh.geometry.dispose()
        }
        currentMesh = candidateMesh
      } catch {
        // Ignore invalid cutters to avoid breaking the entire dice mesh.
      } finally {
        logoCutter.geometry.dispose()
      }
    })

    if (currentMesh !== baseMesh) {
      baseMesh.geometry.dispose()
      baseMesh = currentMesh
    }
    baseMesh.userData.previewRole = 'cube'
  }

  let finalEmbossMeshes = embossMeshes
  if (config.diceClipWithSphere && config.diceSphereRadius > 0) {
    const clipped = applySphereClippingToDice(baseMesh, embossMeshes, config.diceSphereRadius)
    baseMesh = clipped.baseMesh
    finalEmbossMeshes = clipped.embossMeshes
  }

  const group = new THREE.Group()
  group.add(baseMesh)
  finalEmbossMeshes.forEach((mesh) => {
    if (!(mesh.userData as { previewRole?: string }).previewRole) {
      mesh.userData.previewRole = 'text'
    }
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
    const textMesh = new THREE.Mesh(textGeometries[0], detailMaterial)
    textMesh.position.z = config.thickness - 0.05
    return textMesh
  }

  const textGroup = new THREE.Group()
  textGeometries.forEach((geometry) => {
    const lineMesh = new THREE.Mesh(geometry, detailMaterial)
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

    const isThroughCut = Math.abs(config.textDepth) >= config.thickness - 0.0001
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
    let tagMeshes = createDebossMeshes(config)
    tagMeshes = applyDebossLogoToTagMeshes(tagMeshes, config)
    tagMeshes = applyDebossBackTextToTagMeshes(tagMeshes, config)
    tagMeshes = applyDebossBackLogoToTagMeshes(tagMeshes, config)
    tagMeshes.forEach((mesh) => modelGroup.add(mesh))
    const backTextMesh = createBackTextObject(config)
    if (backTextMesh) {
      modelGroup.add(backTextMesh)
    }
    const logoObject = createTagLogoObject(config)
    if (logoObject) {
      modelGroup.add(logoObject)
    }
    const backLogoObject = createBackLogoObject(config)
    if (backLogoObject) {
      modelGroup.add(backLogoObject)
    }
  } else {
    let tagBaseMeshes = [createBaseMesh(config)]
    tagBaseMeshes = applyDebossLogoToTagMeshes(tagBaseMeshes, config)
    tagBaseMeshes = applyDebossBackTextToTagMeshes(tagBaseMeshes, config)
    tagBaseMeshes = applyDebossBackLogoToTagMeshes(tagBaseMeshes, config)
    tagBaseMeshes.forEach((mesh) => modelGroup.add(mesh))
    const textMesh = createEmbossTextMesh(config)
    if (textMesh) {
      modelGroup.add(textMesh)
    }
    const backTextMesh = createBackTextObject(config)
    if (backTextMesh) {
      modelGroup.add(backTextMesh)
    }
    const logoObject = createTagLogoObject(config)
    if (logoObject) {
      modelGroup.add(logoObject)
    }
    const backLogoObject = createBackLogoObject(config)
    if (backLogoObject) {
      modelGroup.add(backLogoObject)
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

type IndexedTriangle = [number, number, number]

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function collectExportGeometries(object: THREE.Object3D): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []

  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    const previewRole = (child.userData as { previewRole?: string }).previewRole
    if (!mesh.isMesh || !mesh.visible || previewRole === 'sphere') {
      return
    }

    const worldGeometry = mesh.geometry.clone().toNonIndexed()
    worldGeometry.applyMatrix4(mesh.matrixWorld)

    Object.keys(worldGeometry.attributes).forEach((name) => {
      if (name !== 'position') {
        worldGeometry.deleteAttribute(name)
      }
    })

    geometries.push(worldGeometry)
  })

  return geometries
}

function readIndexedTriangles(geometry: THREE.BufferGeometry): IndexedTriangle[] {
  const index = geometry.getIndex()
  const position = geometry.getAttribute('position')
  if (!index || !position || index.count < 3) {
    return []
  }

  const triangles: IndexedTriangle[] = []
  for (let i = 0; i + 2 < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    if (a === b || b === c || a === c) {
      continue
    }
    triangles.push([a, b, c])
  }

  return triangles
}

function analyzeEdgeTopology(triangles: IndexedTriangle[]): {
  boundaryEdges: Set<string>
  boundaryVertices: Set<number>
  nonManifoldEdges: Set<string>
} {
  const edgeCounts = new Map<string, number>()

  triangles.forEach(([a, b, c]) => {
    const keys = [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]
    keys.forEach((key) => edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1))
  })

  const boundaryEdges = new Set<string>()
  const boundaryVertices = new Set<number>()
  const nonManifoldEdges = new Set<string>()

  edgeCounts.forEach((count, key) => {
    if (count === 1) {
      boundaryEdges.add(key)
      const [aRaw, bRaw] = key.split(':')
      boundaryVertices.add(Number(aRaw))
      boundaryVertices.add(Number(bRaw))
    } else if (count > 2) {
      nonManifoldEdges.add(key)
    }
  })

  return { boundaryEdges, boundaryVertices, nonManifoldEdges }
}

function extractBoundaryLoops(boundaryEdges: Set<string>): number[][] {
  const adjacency = new Map<number, Set<number>>()
  boundaryEdges.forEach((key) => {
    const [aRaw, bRaw] = key.split(':')
    const a = Number(aRaw)
    const b = Number(bRaw)
    if (!adjacency.has(a)) adjacency.set(a, new Set<number>())
    if (!adjacency.has(b)) adjacency.set(b, new Set<number>())
    adjacency.get(a)?.add(b)
    adjacency.get(b)?.add(a)
  })

  const visited = new Set<string>()
  const loops: number[][] = []

  boundaryEdges.forEach((startEdge) => {
    if (visited.has(startEdge)) {
      return
    }

    const [aRaw, bRaw] = startEdge.split(':')
    const startA = Number(aRaw)
    const startB = Number(bRaw)
    const loop = [startA, startB]
    visited.add(edgeKey(startA, startB))

    let previous = startA
    let current = startB
    let guard = 0

    while (guard < 20000) {
      guard += 1
      const neighbors = Array.from(adjacency.get(current) ?? [])
      if (neighbors.length === 0) {
        break
      }

      let next = neighbors.find((n) => n !== previous && !visited.has(edgeKey(current, n)))
      if (next === undefined) {
        next = neighbors.find((n) => n === startA)
      }
      if (next === undefined) {
        break
      }

      visited.add(edgeKey(current, next))

      if (next === startA) {
        if (loop.length >= 3) {
          loops.push(loop)
        }
        break
      }

      loop.push(next)
      previous = current
      current = next
    }
  })

  return loops
}

function capBoundaryLoopsInGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  const index = geometry.getIndex()
  if (!position || !index) {
    return geometry
  }

  const baseTriangles = readIndexedTriangles(geometry)
  const diagnostics = analyzeEdgeTopology(baseTriangles)
  if (diagnostics.boundaryEdges.size === 0) {
    return geometry
  }

  const loops = extractBoundaryLoops(diagnostics.boundaryEdges)
  if (loops.length === 0) {
    return geometry
  }

  const appendedTriangles: number[] = []
  const pa = new THREE.Vector3()
  const pb = new THREE.Vector3()
  const pc = new THREE.Vector3()

  loops.forEach((loop) => {
    const points3d = loop.map((vertexIndex) =>
      new THREE.Vector3(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex)),
    )
    if (points3d.length < 3) {
      return
    }

    const normal = new THREE.Vector3(0, 0, 0)
    for (let i = 0; i < points3d.length; i += 1) {
      const curr = points3d[i]
      const next = points3d[(i + 1) % points3d.length]
      normal.x += (curr.y - next.y) * (curr.z + next.z)
      normal.y += (curr.z - next.z) * (curr.x + next.x)
      normal.z += (curr.x - next.x) * (curr.y + next.y)
    }

    if (normal.lengthSq() < 1e-14) {
      return
    }
    normal.normalize()

    const seed = Math.abs(normal.z) < 0.95
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0)
    const tangent = new THREE.Vector3().crossVectors(seed, normal).normalize()
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize()

    const contour2d = points3d.map((p) => new THREE.Vector2(p.dot(tangent), p.dot(bitangent)))
    const faces = THREE.ShapeUtils.triangulateShape(contour2d, [])

    faces.forEach(([i0, i1, i2]) => {
      const a = loop[i0]
      let b = loop[i1]
      let c = loop[i2]
      if (a === b || b === c || a === c) {
        return
      }

      pa.set(position.getX(a), position.getY(a), position.getZ(a))
      pb.set(position.getX(b), position.getY(b), position.getZ(b))
      pc.set(position.getX(c), position.getY(c), position.getZ(c))

      const triNormal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa))
      if (triNormal.dot(normal) < 0) {
        const temp = b
        b = c
        c = temp
      }

      appendedTriangles.push(a, b, c)
    })
  })

  if (appendedTriangles.length === 0) {
    return geometry
  }

  const combinedIndices: number[] = []
  for (let i = 0; i < index.count; i += 1) {
    combinedIndices.push(index.getX(i))
  }
  combinedIndices.push(...appendedTriangles)

  const nextGeometry = geometry.clone()
  nextGeometry.setIndex(combinedIndices)
  nextGeometry.computeVertexNormals()
  return nextGeometry
}

function snapBoundaryVerticesToSurface(
  geometry: THREE.BufferGeometry,
  boundaryVertices: Set<number>,
  bvh: MeshBVH,
  maxSnapDistance: number,
): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!position) {
    return 0
  }

  let snappedCount = 0
  const point = new THREE.Vector3()

  boundaryVertices.forEach((vertexIndex) => {
    point.set(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex))
    const hit = bvh.closestPointToPoint(point, undefined, 1e-8, maxSnapDistance)
    if (!hit) {
      return
    }

    if (hit.distance <= 1e-8 || hit.distance > maxSnapDistance) {
      return
    }

    position.setXYZ(vertexIndex, hit.point.x, hit.point.y, hit.point.z)
    snappedCount += 1
  })

  if (snappedCount > 0) {
    position.needsUpdate = true
  }

  return snappedCount
}

interface ExportRepairStats {
  beforeBoundaryEdges: number
  beforeNonManifoldEdges: number
  afterBoundaryEdges: number
  afterNonManifoldEdges: number
  cappedLoops: number
}

function createWatertightExportGeometry(
  object: THREE.Object3D,
  aggressive = false,
): { geometry: THREE.BufferGeometry; stats: ExportRepairStats } | null {
  const sourceGeometries = collectExportGeometries(object)
  if (sourceGeometries.length === 0) {
    return null
  }

  const mergedGeometry = mergeGeometries(sourceGeometries, false)
  sourceGeometries.forEach((geometry) => geometry.dispose())

  if (!mergedGeometry) {
    return null
  }

  const baselineGeometry = mergeVertices(mergedGeometry, 0.000001)
  const baselineDiagnostics = analyzeEdgeTopology(readIndexedTriangles(baselineGeometry))
  baselineGeometry.dispose()

  let bestGeometry: THREE.BufferGeometry | null = null
  let bestScore = Infinity
  const weldTolerances = aggressive
    ? [0.00002, 0.00008, 0.0002, 0.0005, 0.001, 0.002, 0.004]
    : [0.00001, 0.00003, 0.00008, 0.0002, 0.0005, 0.001]

  weldTolerances.forEach((tolerance) => {
    let candidate = mergeVertices(mergedGeometry, tolerance)
    candidate.computeVertexNormals()

    const preTriangles = readIndexedTriangles(candidate)
    const preDiagnostics = analyzeEdgeTopology(preTriangles)
    const bvh = new MeshBVH(candidate, { maxLeafSize: 20 })
    const snapDistance = aggressive
      ? Math.max(tolerance * 8, 0.00008)
      : Math.max(tolerance * 4, 0.00005)
    const snappedCount = snapBoundaryVerticesToSurface(candidate, preDiagnostics.boundaryVertices, bvh, snapDistance)

    if (snappedCount > 0) {
      const weldedAfterSnap = mergeVertices(candidate, tolerance * (aggressive ? 2.2 : 1.5))
      candidate.dispose()
      candidate = weldedAfterSnap
      candidate.computeVertexNormals()
    }

    const diagnostics = analyzeEdgeTopology(readIndexedTriangles(candidate))
    const score = diagnostics.boundaryEdges.size + diagnostics.nonManifoldEdges.size * 4

    if (score < bestScore) {
      if (bestGeometry) {
        bestGeometry.dispose()
      }
      bestGeometry = candidate
      bestScore = score
    } else {
      candidate.dispose()
    }
  })

  mergedGeometry.dispose()

  if (!bestGeometry) {
    return null
  }

  const repairedGeometry = capBoundaryLoopsInGeometry(bestGeometry)
  const diagnosticsAfterCap = analyzeEdgeTopology(readIndexedTriangles(repairedGeometry))

  const finalGeometry = mergeVertices(repairedGeometry, aggressive ? 0.00008 : 0.00002)
  if (finalGeometry !== repairedGeometry) {
    repairedGeometry.dispose()
  }
  finalGeometry.computeVertexNormals()
  const finalDiagnostics = analyzeEdgeTopology(readIndexedTriangles(finalGeometry))

  return {
    geometry: finalGeometry,
    stats: {
      beforeBoundaryEdges: baselineDiagnostics.boundaryEdges.size,
      beforeNonManifoldEdges: baselineDiagnostics.nonManifoldEdges.size,
      afterBoundaryEdges: finalDiagnostics.boundaryEdges.size,
      afterNonManifoldEdges: finalDiagnostics.nonManifoldEdges.size,
      cappedLoops: diagnosticsAfterCap.boundaryEdges.size > 0
        ? Math.max(0, baselineDiagnostics.boundaryEdges.size - diagnosticsAfterCap.boundaryEdges.size)
        : baselineDiagnostics.boundaryEdges.size,
    },
  }
}

function hasDiceDeboss(config: TagConfig): boolean {
  if (config.modelType !== 'dice') {
    return false
  }

  const textDeboss = [
    config.diceFaceDepth1,
    config.diceFaceDepth2,
    config.diceFaceDepth3,
    config.diceFaceDepth4,
    config.diceFaceDepth5,
    config.diceFaceDepth6,
  ].some((value) => value < -0.001)

  const logoDeboss = (
    (config.diceFaceLogoEnabled1 && config.diceFaceLogoDepth1 < -0.001)
    || (config.diceFaceLogoEnabled2 && config.diceFaceLogoDepth2 < -0.001)
    || (config.diceFaceLogoEnabled3 && config.diceFaceLogoDepth3 < -0.001)
    || (config.diceFaceLogoEnabled4 && config.diceFaceLogoDepth4 < -0.001)
    || (config.diceFaceLogoEnabled5 && config.diceFaceLogoDepth5 < -0.001)
    || (config.diceFaceLogoEnabled6 && config.diceFaceLogoDepth6 < -0.001)
  )

  return textDeboss || logoDeboss
}

function downloadStl(): void {
  if (!activeTagObject) {
    return
  }

  const exporter = new STLExporter()
  const config = getConfigFromForm()

  activeTagObject.updateMatrixWorld(true)
  const repaired = createWatertightExportGeometry(activeTagObject)
  if (!repaired) {
    setExportStatus('Eksport STL: brak geometrii do zapisu.', true)
    return
  }

  const baseScore = repaired.stats.afterBoundaryEdges + repaired.stats.afterNonManifoldEdges * 4
  const baseOpen = repaired.stats.afterBoundaryEdges > 0 || repaired.stats.afterNonManifoldEdges > 0

  let selected = repaired
  let usedAggressiveFallback = false

  if (baseOpen && hasDiceDeboss(config)) {
    const aggressive = createWatertightExportGeometry(activeTagObject, true)
    if (aggressive) {
      const aggressiveScore = aggressive.stats.afterBoundaryEdges + aggressive.stats.afterNonManifoldEdges * 4
      if (aggressiveScore < baseScore) {
        repaired.geometry.dispose()
        selected = aggressive
        usedAggressiveFallback = true
      } else {
        aggressive.geometry.dispose()
      }
    }
  }

  const { geometry: exportGeometry, stats } = selected

  const exportMesh = new THREE.Mesh(exportGeometry, baseMaterial)
  const data = exporter.parse(exportMesh, { binary: true }) as DataView
  exportGeometry.dispose()

  const binaryStl = new Uint8Array(data.byteLength)
  binaryStl.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))

  const blob = new Blob([binaryStl], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${config.text.toLowerCase().replace(/\s+/g, '-') || 'tag'}.stl`
  link.click()
  URL.revokeObjectURL(url)

  const stillOpen = stats.afterBoundaryEdges > 0 || stats.afterNonManifoldEdges > 0
  setExportStatus(
    `Eksport STL${usedAggressiveFallback ? ' (fallback: agresywny)' : ''}: boundary ${stats.beforeBoundaryEdges} -> ${stats.afterBoundaryEdges}, non-manifold ${stats.beforeNonManifoldEdges} -> ${stats.afterNonManifoldEdges}`,
    stillOpen,
  )
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
    controlsMap.backText,
    controlsMap.backFontSize,
    controlsMap.backTextDepth,
    controlsMap.logoEnabled,
    controlsMap.logoSize,
    controlsMap.logoDepth,
    controlsMap.backLogoEnabled,
    controlsMap.backLogoSize,
    controlsMap.backLogoDepth,
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
    controlsMap.diceClipWithSphere,
    controlsMap.diceShowCube,
    controlsMap.diceShowText,
    controlsMap.diceShowSphere,
    controlsMap.diceFaceTextEnabled1,
    controlsMap.diceFaceTextEnabled2,
    controlsMap.diceFaceTextEnabled3,
    controlsMap.diceFaceTextEnabled4,
    controlsMap.diceFaceTextEnabled5,
    controlsMap.diceFaceTextEnabled6,
    controlsMap.diceFaceLogoEnabled1,
    controlsMap.diceFaceLogoEnabled2,
    controlsMap.diceFaceLogoEnabled3,
    controlsMap.diceFaceLogoEnabled4,
    controlsMap.diceFaceLogoEnabled5,
    controlsMap.diceFaceLogoEnabled6,
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
    controlsMap.diceFaceFontSize1,
    controlsMap.diceFaceFontSize2,
    controlsMap.diceFaceFontSize3,
    controlsMap.diceFaceFontSize4,
    controlsMap.diceFaceFontSize5,
    controlsMap.diceFaceFontSize6,
    controlsMap.diceFaceLogoSize1,
    controlsMap.diceFaceLogoSize2,
    controlsMap.diceFaceLogoSize3,
    controlsMap.diceFaceLogoSize4,
    controlsMap.diceFaceLogoSize5,
    controlsMap.diceFaceLogoSize6,
    controlsMap.diceFaceLogoDepth1,
    controlsMap.diceFaceLogoDepth2,
    controlsMap.diceFaceLogoDepth3,
    controlsMap.diceFaceLogoDepth4,
    controlsMap.diceFaceLogoDepth5,
    controlsMap.diceFaceLogoDepth6,
    controlsMap.diceDepthAll,
    controlsMap.fontSize,
    controlsMap.textDepth,
  ]

  let rebuildTimer: number | null = null
  const queueRebuild = (eventType: 'input' | 'change' = 'change'): void => {
    const isDiceMode = controlsMap.modelType.value === 'dice'
    // Dice updates are intentionally deferred until change/blur to avoid freezes while typing.
    if (isDiceMode && eventType === 'input') {
      return
    }

    if (rebuildTimer !== null) {
      window.clearTimeout(rebuildTimer)
    }

    const rebuildDelay = isDiceMode ? 60 : 90
    rebuildTimer = window.setTimeout(() => {
      saveLastState()
      rebuildTag()
    }, rebuildDelay)
  }

  updateInputs.forEach((el) => el.addEventListener('input', () => queueRebuild('input')))
  updateInputs.forEach((el) => el.addEventListener('change', () => queueRebuild('change')))

  controlsMap.modelType.addEventListener('change', () => {
    updateModelControlsVisibility()
  })

  controlsMap.diceFaceTextEnabled1.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(1)
    queueRebuild('change')
  })
  controlsMap.diceFaceTextEnabled2.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(2)
    queueRebuild('change')
  })
  controlsMap.diceFaceTextEnabled3.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(3)
    queueRebuild('change')
  })
  controlsMap.diceFaceTextEnabled4.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(4)
    queueRebuild('change')
  })
  controlsMap.diceFaceTextEnabled5.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(5)
    queueRebuild('change')
  })
  controlsMap.diceFaceTextEnabled6.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(6)
    queueRebuild('change')
  })

  controlsMap.diceFaceLogoEnabled1.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(1)
    queueRebuild('change')
  })
  controlsMap.diceFaceLogoEnabled2.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(2)
    queueRebuild('change')
  })
  controlsMap.diceFaceLogoEnabled3.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(3)
    queueRebuild('change')
  })
  controlsMap.diceFaceLogoEnabled4.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(4)
    queueRebuild('change')
  })
  controlsMap.diceFaceLogoEnabled5.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(5)
    queueRebuild('change')
  })
  controlsMap.diceFaceLogoEnabled6.addEventListener('change', () => {
    updateDiceFaceOptionVisibility(6)
    queueRebuild('change')
  })

  controlsMap.logoEnabled.addEventListener('change', () => {
    updateLogoControlsVisibility()
    queueRebuild()
  })

  controlsMap.backLogoEnabled.addEventListener('change', () => {
    updateBackLogoControlsVisibility()
    queueRebuild()
  })

  controlsMap.logoFile.addEventListener('change', () => {
    const file = controlsMap.logoFile.files?.[0]
    if (!file) {
      return
    }
    void applyFrontLogoFromFile(file)
  })

  controlsMap.backLogoFile.addEventListener('change', () => {
    const file = controlsMap.backLogoFile.files?.[0]
    if (!file) {
      return
    }
    void applyBackLogoFromFile(file)
  })

  controlsMap.diceFaceLogoFile1.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile1.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(1, file)
  })

  controlsMap.diceFaceLogoFile2.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile2.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(2, file)
  })

  controlsMap.diceFaceLogoFile3.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile3.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(3, file)
  })

  controlsMap.diceFaceLogoFile4.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile4.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(4, file)
  })

  controlsMap.diceFaceLogoFile5.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile5.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(5, file)
  })

  controlsMap.diceFaceLogoFile6.addEventListener('change', () => {
    const file = controlsMap.diceFaceLogoFile6.files?.[0]
    if (!file) {
      return
    }
    void applyDiceFaceLogoFromFile(6, file)
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

  controlsMap.simplifyDiceSvgBtn.addEventListener('click', () => {
    simplifyAllLoadedDiceSvg()
  })

  controlsMap.fontChoice.addEventListener('change', () => {
    const choice = controlsMap.fontChoice.value as FontChoice
    updateCustomFontVisibility()
    if (isBuiltinFontChoice(choice)) {
      saveLastState()
      void applyBuiltinFont(choice)
    } else {
      setFontStatus('Wybierz plik .ttf lub typeface.json.', false)
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
  const savedPanelWidth = readPanelWidth()
  if (savedPanelWidth !== null) {
    applyPanelWidth(savedPanelWidth)
  }

  const persistedState = readLastState()
  const initialConfig = persistedState ? persistedState.config : defaultConfig
  applyConfigToForm(initialConfig)
  if (persistedState) {
    controlsMap.fontChoice.value = persistedState.fontChoice
  }

  wirePanelResize()
  refreshPresetSelect()
  wireEvents()
  resizeRenderer()
  animate()
  updateModelControlsVisibility()
  updateCustomFontVisibility()
  updateLogoControlsVisibility()
  updateBackLogoControlsVisibility()
  const initialFontChoice = controlsMap.fontChoice.value as FontChoice
  const fontToLoad = isBuiltinFontChoice(initialFontChoice) ? initialFontChoice : defaultFontChoice
  void applyBuiltinFont(fontToLoad)
}

start()

