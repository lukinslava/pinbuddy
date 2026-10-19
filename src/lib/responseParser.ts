import type { GeneratedCaption } from '../types'
import { ClaudeError } from './claudeError'

const BAD = 'Claude ответил в\u00a0неожиданном формате. Попробуйте ещё раз'

export function parseCaption(text: string): GeneratedCaption {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new ClaudeError('bad_response', BAD)
  let obj: { title?: unknown; description?: unknown; topics?: unknown; tags?: unknown }
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new ClaudeError('bad_response', BAD)
  }
  // Accept "tags" too, in case the model falls back to the old field name.
  const topics = Array.isArray(obj.topics) ? obj.topics : Array.isArray(obj.tags) ? obj.tags : null
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string' || !topics)
    throw new ClaudeError('bad_response', BAD)
  return { title: obj.title, description: obj.description, topics: topics.map(String) }
}
