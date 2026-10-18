import { ClaudeError, type ClaudeClient } from './claudeClient'
import type { Settings } from './settings'
import type { GeneratedCaption } from '../types'
import { systemPrompt, userPrompt } from './promptBuilder'
import { applyRules } from './captionRules'

export async function generateCaption(client: ClaudeClient, settings: Settings, base64Frames: string[]): Promise<GeneratedCaption> {
  const system = systemPrompt(settings), user = userPrompt()
  let raw: GeneratedCaption
  try {
    raw = await client.generate(base64Frames, system, user)
  } catch (err) {
    // A malformed answer is usually a one-off; retry once before surfacing it.
    if (!(err instanceof ClaudeError && err.code === 'bad_response')) throw err
    raw = await client.generate(base64Frames, system, user)
  }
  return applyRules(raw)
}
