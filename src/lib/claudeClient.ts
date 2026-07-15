import type { GeneratedCaption } from '../types'
import { parseCaption } from './responseParser'

export class ClaudeError extends Error {
  constructor(public code: 'unauthorized'|'rate_limited'|'http'|'bad_response', msg: string) {
    super(msg); this.name = 'ClaudeError'
  }
}
export interface ClaudeClient {
  generate(base64Frames: string[], system: string, user: string): Promise<GeneratedCaption>
}

export class FetchClaudeClient implements ClaudeClient {
  constructor(private apiKey: string, private model: string, private maxTokens = 600) {}
  async generate(frames: string[], system: string, user: string): Promise<GeneratedCaption> {
    const content = [
      ...frames.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
      { type: 'text', text: user },
    ]
    let resp: Response
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: this.model, max_tokens: this.maxTokens, system, messages: [{ role: 'user', content }] }),
      })
    } catch {
      throw new ClaudeError('bad_response', 'Сеть недоступна')
    }

    if (resp.status === 401) throw new ClaudeError('unauthorized', 'Проверьте API-ключ')
    if (resp.status === 429) throw new ClaudeError('rate_limited', 'Слишком много запросов, попробуйте позже')
    if (!resp.ok) throw new ClaudeError('http', `Ошибка API: ${resp.status}`)

    const json = await resp.json() as { content?: { type: string; text?: string }[] }
    const text = json.content?.find(b => b.type === 'text')?.text
    if (!text) throw new ClaudeError('bad_response', 'Пустой ответ модели')
    return parseCaption(text)
  }
}
