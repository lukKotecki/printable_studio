import type { LanguageCode } from '../config/app-config'

export type TranslationVars = Record<string, string | number>

export function interpolateTemplate(template: string, vars: TranslationVars = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

export function translate(
  translations: Record<string, string>,
  key: string,
  vars: TranslationVars = {},
  fallback?: string,
): string {
  return interpolateTemplate(translations[key] ?? fallback ?? key, vars)
}

export async function loadLocale(
  language: LanguageCode,
  cache: Partial<Record<LanguageCode, Record<string, string>>>,
): Promise<Record<string, string>> {
  const cached = cache[language]
  if (cached) {
    return cached
  }

  const response = await fetch(`/locales/${language}.xml`)
  if (!response.ok) {
    throw new Error(`Failed to load locale: ${language}`)
  }

  const xmlText = await response.text()
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parsed: Record<string, string> = {}

  xml.querySelectorAll('entry[key]').forEach((entry) => {
    const key = entry.getAttribute('key')
    if (!key) {
      return
    }
    parsed[key] = entry.textContent?.trim() ?? ''
  })

  cache[language] = parsed
  return parsed
}

export function setText(
  selector: string,
  key: string,
  fallback: string,
  translateFn: (key: string, vars?: TranslationVars, fallback?: string) => string,
): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (element) {
    element.textContent = translateFn(key, {}, fallback)
  }
}

export function setNthText(
  selector: string,
  index: number,
  key: string,
  fallback: string,
  translateFn: (key: string, vars?: TranslationVars, fallback?: string) => string,
): void {
  const element = document.querySelectorAll<HTMLElement>(selector)[index]
  if (element) {
    element.textContent = translateFn(key, {}, fallback)
  }
}

export function setAttr(
  selector: string,
  attribute: string,
  key: string,
  fallback: string,
  translateFn: (key: string, vars?: TranslationVars, fallback?: string) => string,
): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (element) {
    element.setAttribute(attribute, translateFn(key, {}, fallback))
  }
}
