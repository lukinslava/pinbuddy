import type { GeneratedCaption } from '../types'
import { ClaudeError } from './claudeError'

const BAD = 'Claude ответил в\u00a0неожиданном формате. Попробуйте ещё раз'

export function parseCaption(text: string): GeneratedCaption {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new ClaudeError('bad_response', BAD)
  let obj: { title?: unknown; description?: unknown; tags?: unknown }
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new ClaudeError('bad_response', BAD)
  }
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string' || !Array.isArray(obj.tags))
    throw new ClaudeError('bad_response', BAD)
  return { title: obj.title, description: obj.description, tags: obj.tags.map(String) }
}
