import { expect, test } from 'vitest'
import { parseCaption } from '../responseParser'

test('parses plain json', () => {
  const c = parseCaption('{"title":"Утро","description":"Кофе","topics":["уют"]}')
  expect(c.title).toBe('Утро'); expect(c.topics).toEqual(['уют'])
})
test('parses with code fence', () => {
  const c = parseCaption('```json\n{"title":"t","description":"d","topics":["a"]}\n```')
  expect(c.title).toBe('t')
})
test('throws on garbage', () => {
  expect(() => parseCaption('no json')).toThrow()
})
test('broken JSON becomes a readable bad_response error', () => {
  expect(() => parseCaption('{"title": "t",')).toThrow(/неожиданном формате/)
  expect(() => parseCaption('{"title": "t", oops}')).toThrow(/неожиданном формате/)
})
test('accepts the old "tags" field name as topics', () => {
  expect(parseCaption('{"title":"t","description":"d","tags":["#a"]}').topics).toEqual(['#a'])
})
