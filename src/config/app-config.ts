export type ModelType = 'tag' | 'dice' | 'puzzle'
export type TagShape = 'rounded' | 'capsule' | 'circle' | 'puzzle'
export type LanguageCode = 'pl' | 'en'
export type FontChoice =
  | 'helvetiker'
  | 'optimer'
  | 'gentilis'
  | 'droidSans'
  | 'droidSerif'
  | 'notoSansPl'
  | 'notoSerifPl'
  | 'custom'

export interface TagConfig {
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
  holeOffsetX: number
  holeOffsetY: number
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
  logoOffsetX: number
  logoOffsetY: number
  logoRotation: number
  backLogoEnabled: boolean
  backLogoSize: number
  backLogoDepth: number
  backLogoOffsetX: number
  backLogoOffsetY: number
  backLogoRotation: number
}

export const maxTextLines = 4
export const maxCharsPerLine = 18
export const textLineSpacingFactor = 1.2

export const defaultConfig: TagConfig = {
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
  holeOffsetX: 0,
  holeOffsetY: 0,
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
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoRotation: 0,
  backLogoEnabled: false,
  backLogoSize: 8,
  backLogoDepth: 0.8,
  backLogoOffsetX: 0,
  backLogoOffsetY: 0,
  backLogoRotation: 0,
}

export const presetsStorageKey = 'printable-studio-presets-v1'
export const lastStateStorageKey = 'printable-studio-last-state-v1'
export const panelWidthStorageKey = 'printable-studio-panel-width-v1'
export const languageStorageKey = 'printable-studio-language-v1'

export const defaultFontChoice: Exclude<FontChoice, 'custom'> = 'helvetiker'
export const defaultLanguage: LanguageCode = 'pl'

export interface PersistedAppState {
  config: TagConfig
  fontChoice: Exclude<FontChoice, 'custom'>
}

export const builtinFontUrls: Record<Exclude<FontChoice, 'custom'>, string> = {
  helvetiker: '/fonts/helvetiker_regular.typeface.json',
  optimer: '/fonts/optimer_regular.typeface.json',
  gentilis: '/fonts/gentilis_regular.typeface.json',
  droidSans: '/fonts/droid/droid_sans_regular.typeface.json',
  droidSerif: '/fonts/droid/droid_serif_regular.typeface.json',
  notoSansPl: '/fonts/pl/noto_sans_regular.typeface.json',
  notoSerifPl: '/fonts/pl/noto_serif_regular.typeface.json',
}

export const polishGlyphFallback: Record<string, string> = {
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
