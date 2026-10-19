import { expect, test } from 'vitest'
import { systemPrompt, userPrompt } from '../promptBuilder'

const base = { niche: 'lifestyle', language: 'русский', model: 'm', youtubeChannel: '' }

test('system prompt encodes rules', () => {
  const p = systemPrompt(base)
  expect(p).toContain('100'); expect(p).toContain('450')
  expect(p).toContain('"topics"'); expect(p).toContain('хэштеги')
  expect(p.toLowerCase()).toContain('json')
  expect(p).toContain('русск'); expect(p).toContain('lifestyle')
})
test('YouTube call to action only when a channel is set', () => {
  expect(systemPrompt(base)).not.toContain('YouTube')
  expect(systemPrompt({ ...base, youtubeChannel: 'https://youtube.com/@me' })).toContain('YouTube')
})
test('user prompt says whether frames are from a video', () => {
  expect(userPrompt('video')).toContain('видео')
  expect(userPrompt('photo')).toContain('фото')
})
