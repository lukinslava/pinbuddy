import { expect, test } from 'vitest'
import { captionText, clipboardText } from '../shareService'

test('caption text is title + description, no topics', () => {
  const t = captionText({ title: 'Уют', description: 'Тёплый вечер', topics: ['дом'] })
  expect(t).toBe('Уют\n\nТёплый вечер')
})
test('legacy captions keep their hashtags', () => {
  expect(captionText({ title: 'Уют', description: 'Вечер', topics: [], tags: ['#дом', '#уют'] })).toContain('#дом #уют')
})
test('clipboard text appends the link as the last line', () => {
  expect(clipboardText('Уют\n', ' https://youtu.be/x ')).toBe('Уют\n\nhttps://youtu.be/x')
  expect(clipboardText('Уют', '')).toBe('Уют')
})
