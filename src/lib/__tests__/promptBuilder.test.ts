import { expect, test } from 'vitest'
import { systemPrompt, userPrompt } from '../promptBuilder'

test('system prompt encodes rules', () => {
  const p = systemPrompt({ niche: 'lifestyle', language: 'русский', model: 'm' })
  expect(p).toContain('100'); expect(p).toContain('500')
  expect(p.toLowerCase()).toContain('json')
  expect(p).toContain('русск'); expect(p).toContain('lifestyle')
})
test('user prompt non-empty', () => {
  expect(userPrompt().length).toBeGreaterThan(0)
})
