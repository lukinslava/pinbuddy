import { beforeEach, expect, test } from 'vitest'
import { getSettings, saveSettings, DEFAULT_MODEL } from '../settings'

beforeEach(() => localStorage.clear())

test('defaults', () => {
  const s = getSettings()
  expect(s.niche).toBe('lifestyle')
  expect(s.language).toBe('русский')
  expect(s.model).toBe(DEFAULT_MODEL)
})
test('persists', () => {
  saveSettings({ niche: 'уют', language: 'русский', model: 'm' })
  expect(getSettings().niche).toBe('уют')
})
