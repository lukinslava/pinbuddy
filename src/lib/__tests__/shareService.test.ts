import { expect, test } from 'vitest'
import { captionText } from '../shareService'

test('composes title/description/tags', () => {
  const t = captionText({ title: 'Уют', description: 'Тёплый вечер', tags: ['#дом','#уют'] })
  expect(t).toContain('Уют'); expect(t).toContain('Тёплый вечер'); expect(t).toContain('#дом #уют')
})
