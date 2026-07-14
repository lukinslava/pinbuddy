export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
export interface Settings { niche: string; language: string; model: string }
const KEY = 'pinbuddy.settings'
const DEFAULTS: Settings = { niche: 'lifestyle', language: 'русский', model: DEFAULT_MODEL }

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}
export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
