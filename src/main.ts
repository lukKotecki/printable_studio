
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CSG } from 'three-csg-ts'
import {
  builtinFontUrls,
  defaultConfig,
  defaultFontChoice,
  defaultLanguage,
  languageStorageKey,
  lastStateStorageKey,
  maxCharsPerLine,
  maxTextLines,
  panelWidthStorageKey,
  polishGlyphFallback,
  presetsStorageKey,
  textLineSpacingFactor,
  type FontChoice,
  type LanguageCode,
  type ModelType,
  type TagShape,
  type PersistedAppState,
  type TagConfig,
} from './config/app-config'
import { isDiceSubtractResultStable } from './models/dice-analysis'
import {
  createBaseMesh as createTagPuzzleBaseMesh,
  createBaseShape as createTagPuzzleBaseShape,
} from './models/tag-puzzle'
import {
  loadLocale as loadLocaleXml,
  setAttr as setTranslatedAttr,
  setNthText as setTranslatedNthText,
  setText as setTranslatedText,
  translate,
} from './i18n/locale'
import {
  readLastState as readLastStateFromStorage,
  readPanelWidth as readPanelWidthFromStorage,
  readPresets as readPresetsFromStorage,
  readSavedLanguage as readSavedLanguageFromStorage,
  saveLanguage as saveLanguageToStorage,
  saveLastState as saveLastStateToStorage,
  savePanelWidth as savePanelWidthToStorage,
  writePresets as writePresetsToStorage,
} from './storage/local-storage'
import { attachDiceFaceToggleHandlers, attachRebuildListeners } from './ui/events'
import { requiredElement } from './utils/dom'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Missing app root')
}

app.innerHTML = `

  <main class="layout">
    <aside class="panel">
      <div class="panel-header">
        <div>
          <h1>Printable Studio</h1>
          <p class="subtitle">Lokalny generator tagow 3D z eksportem STL.</p>
        </div>
        <label class="language-switch" for="languageSelect">
          <span class="visually-hidden">Language</span>
          <select id="languageSelect" aria-label="Language">
            <option value="pl">PL</option>
            <option value="en">EN</option>
          </select>
        </label>
      </div>

      <div class="field">
        <label for="modelType">Typ modelu</label>
        <select id="modelType">
          <option value="tag">Plaski tag</option>
          <option value="puzzle">Puzzle (beta)</option>
          <option value="dice">Kostka K6 (beta)</option>
        </select>
      </div>

      <div class="actions">
        <button id="resetBtn" type="button">Reset</button>
        <button id="exportBtn" type="button" class="primary">Eksport STL</button>
      </div>

      <details class="dice-faces-panel" id="diceParamsPanel">
        <summary>Parametry kosci</summary>

        <div id="diceParamsOnlyWrap" style="display: none;">
          <div class="grid-2">
            <div class="field" id="fontChoiceDiceWrap">
              <label for="fontChoiceDice">Font</label>
              <select id="fontChoiceDice">
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

            <div class="field">
              <label for="diceSphereRadius">Promien kuli podgladu (mm)</label>
              <input id="diceSphereRadius" type="number" min="0" max="100" step="0.1" value="${defaultConfig.diceSphereRadius}" />
            </div>
          </div>
        </div>

        <div id="diceDimensionsWrap" style="display: none;">
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

          <div class="grid-2">
            <div class="field">
              <label for="diceSideHoleDiameter">Srednica bocznego otworu na wylot (mm, 0 = brak)</label>
              <input id="diceSideHoleDiameter" type="number" min="0" max="40" step="0.5" value="${defaultConfig.diceSideHoleDiameter}" />
            </div>
            <div class="field">
              <label class="field-inline" for="textBold">
                <input id="textBold" type="checkbox" ${defaultConfig.textBold ? 'checked' : ''} />
                <span>Pogrubienie tekstu</span>
              </label>
            </div>
          </div>
        </div>
      </details>

      <div id="tagControls">
        <details class="dice-faces-panel" id="tagBasePanel">
          <summary>Parametry tagu</summary>

          <div class="field" id="fontChoiceWrap">
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

          <div class="field">
            <label for="shape">Ksztalt</label>
            <select id="shape">
              <option value="rounded">Zaokraglony prostokat</option>
              <option value="capsule">Kapsula</option>
              <option value="circle">Kolo</option>
              <option value="puzzle">Puzzle</option>
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

          <div class="grid-2" id="holeSettingsWrap">
            <div class="field">
              <label for="holeDiameter">Srednica otworu (mm)</label>
              <input id="holeDiameter" type="number" min="2" max="12" step="0.5" value="${defaultConfig.holeDiameter}" />
            </div>
            <div class="field">
              <label for="holeMargin">Margines otworu (mm)</label>
              <input id="holeMargin" type="number" min="2" max="20" step="0.5" value="${defaultConfig.holeMargin}" />
            </div>
            <div class="field">
              <label for="holeOffsetX">Przesuniecie otworu X (mm)</label>
              <input id="holeOffsetX" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.holeOffsetX}" />
            </div>
            <div class="field">
              <label for="holeOffsetY">Przesuniecie otworu Y (mm)</label>
              <input id="holeOffsetY" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.holeOffsetY}" />
            </div>
          </div>
        </details>

        <details class="dice-faces-panel" id="tagFrontPanel">
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
            <label for="logoFile">Plik logo (SVG lub PNG)</label>
            <input id="logoFile" type="file" accept=".svg,.png,image/svg+xml,image/png" />
            <small id="logoStatus">Wybierz plik SVG lub PNG dla awersu.</small>
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
            <div class="field">
              <label for="logoOffsetX">Przesuniecie logo X (mm)</label>
              <input id="logoOffsetX" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.logoOffsetX}" />
            </div>
            <div class="field">
              <label for="logoOffsetY">Przesuniecie logo Y (mm)</label>
              <input id="logoOffsetY" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.logoOffsetY}" />
            </div>
            <div class="field">
              <label for="logoRotation">Obrot logo (stopnie)</label>
              <input id="logoRotation" type="number" min="-180" max="180" step="1" value="${defaultConfig.logoRotation}" />
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
            <label for="backLogoFile">Plik logo (SVG lub PNG)</label>
            <input id="backLogoFile" type="file" accept=".svg,.png,image/svg+xml,image/png" />
            <small id="backLogoStatus">Wybierz plik SVG lub PNG dla rewersu.</small>
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
            <div class="field">
              <label for="backLogoOffsetX">Przesuniecie logo X (mm)</label>
              <input id="backLogoOffsetX" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.backLogoOffsetX}" />
            </div>
            <div class="field">
              <label for="backLogoOffsetY">Przesuniecie logo Y (mm)</label>
              <input id="backLogoOffsetY" type="number" min="-60" max="60" step="0.5" value="${defaultConfig.backLogoOffsetY}" />
            </div>
            <div class="field">
              <label for="backLogoRotation">Obrot logo (stopnie)</label>
              <input id="backLogoRotation" type="number" min="-180" max="180" step="1" value="${defaultConfig.backLogoRotation}" />
            </div>
          </div>
        </details>
      </div>

      <div id="diceControls" style="display: none;">

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
            <div class="field" id="diceFaceField1">
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
                  <textarea id="diceFace1" rows="2" maxlength="21">${defaultConfig.diceFace1}</textarea>
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
                  <label for="diceFaceLogoFile1">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile1" type="file" accept=".svg,.png,image/svg+xml,image/png" />
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
            <div class="field" id="diceFaceField2">
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
                  <textarea id="diceFace2" rows="2" maxlength="21">${defaultConfig.diceFace2}</textarea>
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
                  <label for="diceFaceLogoFile2">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile2" type="file" accept=".svg,.png,image/svg+xml,image/png" />
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
            <div class="field" id="diceFaceField3">
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
                  <textarea id="diceFace3" rows="2" maxlength="21">${defaultConfig.diceFace3}</textarea>
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
                  <label for="diceFaceLogoFile3">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile3" type="file" accept=".svg,.png,image/svg+xml,image/png" />
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
            <div class="field" id="diceFaceField4">
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
                  <textarea id="diceFace4" rows="2" maxlength="21">${defaultConfig.diceFace4}</textarea>
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
                  <label for="diceFaceLogoFile4">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile4" type="file" accept=".svg,.png,image/svg+xml,image/png" />
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
            <div class="field" id="diceFaceField5">
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
                  <textarea id="diceFace5" rows="2" maxlength="21">${defaultConfig.diceFace5}</textarea>
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
                  <label for="diceFaceLogoFile5">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile5" type="file" accept=".svg,.png,image/svg+xml,image/png" />
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
            <div class="field" id="diceFaceField6">
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
                  <textarea id="diceFace6" rows="2" maxlength="21">${defaultConfig.diceFace6}</textarea>
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
                  <label for="diceFaceLogoFile6">Plik logo SVG/PNG</label>
                  <input id="diceFaceLogoFile6" type="file" accept=".svg,.png,image/svg+xml,image/png" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoSize6">Rozmiar logo (mm)</label>
                  <input id="diceFaceLogoSize6" type="number" min="2" max="20" step="0.5" value="${defaultConfig.diceFaceLogoSize6}" />
                </div>
                <div class="face-option-row">
                  <label for="diceFaceLogoDepth6">Glebokosc logo (mm)</label>
                  <input id="diceFaceLogoDepth6" type="number" min="-8" max="8" step="0.1" value="${defaultConfig.diceFaceLogoDepth6}" />
                </div>
                <small id="diceFaceLogoStatus6">Logo: brak</small>
              </div>
            </div>
          </div>
        </details>
      </div>

      <details class="preset-card" id="advancedPanel">
        <summary>Zaawansowane</summary>

        <div id="advancedDicePreviewWrap">
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
          <label class="field-inline">
            <input id="diceClipWithSphere" type="checkbox" />
            <span>Scinanie kula ograniczajaca</span>
          </label>
        </div>

        <div id="diceSvgAdvancedWrap">
          <h3 id="diceSvgAdvancedTitle">Uproszczanie SVG</h3>
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
        </div>

        <div class="advanced-presets">
          <h3 id="advancedPresetsTitle">Presety lokalne</h3>
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
  diceParamsPanel: requiredElement<HTMLDetailsElement>('#diceParamsPanel'),
  diceParamsOnlyWrap: requiredElement<HTMLDivElement>('#diceParamsOnlyWrap'),
  diceDimensionsWrap: requiredElement<HTMLDivElement>('#diceDimensionsWrap'),
  advancedDicePreviewWrap: requiredElement<HTMLDivElement>('#advancedDicePreviewWrap'),
  languageSelect: requiredElement<HTMLSelectElement>('#languageSelect'),
  modelType: requiredElement<HTMLSelectElement>('#modelType'),
  tagControls: requiredElement<HTMLDivElement>('#tagControls'),
  diceControls: requiredElement<HTMLDivElement>('#diceControls'),
  text: requiredElement<HTMLTextAreaElement>('#text'),
  backText: requiredElement<HTMLTextAreaElement>('#backText'),
  textBold: requiredElement<HTMLInputElement>('#textBold'),
  backTextDepth: requiredElement<HTMLInputElement>('#backTextDepth'),
  backFontSize: requiredElement<HTMLInputElement>('#backFontSize'),
  fontChoice: requiredElement<HTMLSelectElement>('#fontChoice'),
  fontChoiceDice: requiredElement<HTMLSelectElement>('#fontChoiceDice'),
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
  logoOffsetX: requiredElement<HTMLInputElement>('#logoOffsetX'),
  logoOffsetY: requiredElement<HTMLInputElement>('#logoOffsetY'),
  logoRotation: requiredElement<HTMLInputElement>('#logoRotation'),
  backLogoEnabled: requiredElement<HTMLInputElement>('#backLogoEnabled'),
  backLogoFileWrap: requiredElement<HTMLDivElement>('#backLogoFileWrap'),
  backLogoFile: requiredElement<HTMLInputElement>('#backLogoFile'),
  backLogoStatus: requiredElement<HTMLElement>('#backLogoStatus'),
  backLogoSettingsWrap: requiredElement<HTMLDivElement>('#backLogoSettingsWrap'),
  backLogoSize: requiredElement<HTMLInputElement>('#backLogoSize'),
  backLogoDepth: requiredElement<HTMLInputElement>('#backLogoDepth'),
  backLogoOffsetX: requiredElement<HTMLInputElement>('#backLogoOffsetX'),
  backLogoOffsetY: requiredElement<HTMLInputElement>('#backLogoOffsetY'),
  backLogoRotation: requiredElement<HTMLInputElement>('#backLogoRotation'),
  shape: requiredElement<HTMLSelectElement>('#shape'),
  width: requiredElement<HTMLInputElement>('#width'),
  height: requiredElement<HTMLInputElement>('#height'),
  holeSettingsWrap: requiredElement<HTMLDivElement>('#holeSettingsWrap'),
  thickness: requiredElement<HTMLInputElement>('#thickness'),
  cornerRadius: requiredElement<HTMLInputElement>('#cornerRadius'),
  holeDiameter: requiredElement<HTMLInputElement>('#holeDiameter'),
  holeMargin: requiredElement<HTMLInputElement>('#holeMargin'),
  holeOffsetX: requiredElement<HTMLInputElement>('#holeOffsetX'),
  holeOffsetY: requiredElement<HTMLInputElement>('#holeOffsetY'),
  diceSize: requiredElement<HTMLInputElement>('#diceSize'),
  diceRoundness: requiredElement<HTMLInputElement>('#diceRoundness'),
  diceSideHoleDiameter: requiredElement<HTMLInputElement>('#diceSideHoleDiameter'),
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
  diceFace1: requiredElement<HTMLTextAreaElement>('#diceFace1'),
  diceFace2: requiredElement<HTMLTextAreaElement>('#diceFace2'),
  diceFace3: requiredElement<HTMLTextAreaElement>('#diceFace3'),
  diceFace4: requiredElement<HTMLTextAreaElement>('#diceFace4'),
  diceFace5: requiredElement<HTMLTextAreaElement>('#diceFace5'),
  diceFace6: requiredElement<HTMLTextAreaElement>('#diceFace6'),
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
  diceFaceField1: requiredElement<HTMLDivElement>('#diceFaceField1'),
  diceFaceField2: requiredElement<HTMLDivElement>('#diceFaceField2'),
  diceFaceField3: requiredElement<HTMLDivElement>('#diceFaceField3'),
  diceFaceField4: requiredElement<HTMLDivElement>('#diceFaceField4'),
  diceFaceField5: requiredElement<HTMLDivElement>('#diceFaceField5'),
  diceFaceField6: requiredElement<HTMLDivElement>('#diceFaceField6'),
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
  resetBtn: requiredElement<HTMLButtonElement>('#resetBtn'),
  presetName: requiredElement<HTMLInputElement>('#presetName'),
  savePresetBtn: requiredElement<HTMLButtonElement>('#savePresetBtn'),
  deletePresetBtn: requiredElement<HTMLButtonElement>('#deletePresetBtn'),
  presetSelect: requiredElement<HTMLSelectElement>('#presetSelect'),
}

controlsMap.modelType.value = defaultConfig.modelType
controlsMap.fontChoice.value = defaultFontChoice
controlsMap.fontChoiceDice.value = defaultFontChoice

interface StatusState {
  key: string
  vars?: Record<string, string | number>
  isError: boolean
}

let currentLanguage: LanguageCode = defaultLanguage
let translations: Record<string, string> = {}
const localeCache: Partial<Record<LanguageCode, Record<string, string>>> = {}
let fontStatusState: StatusState = { key: 'status.font.select', isError: false }
let logoStatusState: StatusState = { key: 'status.logo.front.select', isError: false }
let backLogoStatusState: StatusState = { key: 'status.logo.back.select', isError: false }
const diceFaceLogoStatusState: Record<number, StatusState> = {
  1: { key: 'status.dice.logo.empty', isError: false },
  2: { key: 'status.dice.logo.empty', isError: false },
  3: { key: 'status.dice.logo.empty', isError: false },
  4: { key: 'status.dice.logo.empty', isError: false },
  5: { key: 'status.dice.logo.empty', isError: false },
  6: { key: 'status.dice.logo.empty', isError: false },
}

const diceSideHoleFaces = [3, 4] as const

function t(key: string, vars: Record<string, string | number> = {}, fallback?: string): string {
  return translate(translations, key, vars, fallback)
}

function readSavedLanguage(): LanguageCode {
  return readSavedLanguageFromStorage(languageStorageKey, defaultLanguage)
}

function saveLanguage(language: LanguageCode): void {
  saveLanguageToStorage(languageStorageKey, language)
}

async function loadLocale(language: LanguageCode): Promise<Record<string, string>> {
  return loadLocaleXml(language, localeCache)
}

function setText(selector: string, key: string, fallback: string): void {
  setTranslatedText(selector, key, fallback, t)
}

function setNthText(selector: string, index: number, key: string, fallback: string): void {
  setTranslatedNthText(selector, index, key, fallback, t)
}

function setAttr(selector: string, attribute: string, key: string, fallback: string): void {
  setTranslatedAttr(selector, attribute, key, fallback, t)
}

function updateTagBasePanelSummary(): void {
  const summary = document.querySelector<HTMLElement>('#tagBasePanel > summary')
  if (!summary) {
    return
  }

  const isPuzzle = controlsMap.modelType.value === 'puzzle'
  summary.textContent = isPuzzle
    ? t('tag.base.summary.puzzle', {}, 'Parametry puzzla')
    : t('tag.base.summary.tag', {}, 'Parametry tagu')
}

function getMaxDiceSideHoleDiameter(diceSize: number): number {
  return Math.max(0, diceSize * 0.75)
}

function isDiceFaceDisabledBySideHole(face: number, sideHoleDiameter: number): boolean {
  return sideHoleDiameter > 0.001 && diceSideHoleFaces.includes(face as (typeof diceSideHoleFaces)[number])
}

function getDiceSideHoleDiameterFromForm(): number {
  const diceSize = clamp(Number(controlsMap.diceSize.value), 10, 60)
  return clamp(Number(controlsMap.diceSideHoleDiameter.value), 0, getMaxDiceSideHoleDiameter(diceSize))
}

function isDiceFaceActiveInForm(face: number): boolean {
  return !isDiceFaceDisabledBySideHole(face, getDiceSideHoleDiameterFromForm())
}

function isDiceFaceActiveForConfig(face: number, config: TagConfig): boolean {
  const sideHoleDiameter = clamp(config.diceSideHoleDiameter, 0, getMaxDiceSideHoleDiameter(config.diceSize))
  return !isDiceFaceDisabledBySideHole(face, sideHoleDiameter)
}

function updateDiceSideHoleConstraints(): void {
  const diceSize = clamp(Number(controlsMap.diceSize.value), 10, 60)
  const maxDiameter = getMaxDiceSideHoleDiameter(diceSize)
  controlsMap.diceSideHoleDiameter.max = String(Math.round(maxDiameter * 10) / 10)

  const currentDiameter = Number(controlsMap.diceSideHoleDiameter.value)
  if (Number.isFinite(currentDiameter) && currentDiameter > maxDiameter) {
    controlsMap.diceSideHoleDiameter.value = String(Math.round(maxDiameter * 10) / 10)
  }
}

function renderStatus(target: HTMLElement, state: StatusState): void {
  target.textContent = t(state.key, state.vars)
  target.style.color = state.isError ? '#a03939' : ''
}

function refreshStatusTexts(): void {
  renderStatus(controlsMap.fontStatus, fontStatusState)
  renderStatus(controlsMap.logoStatus, logoStatusState)
  renderStatus(controlsMap.backLogoStatus, backLogoStatusState)

  const statusMap: Record<number, HTMLElement> = {
    1: controlsMap.diceFaceLogoStatus1,
    2: controlsMap.diceFaceLogoStatus2,
    3: controlsMap.diceFaceLogoStatus3,
    4: controlsMap.diceFaceLogoStatus4,
    5: controlsMap.diceFaceLogoStatus5,
    6: controlsMap.diceFaceLogoStatus6,
  }

  for (const face of [1, 2, 3, 4, 5, 6] as const) {
    renderStatus(statusMap[face], diceFaceLogoStatusState[face])
  }
}

function applyStaticTranslations(): void {
  document.documentElement.lang = currentLanguage
  controlsMap.languageSelect.value = currentLanguage

  setText('.subtitle', 'app.subtitle', 'Lokalny generator tagow 3D z eksportem STL.')
  setText('label[for="modelType"]', 'form.modelType', 'Typ modelu')
  setText('#modelType option[value="tag"]', 'model.tag', 'Plaski tag')
  setText('#modelType option[value="puzzle"]', 'model.puzzle', 'Puzzle (beta)')
  setText('#modelType option[value="dice"]', 'model.dice', 'Kostka K6 (beta)')
  setText('label[for="fontChoice"]', 'form.font', 'Font')
  setText('#fontChoice option[value="helvetiker"]', 'font.helvetiker', 'Helvetiker (domyslny)')
  setText('#fontChoice option[value="notoSansPl"]', 'font.notoSansPl', 'Noto Sans (PL)')
  setText('#fontChoice option[value="notoSerifPl"]', 'font.notoSerifPl', 'Noto Serif (PL)')
  setText('#fontChoice option[value="optimer"]', 'font.optimer', 'Optimer')
  setText('#fontChoice option[value="gentilis"]', 'font.gentilis', 'Gentilis')
  setText('#fontChoice option[value="droidSans"]', 'font.droidSans', 'Droid Sans')
  setText('#fontChoice option[value="droidSerif"]', 'font.droidSerif', 'Droid Serif')
  setText('#fontChoice option[value="custom"]', 'font.custom', 'Wlasny font (.ttf lub typeface.json)')
  setText('label[for="fontChoiceDice"]', 'form.font', 'Font')
  setText('#fontChoiceDice option[value="helvetiker"]', 'font.helvetiker', 'Helvetiker (domyslny)')
  setText('#fontChoiceDice option[value="notoSansPl"]', 'font.notoSansPl', 'Noto Sans (PL)')
  setText('#fontChoiceDice option[value="notoSerifPl"]', 'font.notoSerifPl', 'Noto Serif (PL)')
  setText('#fontChoiceDice option[value="optimer"]', 'font.optimer', 'Optimer')
  setText('#fontChoiceDice option[value="gentilis"]', 'font.gentilis', 'Gentilis')
  setText('#fontChoiceDice option[value="droidSans"]', 'font.droidSans', 'Droid Sans')
  setText('#fontChoiceDice option[value="droidSerif"]', 'font.droidSerif', 'Droid Serif')
  setText('#fontChoiceDice option[value="custom"]', 'font.custom', 'Wlasny font (.ttf lub typeface.json)')
  setText('label[for="customFontFile"]', 'font.customFile', 'Wlasny plik fontu')
  setText('#diceParamsPanel > summary', 'dice.params.summary', 'Parametry kosci')

  updateTagBasePanelSummary()
  setText('label[for="shape"]', 'tag.shape', 'Ksztalt')
  setText('#shape option[value="rounded"]', 'tag.shape.rounded', 'Zaokraglony prostokat')
  setText('#shape option[value="capsule"]', 'tag.shape.capsule', 'Kapsula')
  setText('#shape option[value="circle"]', 'tag.shape.circle', 'Kolo')
  setText('#shape option[value="puzzle"]', 'tag.shape.puzzle', 'Puzzle')
  setText('label[for="width"]', 'tag.width', 'Szerokosc (mm)')
  setText('label[for="height"]', 'tag.height', 'Wysokosc (mm)')
  setText('label[for="thickness"]', 'tag.thickness', 'Grubosc (mm)')
  setText('label[for="cornerRadius"]', 'tag.cornerRadius', 'Promien rogu (mm)')
  setText('label[for="holeDiameter"]', 'tag.holeDiameter', 'Srednica otworu (mm)')
  setText('label[for="holeMargin"]', 'tag.holeMargin', 'Margines otworu (mm)')
  setText('label[for="holeOffsetX"]', 'tag.holeOffsetX', 'Przesuniecie otworu X (mm)')
  setText('label[for="holeOffsetY"]', 'tag.holeOffsetY', 'Przesuniecie otworu Y (mm)')

  setText('#tagFrontPanel > summary', 'tag.front.summary', 'Awers (gora)')
  setText('label[for="text"]', 'tag.front.text', 'Napis')
  setAttr('#text', 'placeholder', 'tag.text.placeholder', 'Wpisz kilka linii tekstu')
  setText('label[for="textDepth"]', 'tag.front.textDepth', 'Glebokosc tekstu awersu (mm, ujemna = wklesly)')
  setText('label[for="fontSize"]', 'tag.front.fontSize', 'Rozmiar tekstu awersu (mm)')
  setText('#textBold + span', 'text.bold', 'Pogrubienie tekstu')
  setText('#logoEnabled + span', 'tag.front.logoEnabled', 'Dodaj logo SVG/PNG')
  setText('label[for="logoFile"]', 'tag.front.logoFile', 'Plik logo (SVG lub PNG)')
  setText('label[for="logoSize"]', 'tag.front.logoSize', 'Rozmiar logo (mm)')
  setText('label[for="logoDepth"]', 'tag.front.logoDepth', 'Glebokosc logo (mm, ujemna = wklesle)')
  setText('label[for="logoOffsetX"]', 'tag.front.logoOffsetX', 'Przesuniecie logo X (mm)')
  setText('label[for="logoOffsetY"]', 'tag.front.logoOffsetY', 'Przesuniecie logo Y (mm)')
  setText('label[for="logoRotation"]', 'tag.front.logoRotation', 'Obrot logo (stopnie)')

  setText('#tagBackPanel > summary', 'tag.back.summary', 'Rewers (dol)')
  setText('label[for="backText"]', 'tag.back.text', 'Napis')
  setAttr('#backText', 'placeholder', 'tag.text.placeholder', 'Wpisz kilka linii tekstu')
  setText('label[for="backTextDepth"]', 'tag.back.textDepth', 'Glebokosc tekstu rewersu (mm, ujemna = wklesly)')
  setText('label[for="backFontSize"]', 'tag.back.fontSize', 'Rozmiar tekstu rewersu (mm)')
  setText('#backLogoEnabled + span', 'tag.back.logoEnabled', 'Dodaj logo SVG/PNG')
  setText('label[for="backLogoFile"]', 'tag.back.logoFile', 'Plik logo (SVG lub PNG)')
  setText('label[for="backLogoSize"]', 'tag.back.logoSize', 'Rozmiar logo (mm)')
  setText('label[for="backLogoDepth"]', 'tag.back.logoDepth', 'Glebokosc logo (mm, ujemna = wklesle)')
  setText('label[for="backLogoOffsetX"]', 'tag.back.logoOffsetX', 'Przesuniecie logo X (mm)')
  setText('label[for="backLogoOffsetY"]', 'tag.back.logoOffsetY', 'Przesuniecie logo Y (mm)')
  setText('label[for="backLogoRotation"]', 'tag.back.logoRotation', 'Obrot logo (stopnie)')

  setText('label[for="diceSize"]', 'dice.size', 'Rozmiar kostki (mm)')
  setText('label[for="diceRoundness"]', 'dice.roundness', 'Okraglosc krawedzi (mm)')
  setText('label[for="diceSideHoleDiameter"]', 'dice.sideHoleDiameter', 'Srednica bocznego otworu na wylot (mm, 0 = brak)')
  setText('label[for="diceSphereRadius"]', 'dice.sphereRadius', 'Promien kuli podgladu (mm)')
  setText('#advancedPanel > summary', 'dice.preview.summary', 'Zaawansowane')
  setText('#diceShowCube + span', 'dice.preview.showCube', 'Widoczny szescian')
  setText('#diceShowText + span', 'dice.preview.showText', 'Widoczny tekst')
  setText('#diceShowSphere + span', 'dice.preview.showSphere', 'Widoczna kula ograniczajaca')
  setText('#diceClipWithSphere + span', 'dice.preview.clipSphere', 'Scinanie kula ograniczajaca')
  setText('#diceFacesPanel > summary', 'dice.faces.summary', 'Sciany kostki (kliknij, aby rozwinac)')
  setText('#diceSvgAutoSimplify + span', 'dice.svg.autoSimplify', 'Auto-upraszczanie SVG kostki')
  setText('label[for="diceSvgSimplifyStrength"]', 'dice.svg.simplifyStrength', 'Sila uproszczenia (1-5)')
  setText('#simplifyDiceSvgBtn', 'dice.svg.simplifyButton', 'Uprosc zaladowane SVG')
  setText('label[for="diceDepthAll"]', 'dice.depthAll', 'Glebokosc wszystkich scian (mm)')
  setText('#applyDiceDepthAllBtn', 'dice.depthAll.apply', 'Ustaw wszystkie')

  const faceDirections: Record<number, string> = {
    1: '+Z',
    2: '-Z',
    3: '+X',
    4: '-X',
    5: '+Y',
    6: '-Y',
  }
  for (const face of [1, 2, 3, 4, 5, 6] as const) {
    setNthText(`label[for="diceFace${face}"]`, 0, `dice.face.title.${face}`, `Sciana ${face} (${faceDirections[face]})`)
    setNthText(`label[for="diceFace${face}"]`, 1, 'dice.face.textLabel', 'Napis sciany')
    setText(`#diceFaceTextEnabled${face} + span`, 'dice.face.textEnabled', 'Wlacz tekst')
    setText(`label[for="diceFaceDepth${face}"]`, 'dice.face.depth', 'Glebokosc tekstu (mm)')
    setText(`label[for="diceFaceFontSize${face}"]`, 'dice.face.fontSize', 'Rozmiar czcionki (mm)')
    setText(`#diceFaceLogoEnabled${face} + span`, 'dice.face.logoEnabled', 'Wlacz grafike SVG/PNG')
    setText(`label[for="diceFaceLogoFile${face}"]`, 'dice.face.logoFile', 'Plik logo SVG/PNG')
    setText(`label[for="diceFaceLogoSize${face}"]`, 'dice.face.logoSize', 'Rozmiar logo (mm)')
    setText(`label[for="diceFaceLogoDepth${face}"]`, 'dice.face.logoDepth', 'Glebokosc logo (mm)')
  }

  setText('#resetBtn', 'actions.reset', 'Reset')
  setText('#exportBtn', 'actions.export', 'Eksport STL')
  setText('#advancedPresetsTitle', 'presets.summary', 'Presety lokalne')
  setText('label[for="presetName"]', 'presets.name', 'Nazwa presetu')
  setAttr('#presetName', 'placeholder', 'presets.name.placeholder', 'np. Tag dla psa')
  setText('#savePresetBtn', 'presets.save', 'Zapisz preset')
  setText('#deletePresetBtn', 'presets.delete', 'Usun preset')
  setText('label[for="presetSelect"]', 'presets.load', 'Wczytaj preset')

  setAttr('#panelResizeHandle', 'aria-label', 'accessibility.panelResize', 'Zmien szerokosc panelu')
  setAttr('#viewer', 'aria-label', 'accessibility.viewer', 'Podglad 3D')
  setNthText('.legend span', 0, 'viewer.legend.rotate', 'Lewy przycisk: obrot')
  setNthText('.legend span', 1, 'viewer.legend.zoom', 'Scroll: zoom')
  setNthText('.legend span', 2, 'viewer.legend.pan', 'Prawy przycisk: przesuniecie')
  setAttr('#languageSelect', 'aria-label', 'language.aria', 'Language')
}

async function setLanguage(language: LanguageCode, persist = true): Promise<void> {
  try {
    translations = await loadLocale(language)
    currentLanguage = language
    applyStaticTranslations()
    refreshStatusTexts()
    refreshPresetSelect()
    if (persist) {
      saveLanguage(language)
    }
  } catch (error) {
    console.error(error)
  }
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

const phoneTouchMedia = window.matchMedia('(max-width: 980px) and (pointer: coarse)')

function applyTouchInteractionMode(): void {
  const isPhoneTouch = phoneTouchMedia.matches

  // Keep classic mouse mapping regardless of screen size.
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN

  if (isPhoneTouch) {
    // One finger is reserved for page scroll; rotation requires two fingers.
    controls.touches.ONE = THREE.TOUCH.PAN
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
    controls.enablePan = false
    canvas.style.touchAction = 'pan-y'
    return
  }

  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  controls.enablePan = true
  canvas.style.touchAction = 'none'
}

applyTouchInteractionMode()
phoneTouchMedia.addEventListener('change', applyTouchInteractionMode)

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

  context.clearRect(0, 0, size, size)

  context.strokeStyle = 'rgba(120, 90, 60, 0.12)'
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

  context.strokeStyle = 'rgba(95, 68, 40, 0.2)'
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
    color: '#ffffff',
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0.65,
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
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .slice(0, 2)
    .map((line) => line.slice(0, 10).trim())

  while (lines.length > 1 && lines.at(-1) === '') {
    lines.pop()
  }

  return lines.join('\n').trim()
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

function setFontStatus(key: string, isError: boolean, vars?: Record<string, string | number>): void {
  fontStatusState = { key, vars, isError }
  renderStatus(controlsMap.fontStatus, fontStatusState)
}

function setLogoStatus(key: string, isError: boolean, vars?: Record<string, string | number>): void {
  logoStatusState = { key, vars, isError }
  renderStatus(controlsMap.logoStatus, logoStatusState)
}

function setBackLogoStatus(key: string, isError: boolean, vars?: Record<string, string | number>): void {
  backLogoStatusState = { key, vars, isError }
  renderStatus(controlsMap.backLogoStatus, backLogoStatusState)
}

function setDiceFaceLogoStatus(face: number, key: string, isError: boolean, vars?: Record<string, string | number>): void {
  const statusMap: Record<number, HTMLElement> = {
    1: controlsMap.diceFaceLogoStatus1,
    2: controlsMap.diceFaceLogoStatus2,
    3: controlsMap.diceFaceLogoStatus3,
    4: controlsMap.diceFaceLogoStatus4,
    5: controlsMap.diceFaceLogoStatus5,
    6: controlsMap.diceFaceLogoStatus6,
  }
  const target = statusMap[face]
  diceFaceLogoStatusState[face] = { key, vars, isError }
  renderStatus(target, diceFaceLogoStatusState[face])
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
  const isDice = controlsMap.modelType.value === 'dice'
  controlsMap.customFontWrap.style.display = isCustom && !isDice ? '' : 'none'
}

function applySelectedFontChoice(choice: FontChoice): void {
  controlsMap.fontChoice.value = choice
  controlsMap.fontChoiceDice.value = choice
  updateCustomFontVisibility()
  if (isBuiltinFontChoice(choice)) {
    saveLastState()
    void applyBuiltinFont(choice)
  } else {
    setFontStatus('status.font.select', false)
  }
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
  const fieldMap: Record<number, HTMLDivElement> = {
    1: controlsMap.diceFaceField1,
    2: controlsMap.diceFaceField2,
    3: controlsMap.diceFaceField3,
    4: controlsMap.diceFaceField4,
    5: controlsMap.diceFaceField5,
    6: controlsMap.diceFaceField6,
  }

  const isActive = isDiceFaceActiveInForm(face)
  fieldMap[face].style.display = isActive ? '' : 'none'
  if (!isActive) {
    return
  }

  textWrapMap[face].style.display = textEnabledMap[face].checked ? '' : 'none'
  logoWrapMap[face].style.display = logoEnabledMap[face].checked ? '' : 'none'
}

function updateAllDiceFaceOptionVisibility(): void {
  updateDiceSideHoleConstraints()
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
  const isPuzzle = modelType === 'puzzle'
  controlsMap.diceParamsPanel.style.display = isDice ? '' : 'none'
  controlsMap.tagControls.style.display = isDice ? 'none' : ''
  controlsMap.diceControls.style.display = isDice ? '' : 'none'
  controlsMap.diceParamsOnlyWrap.style.display = isDice ? '' : 'none'
  controlsMap.diceDimensionsWrap.style.display = isDice ? '' : 'none'
  controlsMap.advancedDicePreviewWrap.style.display = isDice ? '' : 'none'
  controlsMap.shape.disabled = isPuzzle
  controlsMap.height.disabled = isPuzzle
  controlsMap.holeSettingsWrap.style.display = isPuzzle ? 'none' : ''
  if (isPuzzle) {
    controlsMap.shape.value = 'puzzle'
    controlsMap.height.value = controlsMap.width.value
  } else if (controlsMap.shape.value === 'puzzle') {
    controlsMap.shape.value = 'rounded'
  }
  updateTagBasePanelSummary()
  updateCustomFontVisibility()
  shadowPlate.visible = !isDice
}

function applyPanelWidth(width: number): void {
  const clampedWidth = clamp(width, 300, 760)
  document.documentElement.style.setProperty('--panel-width', `${Math.round(clampedWidth)}px`)
}

function readPanelWidth(): number | null {
  return readPanelWidthFromStorage(panelWidthStorageKey, clamp)
}

function savePanelWidth(width: number): void {
  savePanelWidthToStorage(panelWidthStorageKey, width, clamp)
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
  setFontStatus('status.font.loadingBuiltin', false)

  try {
    const font = await loadFontFromUrl(builtinFontUrls[choice])
    if (token !== fontLoadToken) {
      return
    }
    loadedFont = font
    setFontStatus('status.font.loaded', false)
    rebuildTag()
  } catch {
    if (token !== fontLoadToken) {
      return
    }
    setFontStatus('status.font.loadError', true)
  }
}

async function applyCustomFontFromFile(file: File): Promise<void> {
  const token = ++fontLoadToken
  setFontStatus('status.font.loadingCustom', false, { name: file.name })

  try {
    const isTtf = file.name.toLowerCase().endsWith('.ttf')
    const font = isTtf
      ? fontLoader.parse(ttfLoader.parse(await file.arrayBuffer()) as never)
      : fontLoader.parse(JSON.parse(await file.text()) as never)

    if (token !== fontLoadToken) {
      return
    }

    loadedFont = font
    setFontStatus('status.font.customLoaded', false, { name: file.name })
    rebuildTag()
  } catch {
    if (token !== fontLoadToken) {
      return
    }
    setFontStatus('status.font.invalid', true)
  }
}

function isSvgFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.svg') || file.type === 'image/svg+xml'
}

function isPngFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.png') || file.type === 'image/png'
}

type ImageTracerApi = {
  imagedataToSVG: (imageData: ImageData, options?: Record<string, unknown> | string) => string
}

async function getImageTracerApi(): Promise<ImageTracerApi> {
  const module = await import('imagetracerjs') as { default?: ImageTracerApi } & ImageTracerApi
  return module.default ?? module
}

function preparePngMaskForTracing(imageData: ImageData): void {
  const data = imageData.data
  const alphaThreshold = 12
  const blackThreshold = 226

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const isForeground = a > alphaThreshold && luminance < blackThreshold

    if (isForeground) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 255
    } else {
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = 0
    }
  }
}

function extractDarkShapesFromSvgString(svgString: string): THREE.Shape[] {
  const parsed = svgLoader.parse(svgString)
  const maxDarkLuminance = 0.6

  return parsed.paths.flatMap((path) => {
    const color = path.color
    const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
    if (luminance > maxDarkLuminance) {
      return []
    }
    return SVGLoader.createShapes(path)
  })
}

function simplifyPolygonPoints(points: THREE.Vector2[]): THREE.Vector2[] {
  if (points.length < 3) {
    return points
  }

  const withoutDuplicates: THREE.Vector2[] = []
  points.forEach((point) => {
    const previous = withoutDuplicates.at(-1)
    if (!previous || Math.abs(previous.x - point.x) > 0.0001 || Math.abs(previous.y - point.y) > 0.0001) {
      withoutDuplicates.push(point)
    }
  })

  if (withoutDuplicates.length >= 2) {
    const first = withoutDuplicates[0]
    const last = withoutDuplicates.at(-1)
    if (last && Math.abs(first.x - last.x) < 0.0001 && Math.abs(first.y - last.y) < 0.0001) {
      withoutDuplicates.pop()
    }
  }

  if (withoutDuplicates.length < 3) {
    return withoutDuplicates
  }

  const simplified: THREE.Vector2[] = []
  for (let i = 0; i < withoutDuplicates.length; i += 1) {
    const prev = withoutDuplicates[(i - 1 + withoutDuplicates.length) % withoutDuplicates.length]
    const curr = withoutDuplicates[i]
    const next = withoutDuplicates[(i + 1) % withoutDuplicates.length]
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
    if (Math.abs(cross) > 0.0001) {
      simplified.push(curr)
    }
  }

  return simplified.length >= 3 ? simplified : withoutDuplicates
}

function polygonSignedArea(points: THREE.Vector2[]): number {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    area += p1.x * p2.y - p2.x * p1.y
  }
  return area / 2
}

function isPointInsidePolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    const intersects =
      (pi.y > point.y) !== (pj.y > point.y)
      && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 0.0000001) + pi.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function buildShapesFromRgbaMask(data: Uint8ClampedArray, width: number, height: number): THREE.Shape[] {
  type Edge = { startX: number; startY: number; endX: number; endY: number }
  const mask = new Uint8Array(width * height)

  const luminanceThreshold = 96
  const alphaThreshold = 12
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4
      const r = data[pixelIndex]
      const g = data[pixelIndex + 1]
      const b = data[pixelIndex + 2]
      const a = data[pixelIndex + 3]
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      mask[y * width + x] = a > alphaThreshold && luminance <= luminanceThreshold ? 1 : 0
    }
  }

  const isFilled = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return false
    }
    return mask[y * width + x] === 1
  }

  const edges: Edge[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFilled(x, y)) {
        continue
      }

      if (!isFilled(x, y - 1)) {
        edges.push({ startX: x, startY: y, endX: x + 1, endY: y })
      }
      if (!isFilled(x + 1, y)) {
        edges.push({ startX: x + 1, startY: y, endX: x + 1, endY: y + 1 })
      }
      if (!isFilled(x, y + 1)) {
        edges.push({ startX: x + 1, startY: y + 1, endX: x, endY: y + 1 })
      }
      if (!isFilled(x - 1, y)) {
        edges.push({ startX: x, startY: y + 1, endX: x, endY: y })
      }
    }
  }

  if (edges.length === 0) {
    return []
  }

  const edgeMap = new Map<string, number[]>()
  edges.forEach((edge, index) => {
    const key = `${edge.startX},${edge.startY}`
    const bucket = edgeMap.get(key)
    if (bucket) {
      bucket.push(index)
    } else {
      edgeMap.set(key, [index])
    }
  })

  const visited = new Array<boolean>(edges.length).fill(false)
  const loops: THREE.Vector2[][] = []

  for (let i = 0; i < edges.length; i += 1) {
    if (visited[i]) {
      continue
    }

    const firstEdge = edges[i]
    const loop: THREE.Vector2[] = []
    let currentIndex = i
    let guard = 0

    while (!visited[currentIndex] && guard < edges.length + 4) {
      guard += 1
      visited[currentIndex] = true
      const edge = edges[currentIndex]
      loop.push(new THREE.Vector2(edge.startX, -edge.startY))

      if (edge.endX === firstEdge.startX && edge.endY === firstEdge.startY) {
        break
      }

      const nextKey = `${edge.endX},${edge.endY}`
      const candidates = edgeMap.get(nextKey) ?? []
      const nextIndex = candidates.find((candidate) => !visited[candidate])
      if (nextIndex === undefined) {
        loop.length = 0
        break
      }
      currentIndex = nextIndex
    }

    const simplifiedLoop = simplifyPolygonPoints(loop)
    if (simplifiedLoop.length >= 3) {
      loops.push(simplifiedLoop)
    }
  }

  if (loops.length === 0) {
    return []
  }

  const loopMeta = loops
    .map((points) => ({ points, area: polygonSignedArea(points) }))
    .filter((entry) => Math.abs(entry.area) > 0.0001)
  const outerLoops = loopMeta.filter((entry) => entry.area < 0)
  const holeLoops = loopMeta.filter((entry) => entry.area > 0)

  const shapes = outerLoops.map((outerLoop) => {
    const outerPoints = [...outerLoop.points].reverse()
    return {
      points: outerPoints,
      area: Math.abs(outerLoop.area),
      shape: shapeFromPoints(outerPoints),
    }
  })

  holeLoops.forEach((holeLoop) => {
    const probe = holeLoop.points[0]
    const targetOuter = shapes
      .filter((entry) => isPointInsidePolygon(probe, entry.points))
      .sort((a, b) => a.area - b.area)[0]

    if (!targetOuter) {
      return
    }

    targetOuter.shape.holes.push(pathFromPoints([...holeLoop.points].reverse()))
  })

  return shapes.map((entry) => entry.shape)
}

async function loadPngShapesFromFile(file: File): Promise<THREE.Shape[]> {
  const bitmap = await createImageBitmap(file)
  const maxDimension = 700
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

  const canvasElement = document.createElement('canvas')
  canvasElement.width = targetWidth
  canvasElement.height = targetHeight
  const context = canvasElement.getContext('2d')
  if (!context) {
    bitmap.close()
    return []
  }

  context.clearRect(0, 0, targetWidth, targetHeight)
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight)
  bitmap.close()

  try {
    preparePngMaskForTracing(imageData)
    const tracer = await getImageTracerApi()
    const svgString = tracer.imagedataToSVG(imageData, {
      ltres: 0.2,
      qtres: 0.2,
      pathomit: 0,
      rightangleenhance: true,
      colorsampling: 0,
      colorquantcycles: 1,
      numberofcolors: 2,
      linefilter: true,
      roundcoords: 2,
      strokewidth: 0,
      viewbox: true,
      desc: false,
      pal: [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 255, g: 255, b: 255, a: 0 },
      ],
    })

    const tracedShapes = extractDarkShapesFromSvgString(svgString)
    if (tracedShapes.length > 0) {
      return tracedShapes
    }
  } catch {
    // Fall back to the previous contour extraction if vectorization fails.
  }

  return buildShapesFromRgbaMask(imageData.data, targetWidth, targetHeight)
}

async function loadLogoShapesFromFile(file: File): Promise<THREE.Shape[]> {
  if (isSvgFile(file)) {
    const raw = await file.text()
    const parsed = svgLoader.parse(raw)
    return parsed.paths.flatMap((path) => SVGLoader.createShapes(path))
  }

  if (isPngFile(file)) {
    return await loadPngShapesFromFile(file)
  }

  throw new Error('unsupported-logo-format')
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
      setDiceFaceLogoStatus(face, 'status.dice.logo.removed', true)
      changedFaces += 1
      return
    }

    setDiceFaceLogoShapes(face, simplifiedShapes)
    const afterComplexity = estimateSvgShapeComplexity(simplifiedShapes)
    setDiceFaceLogoStatus(face, 'status.dice.logo.simplified', false, { before: beforeComplexity, after: afterComplexity })
    changedFaces += 1
  })

  if (changedFaces > 0) {
    saveLastState()
    rebuildTag()
  }
}

async function applyFrontLogoFromFile(file: File): Promise<void> {
  const token = ++frontLogoLoadToken
  setLogoStatus('status.logo.loading', false, { name: file.name })

  try {
    const sourceShapes = await loadLogoShapesFromFile(file)
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
    setLogoStatus('status.logo.loaded', false, { name: file.name })
    rebuildTag()
  } catch {
    if (token !== frontLogoLoadToken) {
      return
    }
    loadedLogoShapes = []
    setLogoStatus('status.logo.invalid', true)
  }
}

async function applyBackLogoFromFile(file: File): Promise<void> {
  const token = ++backLogoLoadToken
  setBackLogoStatus('status.logo.loading', false, { name: file.name })

  try {
    const sourceShapes = await loadLogoShapesFromFile(file)
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
    setBackLogoStatus('status.logo.loaded', false, { name: file.name })
    rebuildTag()
  } catch {
    if (token !== backLogoLoadToken) {
      return
    }
    loadedBackLogoShapes = []
    setBackLogoStatus('status.logo.invalid', true)
  }
}

async function applyDiceFaceLogoFromFile(face: number, file: File): Promise<void> {
  const token = nextDiceFaceLogoToken(face)
  setDiceFaceLogoStatus(face, 'status.logo.loading', false, { name: file.name })

  try {
    const sourceShapes = await loadLogoShapesFromFile(file)
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
    setDiceFaceLogoStatus(face, 'status.logo.loaded', false, { name: file.name })
    rebuildTag()
  } catch (error) {
    if (!isDiceFaceLogoTokenCurrent(face, token)) {
      return
    }
    setDiceFaceLogoShapes(face, [])
    const message = error instanceof Error && error.message === 'svg-too-complex'
      ? 'status.dice.logo.tooComplex'
      : 'status.logo.invalidShort'
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

  return applyTextBoldToGeometries(geometries, config.fontSize, config.textBold)
}

function getTextBoldOffsets(fontSize: number, enabled: boolean): THREE.Vector2[] {
  if (!enabled) {
    return [new THREE.Vector2(0, 0)]
  }

  const offset = clamp(fontSize * 0.045, 0.12, 0.7)
  return [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(offset, 0),
    new THREE.Vector2(-offset, 0),
    new THREE.Vector2(0, offset),
    new THREE.Vector2(0, -offset),
    new THREE.Vector2(offset * 0.7, offset * 0.7),
    new THREE.Vector2(offset * 0.7, -offset * 0.7),
    new THREE.Vector2(-offset * 0.7, offset * 0.7),
    new THREE.Vector2(-offset * 0.7, -offset * 0.7),
  ]
}

function applyTextBoldToGeometries(
  sourceGeometries: TextGeometry[],
  fontSize: number,
  enabled: boolean,
): TextGeometry[] {
  const offsets = getTextBoldOffsets(fontSize, enabled)
  if (offsets.length === 1) {
    return sourceGeometries
  }

  const boldGeometries: TextGeometry[] = []
  sourceGeometries.forEach((geometry) => {
    offsets.forEach((offset) => {
      const clone = geometry.clone()
      clone.translate(offset.x, offset.y, 0)
      boldGeometries.push(clone)
    })
    geometry.dispose()
  })

  return boldGeometries
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

function cloneTransformedShape(
  shape: THREE.Shape,
  scale: number,
  offsetX: number,
  offsetY: number,
  rotationRad: number,
  samplePoints = 30,
): THREE.Shape {
  const pointCount = clamp(Math.round(samplePoints), 8, 80)
  const cosAngle = Math.cos(rotationRad)
  const sinAngle = Math.sin(rotationRad)
  const transformPoint = (point: THREE.Vector2): THREE.Vector2 => {
    const scaledX = point.x * scale
    const scaledY = point.y * scale
    const rotatedX = scaledX * cosAngle - scaledY * sinAngle
    const rotatedY = scaledX * sinAngle + scaledY * cosAngle
    return new THREE.Vector2(rotatedX + offsetX, rotatedY + offsetY)
  }

  const scaledOuter = shape.getPoints(pointCount).map(transformPoint)
  const scaledShape = shapeFromPoints(scaledOuter)

  shape.holes.forEach((holePath) => {
    const scaledHole = holePath.getPoints(pointCount).map(transformPoint)
    scaledShape.holes.push(pathFromPoints(scaledHole))
  })

  return scaledShape
}

interface LogoTransformOptions {
  offsetX?: number
  offsetY?: number
  rotationDeg?: number
}

function createLogoGeometries(
  shapes: THREE.Shape[],
  size: number,
  depth: number,
  curveSegments = 28,
  transform: LogoTransformOptions = {},
): THREE.ExtrudeGeometry[] {
  if (shapes.length === 0) {
    return []
  }

  const extrudeDepth = clamp(Math.abs(depth), 0.2, 8)
  const scale = clamp(size, 2, 40)
  const offsetX = clamp(transform.offsetX ?? 0, -80, 80)
  const offsetY = clamp(transform.offsetY ?? 0, -80, 80)
  const rotationRad = THREE.MathUtils.degToRad(clamp(transform.rotationDeg ?? 0, -180, 180))
  const shapeSamplePoints = clamp(Math.round(curveSegments * 1.5), 8, 80)

  return shapes.map((shape) => {
    const scaledShape = cloneTransformedShape(shape, scale, offsetX, offsetY, rotationRad, shapeSamplePoints)
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

  const geometries = createLogoGeometries(loadedLogoShapes, config.logoSize, Math.abs(config.logoDepth), 28, {
    offsetX: config.logoOffsetX,
    offsetY: config.logoOffsetY,
    rotationDeg: config.logoRotation,
  })
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
  const geometries = createLogoGeometries(loadedLogoShapes, config.logoSize, cutterDepth, 28, {
    offsetX: config.logoOffsetX,
    offsetY: config.logoOffsetY,
    rotationDeg: config.logoRotation,
  })

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

  const geometries = createLogoGeometries(loadedBackLogoShapes, config.backLogoSize, Math.abs(config.backLogoDepth), 28, {
    offsetX: config.backLogoOffsetX,
    offsetY: config.backLogoOffsetY,
    rotationDeg: config.backLogoRotation,
  })
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
  const geometries = createLogoGeometries(loadedBackLogoShapes, config.backLogoSize, cutterDepth, 28, {
    offsetX: config.backLogoOffsetX,
    offsetY: config.backLogoOffsetY,
    rotationDeg: config.backLogoRotation,
  })

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
  const modelType: ModelType = rawModelType === 'dice' ? 'dice' : rawModelType === 'puzzle' ? 'puzzle' : 'tag'
  const rawShape = controlsMap.shape.value as TagShape
  const shape: TagShape = modelType === 'puzzle'
    ? 'puzzle'
    : rawShape === 'capsule' || rawShape === 'circle' || rawShape === 'puzzle'
      ? rawShape
      : 'rounded'

  const puzzleSize = clamp(Number(controlsMap.width.value), 20, 120)
  const width = modelType === 'puzzle' ? puzzleSize : clamp(Number(controlsMap.width.value), 20, 120)
  const height = modelType === 'puzzle' ? puzzleSize : clamp(Number(controlsMap.height.value), 15, 60)
  const thickness = clamp(Number(controlsMap.thickness.value), 1.5, 8)
  const textDepth = clamp(Number(controlsMap.textDepth.value), -20, 20)
  const backTextDepth = clamp(Number(controlsMap.backTextDepth.value), -20, 20)
  const textBold = controlsMap.textBold.checked
  const maxCorner = Math.min(width, height) * 0.49
  const text = sanitizeTextInput(controlsMap.text.value)
  const backText = sanitizeTextInput(controlsMap.backText.value)
  const diceSize = clamp(Number(controlsMap.diceSize.value), 10, 60)
  const maxDiceRoundness = Math.max(0, diceSize * 0.18)
  const diceRoundness = clamp(Number(controlsMap.diceRoundness.value), 0, maxDiceRoundness)
  const diceSideHoleDiameter = clamp(Number(controlsMap.diceSideHoleDiameter.value), 0, getMaxDiceSideHoleDiameter(diceSize))
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
  const logoOffsetX = clamp(Number(controlsMap.logoOffsetX.value), -60, 60)
  const logoOffsetY = clamp(Number(controlsMap.logoOffsetY.value), -60, 60)
  const logoRotation = clamp(Number(controlsMap.logoRotation.value), -180, 180)
  const backLogoEnabled = controlsMap.backLogoEnabled.checked
  const backLogoSize = clamp(Number(controlsMap.backLogoSize.value), 2, 40)
  const backLogoDepth = clamp(Number(controlsMap.backLogoDepth.value), -8, 8)
  const backLogoOffsetX = clamp(Number(controlsMap.backLogoOffsetX.value), -60, 60)
  const backLogoOffsetY = clamp(Number(controlsMap.backLogoOffsetY.value), -60, 60)
  const backLogoRotation = clamp(Number(controlsMap.backLogoRotation.value), -180, 180)

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
    holeOffsetX: clamp(Number(controlsMap.holeOffsetX.value), -60, 60),
    holeOffsetY: clamp(Number(controlsMap.holeOffsetY.value), -60, 60),
    fontSize: clamp(Number(controlsMap.fontSize.value), 4, 22),
    backFontSize: clamp(Number(controlsMap.backFontSize.value), 4, 22),
    textDepth,
    backTextDepth,
    textBold,
    diceSize,
    diceRoundness,
    diceSideHoleDiameter,
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
    logoOffsetX,
    logoOffsetY,
    logoRotation,
    backLogoEnabled,
    backLogoSize,
    backLogoDepth,
    backLogoOffsetX,
    backLogoOffsetY,
    backLogoRotation,
  }
}

function applyConfigToForm(config: TagConfig): void {
  controlsMap.modelType.value = config.modelType
  controlsMap.text.value = config.text
  controlsMap.backText.value = config.backText
  controlsMap.shape.value = config.shape
  controlsMap.width.value = String(config.width)
  controlsMap.height.value = String(config.modelType === 'puzzle' ? config.width : config.height)
  controlsMap.thickness.value = String(config.thickness)
  controlsMap.cornerRadius.value = String(config.cornerRadius)
  controlsMap.holeDiameter.value = String(config.holeDiameter)
  controlsMap.holeMargin.value = String(config.holeMargin)
  controlsMap.holeOffsetX.value = String(config.holeOffsetX)
  controlsMap.holeOffsetY.value = String(config.holeOffsetY)
  controlsMap.diceSize.value = String(config.diceSize)
  controlsMap.diceRoundness.value = String(config.diceRoundness)
  controlsMap.diceSideHoleDiameter.value = String(config.diceSideHoleDiameter)
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
  controlsMap.textBold.checked = Boolean(config.textBold)
  controlsMap.logoEnabled.checked = Boolean(config.logoEnabled)
  controlsMap.logoSize.value = String(config.logoSize)
  controlsMap.logoDepth.value = String(config.logoDepth)
  controlsMap.logoOffsetX.value = String(config.logoOffsetX)
  controlsMap.logoOffsetY.value = String(config.logoOffsetY)
  controlsMap.logoRotation.value = String(config.logoRotation)
  controlsMap.backLogoEnabled.checked = Boolean(config.backLogoEnabled)
  controlsMap.backLogoSize.value = String(config.backLogoSize)
  controlsMap.backLogoDepth.value = String(config.backLogoDepth)
  controlsMap.backLogoOffsetX.value = String(config.backLogoOffsetX)
  controlsMap.backLogoOffsetY.value = String(config.backLogoOffsetY)
  controlsMap.backLogoRotation.value = String(config.backLogoRotation)
  updateAllDiceFaceOptionVisibility()
  updateModelControlsVisibility()
  updateLogoControlsVisibility()
  updateBackLogoControlsVisibility()
}

function createBaseShape(config: TagConfig): THREE.Shape {
  return createTagPuzzleBaseShape(config, { clamp, shapeFromPoints })
}

function createBaseMesh(config: TagConfig): THREE.Mesh {
  return createTagPuzzleBaseMesh(config, baseMaterial, { clamp, shapeFromPoints })
}

function createCenteredTextGeometries(text: string, fontSize: number, depth: number, boldEnabled: boolean): TextGeometry[] {
  if (!loadedFont) {
    return []
  }

  const lines = sanitizeDiceFaceText(text)
    .split('\n')
    .slice(0, 2)
    .map((line) => normalizeTextForFont(line))
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const lineSpacing = fontSize * textLineSpacingFactor
  const verticalCenterOffset = ((lines.length - 1) * lineSpacing) / 2
  const geometries: TextGeometry[] = []

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  lines.forEach((line, index) => {
    const geometry = new TextGeometry(line, {
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

  return applyTextBoldToGeometries(geometries, fontSize, boldEnabled)
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

function createDiceObject(config: TagConfig): THREE.Object3D {
  const size = config.diceSize
  const maxRoundness = size * 0.18
  const roundness = clamp(config.diceRoundness, 0, maxRoundness)
  const sideHoleDiameter = clamp(config.diceSideHoleDiameter, 0, getMaxDiceSideHoleDiameter(size))
  const baseGeometry = new RoundedBoxGeometry(size, size, size, 4, roundness)
  baseGeometry.computeVertexNormals()
  let baseMesh: THREE.Mesh = new THREE.Mesh(baseGeometry, baseMaterial)
  baseMesh.userData.previewRole = 'cube'

  if (sideHoleDiameter > 0.001) {
    const sideHoleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(sideHoleDiameter / 2, sideHoleDiameter / 2, size + 2, 48),
      baseMaterial,
    )
    sideHoleMesh.rotation.z = Math.PI / 2
    sideHoleMesh.updateMatrix()

    baseMesh.updateMatrix()
    const holedBaseMesh = CSG.subtract(baseMesh, sideHoleMesh)
    holedBaseMesh.material = baseMaterial
    holedBaseMesh.geometry.computeVertexNormals()

    baseMesh.geometry.dispose()
    sideHoleMesh.geometry.dispose()
    baseMesh = holedBaseMesh
    baseMesh.userData.previewRole = 'cube'
  }

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
  ].filter((face) => isDiceFaceActiveForConfig(face.face, config))

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
      const geometries = createCenteredTextGeometries(face.text, faceFontSize, absDepth, config.textBold)
      if (geometries.length === 0) {
        return
      }

      geometries.forEach((geometry) => {
        const mesh = new THREE.Mesh(geometry, detailMaterial)
        mesh.rotation.copy(face.rotation)
        mesh.position.copy(face.normal.clone().multiplyScalar(size / 2 - 0.02))
        embossMeshes.push(mesh)
      })
      return
    }

    const cutterDepth = absDepth + seamOverlap
    const cutterGeometries = createCenteredTextGeometries(face.text, faceFontSize, cutterDepth, config.textBold)
    if (cutterGeometries.length === 0) {
      return
    }

    cutterGeometries.forEach((cutterGeometry) => {
      const cutter = new THREE.Mesh(cutterGeometry, baseMaterial)
      cutter.rotation.copy(face.rotation)
      cutter.position.copy(face.normal.clone().multiplyScalar(size / 2 - cutterDepth + seamOverlap * 0.5))
      cutter.updateMatrix()
      cutters.push(cutter)
    })
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

    const isThroughCut = Math.abs(config.textDepth) >= config.thickness - 0.001
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
  const canvasBounds = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(canvasBounds.width))
  const height = Math.max(1, Math.round(canvasBounds.height))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate(): void {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

const canvasResizeObserver = new ResizeObserver(() => {
  resizeRenderer()
})

canvasResizeObserver.observe(canvas)

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

  if (config.modelType === 'dice') {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = String(now.getFullYear())
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    link.download = `DICE_D6_${dd}-${mm}-${yyyy}_${hh}:${min}.stl`
  } else {
    link.download = `${config.text.toLowerCase().replace(/\s+/g, '-') || 'tag'}.stl`
  }

  link.click()
  URL.revokeObjectURL(url)
}

function readPresets(): Record<string, TagConfig> {
  return readPresetsFromStorage(presetsStorageKey)
}

function writePresets(presets: Record<string, TagConfig>): void {
  writePresetsToStorage(presetsStorageKey, presets)
}

function readLastState(): PersistedAppState | null {
  const parsed = readLastStateFromStorage(lastStateStorageKey)
  if (!parsed) {
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
}

function saveLastState(): void {
  const selectedChoice = controlsMap.fontChoice.value as FontChoice
  const fontChoice = isBuiltinFontChoice(selectedChoice) ? selectedChoice : defaultFontChoice
  const payload: PersistedAppState = {
    config: getConfigFromForm(),
    fontChoice,
  }
  saveLastStateToStorage(lastStateStorageKey, payload)
}

function normalizeConfigForModel(config: TagConfig, modelType: 'tag' | 'puzzle'): TagConfig {
  if (modelType === 'puzzle') {
    const puzzleSize = clamp(config.width, 20, 120)
    return {
      ...config,
      modelType: 'puzzle',
      shape: 'puzzle',
      width: puzzleSize,
      height: puzzleSize,
    }
  }

  const normalizedShape: TagShape = config.shape === 'puzzle' ? 'rounded' : config.shape
  return {
    ...config,
    modelType: 'tag',
    shape: normalizedShape,
    width: clamp(config.width, 20, 120),
    height: clamp(config.height, 15, 60),
  }
}

function captureConfigFromFormAsModel(modelType: 'tag' | 'puzzle'): TagConfig {
  const originalModelType = controlsMap.modelType.value as ModelType
  controlsMap.modelType.value = modelType
  const capturedConfig = getConfigFromForm()
  controlsMap.modelType.value = originalModelType
  return normalizeConfigForModel(capturedConfig, modelType)
}

let modelDraftByType: Record<'tag' | 'puzzle', TagConfig> = {
  tag: normalizeConfigForModel(defaultConfig, 'tag'),
  puzzle: normalizeConfigForModel(defaultConfig, 'puzzle'),
}
let currentModelTypeSelection: ModelType = defaultConfig.modelType

function refreshPresetSelect(): void {
  const presets = readPresets()
  const names = Object.keys(presets).sort((a, b) => a.localeCompare(b))
  const selectedValue = controlsMap.presetSelect.value
  controlsMap.presetSelect.innerHTML = `<option value="">${t('presets.selectPlaceholder', {}, '-- wybierz --')}</option>`
  names.forEach((name) => {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    controlsMap.presetSelect.append(option)
  })
  if (selectedValue && names.includes(selectedValue)) {
    controlsMap.presetSelect.value = selectedValue
  }
}

function syncPuzzleDimensionsInForm(): void {
  if (controlsMap.modelType.value === 'puzzle') {
    controlsMap.height.value = controlsMap.width.value
  }
}

function wireEvents(): void {
  const updateInputs = [
    controlsMap.modelType,
    controlsMap.text,
    controlsMap.backText,
    controlsMap.textBold,
    controlsMap.backFontSize,
    controlsMap.backTextDepth,
    controlsMap.logoEnabled,
    controlsMap.logoSize,
    controlsMap.logoDepth,
    controlsMap.logoOffsetX,
    controlsMap.logoOffsetY,
    controlsMap.logoRotation,
    controlsMap.backLogoEnabled,
    controlsMap.backLogoSize,
    controlsMap.backLogoDepth,
    controlsMap.backLogoOffsetX,
    controlsMap.backLogoOffsetY,
    controlsMap.backLogoRotation,
    controlsMap.shape,
    controlsMap.width,
    controlsMap.height,
    controlsMap.thickness,
    controlsMap.cornerRadius,
    controlsMap.holeDiameter,
    controlsMap.holeMargin,
    controlsMap.holeOffsetX,
    controlsMap.holeOffsetY,
    controlsMap.diceSize,
    controlsMap.diceRoundness,
    controlsMap.diceSideHoleDiameter,
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

  attachRebuildListeners(updateInputs, queueRebuild)

  controlsMap.modelType.addEventListener('change', () => {
    const nextModelType = controlsMap.modelType.value as ModelType
    const previousModelType = currentModelTypeSelection

    if (previousModelType === 'tag' || previousModelType === 'puzzle') {
      modelDraftByType[previousModelType] = captureConfigFromFormAsModel(previousModelType)
    }

    if (nextModelType === 'tag' || nextModelType === 'puzzle') {
      const nextConfig = normalizeConfigForModel(modelDraftByType[nextModelType], nextModelType)
      applyConfigToForm(nextConfig)
    } else {
      updateModelControlsVisibility()
      syncPuzzleDimensionsInForm()
    }

    currentModelTypeSelection = nextModelType
  })

  controlsMap.width.addEventListener('input', () => {
    syncPuzzleDimensionsInForm()
  })

  controlsMap.width.addEventListener('change', () => {
    syncPuzzleDimensionsInForm()
  })

  const refreshDiceFaceAvailability = (): void => {
    updateAllDiceFaceOptionVisibility()
  }

  controlsMap.diceSize.addEventListener('input', refreshDiceFaceAvailability)
  controlsMap.diceSize.addEventListener('change', refreshDiceFaceAvailability)
  controlsMap.diceSideHoleDiameter.addEventListener('input', refreshDiceFaceAvailability)
  controlsMap.diceSideHoleDiameter.addEventListener('change', refreshDiceFaceAvailability)

  attachDiceFaceToggleHandlers(
    [
      controlsMap.diceFaceTextEnabled1,
      controlsMap.diceFaceTextEnabled2,
      controlsMap.diceFaceTextEnabled3,
      controlsMap.diceFaceTextEnabled4,
      controlsMap.diceFaceTextEnabled5,
      controlsMap.diceFaceTextEnabled6,
    ],
    [
      controlsMap.diceFaceLogoEnabled1,
      controlsMap.diceFaceLogoEnabled2,
      controlsMap.diceFaceLogoEnabled3,
      controlsMap.diceFaceLogoEnabled4,
      controlsMap.diceFaceLogoEnabled5,
      controlsMap.diceFaceLogoEnabled6,
    ],
    updateDiceFaceOptionVisibility,
    queueRebuild,
  )

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
    applySelectedFontChoice(controlsMap.fontChoice.value as FontChoice)
  })

  controlsMap.fontChoiceDice.addEventListener('change', () => {
    applySelectedFontChoice(controlsMap.fontChoiceDice.value as FontChoice)
  })

  controlsMap.languageSelect.addEventListener('change', () => {
    const nextLanguage = controlsMap.languageSelect.value === 'en' ? 'en' : 'pl'
    void setLanguage(nextLanguage)
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

async function start(): Promise<void> {
  const savedPanelWidth = readPanelWidth()
  if (savedPanelWidth !== null) {
    applyPanelWidth(savedPanelWidth)
  }

  const persistedState = readLastState()
  const initialConfig = persistedState ? persistedState.config : defaultConfig
  modelDraftByType = {
    tag: normalizeConfigForModel(initialConfig, 'tag'),
    puzzle: normalizeConfigForModel(initialConfig, 'puzzle'),
  }
  applyConfigToForm(initialConfig)
  currentModelTypeSelection = initialConfig.modelType
  if (persistedState) {
    controlsMap.fontChoice.value = persistedState.fontChoice
    controlsMap.fontChoiceDice.value = persistedState.fontChoice
  }

  wirePanelResize()
  wireEvents()
  await setLanguage(readSavedLanguage(), false)
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

void start()


