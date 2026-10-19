import { expect, test } from 'vitest'
import { generateCaption } from '../captionGenerator'
import { ClaudeError, type ClaudeClient } from '../claudeClient'

const settings = { niche: 'lifestyle', language: 'русский', model: 'm', youtubeChannel: '' }

test('applies rules to client output', async () => {
  const stub: ClaudeClient = { generate: async () => ({ title: 'x'.repeat(200), description: 'd', topics: ['дом','#дом','уют'] }) }
  const out = await generateCaption(stub, settings, ['ZQ=='])
  expect(out.title.length).toBe(100)
  expect(out.topics).toEqual(['дом','уют'])
})
test('propagates error', async () => {
  const stub: ClaudeClient = { generate: async () => { throw new Error('boom') } }
  await expect(generateCaption(stub, settings, [])).rejects.toThrow('boom')
})
test('retries once on a malformed answer', async () => {
  let calls = 0
  const stub: ClaudeClient = { generate: async () => {
    calls++
    if (calls === 1) throw new ClaudeError('bad_response', 'bad')
    return { title: 't', description: 'd', topics: [] }
  } }
  const out = await generateCaption(stub, settings, [])
  expect(out.title).toBe('t')
  expect(calls).toBe(2)
})
test('does not retry other errors', async () => {
  let calls = 0
  const stub: ClaudeClient = { generate: async () => { calls++; throw new ClaudeError('unauthorized', 'no') } }
  await expect(generateCaption(stub, settings, [])).rejects.toMatchObject({ code: 'unauthorized' })
  expect(calls).toBe(1)
})
