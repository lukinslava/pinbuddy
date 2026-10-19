import { expect, test } from 'vitest'
import { clampTitle, clampDescription, normalizeTopics, applyRules } from '../captionRules'

test('title clamps to 100', () => {
  expect(clampTitle('а'.repeat(150)).length).toBe(100)
})
test('description clamps to 500', () => {
  expect(clampDescription('b'.repeat(600)).length).toBe(500)
})
test('topics: strip #, dedupe case-insensitively, cap 10', () => {
  const out = normalizeTopics(['#уют дома', 'Уют дома', '', '  кофе  ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
  expect(out[0]).toBe('уют дома')
  expect(out[1]).toBe('кофе')
  expect(out.some((t) => t.includes('#'))).toBe(false)
  expect(out.length).toBe(10)
})
test('applyRules composes', () => {
  const c = applyRules({ title: 'т'.repeat(200), description: ' d ', topics: ['дом', '#дом'] })
  expect(c.title.length).toBe(100)
  expect(c.description).toBe('d')
  expect(c.topics).toEqual(['дом'])
})
