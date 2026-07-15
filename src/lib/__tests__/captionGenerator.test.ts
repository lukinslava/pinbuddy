import { expect, test } from 'vitest'
import { generateCaption } from '../captionGenerator'
import type { ClaudeClient } from '../claudeClient'

const settings = { niche: 'lifestyle', language: 'русский', model: 'm' }

test('applies rules to client output', async () => {
  const stub: ClaudeClient = { generate: async () => ({ title: 'x'.repeat(200), description: 'd', tags: ['дом','#дом','уют'] }) }
  const out = await generateCaption(stub, settings, ['ZQ=='])
  expect(out.title.length).toBe(100)
  expect(out.tags).toEqual(['#дом','#уют'])
})
test('propagates error', async () => {
  const stub: ClaudeClient = { generate: async () => { throw new Error('boom') } }
  await expect(generateCaption(stub, settings, [])).rejects.toThrow('boom')
})
