import type { GeneratedCaption } from '../types'
export const TITLE_MAX = 100, DESC_MAX = 500, MAX_TAGS = 8

export const clampTitle = (s: string) => [...s].slice(0, TITLE_MAX).join('')
export const clampDescription = (s: string) => [...s].slice(0, DESC_MAX).join('')

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = []
  for (const t of raw) {
    const body = t.trim().replace(/#/g, '')
    if (!body) continue
    const tag = '#' + body; const key = tag.toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(tag); if (out.length === MAX_TAGS) break }
  }
  return out
}
export function applyRules(c: GeneratedCaption): GeneratedCaption {
  return { title: clampTitle(c.title), description: clampDescription(c.description), tags: normalizeTags(c.tags) }
}
