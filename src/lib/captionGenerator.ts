import type { ClaudeClient } from './claudeClient'
import type { Settings } from './settings'
import type { GeneratedCaption } from '../types'
import { systemPrompt, userPrompt } from './promptBuilder'
import { applyRules } from './captionRules'

export async function generateCaption(client: ClaudeClient, settings: Settings, base64Frames: string[]): Promise<GeneratedCaption> {
  const raw = await client.generate(base64Frames, systemPrompt(settings), userPrompt())
  return applyRules(raw)
}
