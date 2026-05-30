import type { LanguageCode, PersistedAppState, TagConfig } from '../config/app-config'

export function readSavedLanguage(languageStorageKey: string, defaultLanguage: LanguageCode): LanguageCode {
  try {
    const raw = localStorage.getItem(languageStorageKey)
    return raw === 'en' ? 'en' : defaultLanguage
  } catch {
    return defaultLanguage
  }
}

export function saveLanguage(languageStorageKey: string, language: LanguageCode): void {
  localStorage.setItem(languageStorageKey, language)
}

export function readPanelWidth(
  panelWidthStorageKey: string,
  clamp: (value: number, min: number, max: number) => number,
): number | null {
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

export function savePanelWidth(
  panelWidthStorageKey: string,
  width: number,
  clamp: (value: number, min: number, max: number) => number,
): void {
  localStorage.setItem(panelWidthStorageKey, String(Math.round(clamp(width, 300, 760))))
}

export function readPresets(presetsStorageKey: string): Record<string, TagConfig> {
  try {
    const raw = localStorage.getItem(presetsStorageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, TagConfig>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function writePresets(presetsStorageKey: string, presets: Record<string, TagConfig>): void {
  localStorage.setItem(presetsStorageKey, JSON.stringify(presets))
}

export function readLastState(lastStateStorageKey: string): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(lastStateStorageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PersistedAppState
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveLastState(lastStateStorageKey: string, state: PersistedAppState): void {
  localStorage.setItem(lastStateStorageKey, JSON.stringify(state))
}
