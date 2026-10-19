import { expect, test } from 'vitest'
import { cleanLink } from '../link'

test('drops YouTube share tracking and utm params', () => {
  expect(cleanLink(' https://youtube.com/@fedoravanastasiia?si=E__uwYsWU1ximn8X ')).toBe('https://youtube.com/@fedoravanastasiia')
  expect(cleanLink('https://youtu.be/abc?si=x&t=42')).toBe('https://youtu.be/abc?t=42')
  expect(cleanLink('https://www.youtube.com/watch?v=abc&utm_source=pin&feature=share')).toBe('https://www.youtube.com/watch?v=abc')
})
test('adds https to bare links, leaves empty as empty', () => {
  expect(cleanLink('youtube.com/@me')).toBe('https://youtube.com/@me')
  expect(cleanLink('  ')).toBe('')
})
