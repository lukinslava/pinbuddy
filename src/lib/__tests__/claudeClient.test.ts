import { afterEach, expect, test, vi } from 'vitest'
import { FetchClaudeClient, ClaudeError } from '../claudeClient'

afterEach(() => vi.restoreAllMocks())

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify(body), { status })))
}

test('returns parsed caption on 200', async () => {
  mockFetch(200, { content: [{ type: 'text', text: '{"title":"T","description":"D","tags":["#a"]}' }] })
  const c = new FetchClaudeClient('key', 'model')
  const cap = await c.generate(['ZmFrZQ=='], 'sys', 'usr')
  expect(cap.title).toBe('T')
})
test('maps 401', async () => {
  mockFetch(401, {})
  const c = new FetchClaudeClient('bad', 'model')
  await expect(c.generate([], 's', 'u')).rejects.toMatchObject({ code: 'unauthorized' })
})
test('maps 429', async () => {
  mockFetch(429, {})
  const c = new FetchClaudeClient('k', 'model')
  await expect(c.generate([], 's', 'u')).rejects.toMatchObject({ code: 'rate_limited' })
})
