import type { GeneratedCaption } from '../types'

// Pinterest allows a 100-char title and an 800-char description; we keep the
// description shorter so it reads well and leaves room for edits.
export const TITLE_MAX = 100, DESC_MAX = 500, MAX_TOPICS = 10, TOPIC_MAX = 40

export const clampTitle = (s: string) => [...s.trim()].slice(0, TITLE_MAX).join('')
export const clampDescription = (s: string) => [...s.trim()].slice(0, DESC_MAX).join('')

/** Topics: plain phrases (no #), trimmed, deduped case-insensitively, at most 10. */
export function normalizeTopics(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const topic = [...t.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, TOPIC_MAX).join('')
    const key = topic.toLowerCase()
    if (!topic || seen.has(key)) continue
    seen.add(key)
    out.push(topic)
    if (out.length === MAX_TOPICS) break
  }
  return out
}

export function applyRules(c: GeneratedCaption): GeneratedCaption {
  return { title: clampTitle(c.title), description: clampDescription(c.description), topics: normalizeTopics(c.topics) }
}
