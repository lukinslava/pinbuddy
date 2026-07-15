import type { GeneratedCaption } from '../types'

export function parseCaption(text: string): GeneratedCaption {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in response')
  const obj = JSON.parse(text.slice(start, end + 1))
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string' || !Array.isArray(obj.tags))
    throw new Error('Malformed caption JSON')
  return { title: obj.title, description: obj.description, tags: obj.tags.map(String) }
}
