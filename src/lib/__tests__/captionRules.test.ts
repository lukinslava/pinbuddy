import { expect, test } from 'vitest'
import { clampTitle, clampDescription, normalizeTags, applyRules } from '../captionRules'

test('title clamps to 100', () => {
  expect(clampTitle('а'.repeat(150)).length).toBe(100)
})
test('description clamps to 500', () => {
  expect(clampDescription('b'.repeat(600)).length).toBe(500)
})
test('tags: hash, dedupe, cap 8', () => {
  const out = normalizeTags(['#дом','дом','уют','',' стиль ','a','b','c','d','e','f'])
  expect(out.every(t => t.startsWith('#'))).toBe(true)
  expect(out.length).toBe(8)
  expect(new Set(out).size).toBe(out.length)
})
test('applyRules composes', () => {
  const c = applyRules({ title:'т'.repeat(200), description:'d', tags:['дом','#дом'] })
  expect(c.title.length).toBe(100)
  expect(c.tags).toEqual(['#дом'])
})
