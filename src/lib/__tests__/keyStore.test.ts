import { beforeEach, expect, test } from 'vitest'
import { getApiKey, setApiKey, clearApiKey } from '../keyStore'

beforeEach(() => localStorage.clear())

test('round trips key', () => {
  setApiKey('sk-ant-abc')
  expect(getApiKey()).toBe('sk-ant-abc')
})
test('trims and rejects empty', () => {
  setApiKey('   ')
  expect(getApiKey()).toBeNull()
})
test('clear removes key', () => {
  setApiKey('x'); clearApiKey()
  expect(getApiKey()).toBeNull()
})
