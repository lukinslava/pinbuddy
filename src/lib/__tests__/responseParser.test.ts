import { expect, test } from 'vitest'
import { parseCaption } from '../responseParser'

test('parses plain json', () => {
  const c = parseCaption('{"title":"Утро","description":"Кофе","tags":["#уют"]}')
  expect(c.title).toBe('Утро'); expect(c.tags).toEqual(['#уют'])
})
test('parses with code fence', () => {
  const c = parseCaption('```json\n{"title":"t","description":"d","tags":["#a"]}\n```')
  expect(c.title).toBe('t')
})
test('throws on garbage', () => {
  expect(() => parseCaption('no json')).toThrow()
})
