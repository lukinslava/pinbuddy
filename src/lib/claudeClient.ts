import type { GeneratedCaption } from '../types'
import { ClaudeError } from './claudeError'
import { parseCaption } from './responseParser'

export { ClaudeError } from './claudeError'

export interface ClaudeClient {
  generate(base64Frames: string[], system: string, user: string): Promise<GeneratedCaption>
}

const TIMEOUT_MS = 60_000

export class FetchClaudeClient implements ClaudeClient {
  private apiKey: string
  private model: string
  private maxTokens: number
  private timeoutMs: number

  constructor(apiKey: string, model: string, maxTokens = 600, timeoutMs = TIMEOUT_MS) {
    this.apiKey = apiKey
    this.model = model
    this.maxTokens = maxTokens
    this.timeoutMs = timeoutMs
  }

  async generate(frames: string[], system: string, user: string): Promise<GeneratedCaption> {
    const content = [
      ...frames.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
      { type: 'text', text: user },
    ]
    // Without a deadline a stalled mobile connection leaves the card on
    // "Генерация..." forever.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
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
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) throw new ClaudeError('timeout', 'Claude не ответил за\u00a0минуту. Попробуйте ещё раз')
      throw new ClaudeError('network', 'Не удалось связаться с\u00a0Claude. Проверьте интернет')
    } finally {
      clearTimeout(timer)
    }

    if (resp.status === 401) throw new ClaudeError('unauthorized', 'Ключ Claude не подошёл. Проверьте его в\u00a0настройках')
    if (resp.status === 429) throw new ClaudeError('rate_limited', 'Слишком много запросов. Попробуйте через минуту')
    if (!resp.ok) {
      let detail = ''
      try {
        const err = await resp.json() as { error?: { message?: string } }
        detail = err?.error?.message ?? ''
      } catch {
        /* body wasn't JSON — leave detail empty */
      }
      if (resp.status >= 500) throw new ClaudeError('http', `Claude временно недоступен, код ${resp.status}. Попробуйте позже`)
      throw new ClaudeError('http', `Ошибка API ${resp.status}${detail ? `: ${detail}` : ''}`)
    }

    let json: { content?: { type: string; text?: string }[] }
    try {
      json = await resp.json()
    } catch {
      throw new ClaudeError('bad_response', 'Не удалось прочитать ответ Claude. Попробуйте ещё раз')
    }
    const text = json.content?.find(b => b.type === 'text')?.text
    if (!text) throw new ClaudeError('bad_response', 'Claude вернул пустой ответ. Попробуйте ещё раз')
    return parseCaption(text)
  }
}
