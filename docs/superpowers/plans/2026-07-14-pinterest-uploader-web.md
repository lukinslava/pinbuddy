# PinBuddy Web — Pinterest Uploader (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile PWA (React + TypeScript + Vite) that picks photos/short videos from the phone gallery, generates Russian Pinterest-optimized title/description/tags per file via the Claude API (called directly from the browser), lets the user edit them, and hands media to Pinterest via `navigator.share` with the caption pre-copied to the clipboard. Deployed to Cloudflare Pages.

**Architecture:** Pure, unit-tested TypeScript modules for logic (key store, settings, caption rules, prompt builder, response parser, Claude client, caption generator, share text) sit behind small interfaces; thin React components and browser-API services (file input, canvas frame extraction, `navigator.share`) consume them. `ClaudeClient` and the share layer are interface-backed for mocking and future replacement (real Pinterest API).

**Tech Stack:** Vite, React 18, TypeScript, Vitest + @testing-library, Anthropic Messages API (browser direct-access), Web Share API, Clipboard API, Canvas. Hosting: Cloudflare Pages (static). PWA via `vite-plugin-pwa`.

---

## Conventions

- **Project dir:** `/Users/slava/pinterest` (Vite app at repo root).
- **Package manager:** npm.
- **Default model:** `claude-haiku-4-5-20251001` (settings-overridable to a Sonnet id).
- **Test command:** `npm test` → `vitest run`. Watch: `npm run test:watch`.
- **Dev server:** `npm run dev`. Build: `npm run build`. Preview: `npm run preview`.
- **TDD:** for each logic task write the failing test first, run it red, implement minimally, run it green, commit. Browser-API modules and components are verified manually (documented per task) plus jsdom tests where feasible.
- **Commits:** small and frequent; `feat:`/`test:`/`chore:`.

## File Structure

```
index.html
vite.config.ts
tsconfig.json
package.json
public/
  manifest.webmanifest
  icons/ (192,512 png)
src/
  main.tsx                 # React root
  App.tsx                  # nav shell, gates on API key
  types.ts                 # MediaItem, GeneratedCaption, MediaType, Status
  lib/
    keyStore.ts            # localStorage API key
    settings.ts            # niche/language/model in localStorage
    captionRules.ts        # limits + tag normalization (pure)
    promptBuilder.ts       # system/user prompts (pure)
    responseParser.ts      # extract JSON caption from text (pure)
    claudeClient.ts        # ClaudeClient interface + fetch impl
    imageDownscaler.ts     # canvas resize -> base64 jpeg
    frameExtractor.ts      # photo/video -> frames (browser)
    captionGenerator.ts    # orchestration (pure over injected client)
    shareService.ts        # captionText (pure) + share (browser)
  components/
    SettingsView.tsx
    GalleryView.tsx
    CaptionCard.tsx
    ShareSheetFallback.tsx
  styles.css
src/lib/__tests__/
    captionRules.test.ts
    promptBuilder.test.ts
    responseParser.test.ts
    claudeClient.test.ts
    captionGenerator.test.ts
    shareService.test.ts
    keyStore.test.ts
    settings.test.ts
```

---

## Task 0: Scaffold Vite + React + TS + Vitest

**Files:** create the Vite project at repo root, add Vitest.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/slava/pinterest
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D vite-plugin-pwa
```
(When prompted about a non-empty dir because of `docs/`, choose to ignore/continue without overwriting.)

- [ ] **Step 2: Configure Vitest** in `vite.config.ts`

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
})
```
Create `src/test-setup.ts` with `import '@testing-library/jest-dom'`.

- [ ] **Step 3: Add scripts** to `package.json`

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Sanity test** — create `src/lib/__tests__/smoke.test.ts` with `test('smoke', () => expect(1+1).toBe(2))`.

Run: `npm test` → Expected: PASS. Then delete the smoke test.

- [ ] **Step 5: Commit** `chore: scaffold Vite React TS app with Vitest`.

---

## Task 1: Types

**Files:** Create `src/types.ts`.

- [ ] **Step 1: Implement** (no test — plain types)

```ts
export type MediaType = 'photo' | 'video'
export type GenerationStatus =
  | { kind: 'idle' } | { kind: 'generating' }
  | { kind: 'done' } | { kind: 'failed'; message: string }

export interface GeneratedCaption {
  title: string
  description: string
  tags: string[]
}

export interface MediaItem {
  id: string
  type: MediaType
  file: File
  previewUrl: string          // object URL for <img>/<video>
  status: GenerationStatus
  caption?: GeneratedCaption
}
```

- [ ] **Step 2: Build check** `npm run build` (or `npx tsc --noEmit`). Commit `feat: add core types`.

---

## Task 2: keyStore

**Files:** Create `src/lib/keyStore.ts`, test `src/lib/__tests__/keyStore.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, expect, test } from 'vitest'
import { getApiKey, setApiKey, clearApiKey } from '../keyStore'

beforeEach(() => localStorage.clear())

test('round trips key', () => {
  setApiKey('sk-ant-abc')
  expect(getApiKey()).toBe('sk-ant-abc')
})
test('trims and rejects empty', () => {
  setApiKey('   ')
  expect(getApiKey()).toBeNull()
})
test('clear removes key', () => {
  setApiKey('x'); clearApiKey()
  expect(getApiKey()).toBeNull()
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
const KEY = 'pinbuddy.apiKey'
export function setApiKey(value: string): void {
  const v = value.trim()
  if (!v) { localStorage.removeItem(KEY); return }
  localStorage.setItem(KEY, v)
}
export function getApiKey(): string | null {
  const v = localStorage.getItem(KEY)?.trim()
  return v ? v : null
}
export function clearApiKey(): void { localStorage.removeItem(KEY) }
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add keyStore`.

---

## Task 3: settings

**Files:** Create `src/lib/settings.ts`, test `settings.test.ts`.

Defaults: niche `lifestyle`, language `русский`, model `claude-haiku-4-5-20251001`.

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, expect, test } from 'vitest'
import { getSettings, saveSettings, DEFAULT_MODEL } from '../settings'

beforeEach(() => localStorage.clear())

test('defaults', () => {
  const s = getSettings()
  expect(s.niche).toBe('lifestyle')
  expect(s.language).toBe('русский')
  expect(s.model).toBe(DEFAULT_MODEL)
})
test('persists', () => {
  saveSettings({ niche: 'уют', language: 'русский', model: 'm' })
  expect(getSettings().niche).toBe('уют')
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
export interface Settings { niche: string; language: string; model: string }
const KEY = 'pinbuddy.settings'
const DEFAULTS: Settings = { niche: 'lifestyle', language: 'русский', model: DEFAULT_MODEL }

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}
export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add settings store`.

---

## Task 4: captionRules

**Files:** Create `src/lib/captionRules.ts`, test `captionRules.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from 'vitest'
import { clampTitle, clampDescription, normalizeTags, applyRules } from '../captionRules'

test('title clamps to 100', () => {
  expect(clampTitle('а'.repeat(150)).length).toBe(100)
})
test('description clamps to 500', () => {
  expect(clampDescription('b'.repeat(600)).length).toBe(500)
})
test('tags: hash, dedupe, cap 8', () => {
  const out = normalizeTags(['#дом','дом','уют','',' стиль ','a','b','c','d','e','f'])
  expect(out.every(t => t.startsWith('#'))).toBe(true)
  expect(out.length).toBe(8)
  expect(new Set(out).size).toBe(out.length)
})
test('applyRules composes', () => {
  const c = applyRules({ title:'т'.repeat(200), description:'d', tags:['дом','#дом'] })
  expect(c.title.length).toBe(100)
  expect(c.tags).toEqual(['#дом'])
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { GeneratedCaption } from '../types'
export const TITLE_MAX = 100, DESC_MAX = 500, MAX_TAGS = 8

export const clampTitle = (s: string) => [...s].slice(0, TITLE_MAX).join('')
export const clampDescription = (s: string) => [...s].slice(0, DESC_MAX).join('')

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = []
  for (const t of raw) {
    const body = t.trim().replace(/#/g, '')
    if (!body) continue
    const tag = '#' + body; const key = tag.toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(tag); if (out.length === MAX_TAGS) break }
  }
  return out
}
export function applyRules(c: GeneratedCaption): GeneratedCaption {
  return { title: clampTitle(c.title), description: clampDescription(c.description), tags: normalizeTags(c.tags) }
}
```
(Note: `clampTitle` uses spread to count code points, so `.length` on Cyrillic still equals 100 chars.)

- [ ] **Step 4: Run — PASS.** Commit `feat: add captionRules (Pinterest limits)`.

---

## Task 5: promptBuilder

**Files:** Create `src/lib/promptBuilder.ts`, test `promptBuilder.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from 'vitest'
import { systemPrompt, userPrompt } from '../promptBuilder'

test('system prompt encodes rules', () => {
  const p = systemPrompt({ niche: 'lifestyle', language: 'русский', model: 'm' })
  expect(p).toContain('100'); expect(p).toContain('500')
  expect(p.toLowerCase()).toContain('json')
  expect(p).toContain('русск'); expect(p).toContain('lifestyle')
})
test('user prompt non-empty', () => {
  expect(userPrompt().length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Settings } from './settings'
export function systemPrompt(s: Settings): string {
  return `Ты — эксперт по контенту для Pinterest в нише «${s.niche}».
По приложенным изображениям (кадрам фото или видео) сгенерируй привлекательный пин на языке: ${s.language}.

Требования:
- Заголовок (title): цепляющий, с ключевым словом, не длиннее 100 символов.
- Описание (description): естественный текст с 2–3 релевантными ключевыми словами для поиска Pinterest, не длиннее 500 символов, тёплый вдохновляющий тон в стиле lifestyle.
- Теги (tags): 3–8 релевантных хэштегов без переспама.
- Соблюдай политику Pinterest: без спама, без запрещённых/чувствительных тем, без вводящих в заблуждение заявлений.

Ответь СТРОГО валидным JSON без markdown и пояснений:
{"title": "...", "description": "...", "tags": ["#...", "#..."]}`
}
export const userPrompt = () => 'Проанализируй изображения и верни JSON для пина.'
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add promptBuilder`.

---

## Task 6: responseParser

**Files:** Create `src/lib/responseParser.ts`, test `responseParser.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from 'vitest'
import { parseCaption } from '../responseParser'

test('parses plain json', () => {
  const c = parseCaption('{"title":"Утро","description":"Кофе","tags":["#уют"]}')
  expect(c.title).toBe('Утро'); expect(c.tags).toEqual(['#уют'])
})
test('parses with code fence', () => {
  const c = parseCaption('```json\n{"title":"t","description":"d","tags":["#a"]}\n```')
  expect(c.title).toBe('t')
})
test('throws on garbage', () => {
  expect(() => parseCaption('no json')).toThrow()
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { GeneratedCaption } from '../types'
export function parseCaption(text: string): GeneratedCaption {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in response')
  const obj = JSON.parse(text.slice(start, end + 1))
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string' || !Array.isArray(obj.tags))
    throw new Error('Malformed caption JSON')
  return { title: obj.title, description: obj.description, tags: obj.tags.map(String) }
}
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add responseParser`.

---

## Task 7: claudeClient

**Files:** Create `src/lib/claudeClient.ts`, test `claudeClient.test.ts`.

Interface + fetch impl. Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, `anthropic-dangerous-direct-browser-access: true`. Body has `model`, `max_tokens`, `system`, one user message with image blocks (base64 jpeg) + a text block.

- [ ] **Step 1: Failing test (mock global fetch)**

```ts
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
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
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
    } catch (e) { throw new ClaudeError('bad_response', 'Сеть недоступна') }

    if (resp.status === 401) throw new ClaudeError('unauthorized', 'Проверьте API-ключ')
    if (resp.status === 429) throw new ClaudeError('rate_limited', 'Слишком много запросов, попробуйте позже')
    if (!resp.ok) throw new ClaudeError('http', `Ошибка API: ${resp.status}`)

    const json = await resp.json() as { content?: { type: string; text?: string }[] }
    const text = json.content?.find(b => b.type === 'text')?.text
    if (!text) throw new ClaudeError('bad_response', 'Пустой ответ модели')
    return parseCaption(text)
  }
}
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add claudeClient (browser direct)`.

---

## Task 8: captionGenerator

**Files:** Create `src/lib/captionGenerator.ts`, test `captionGenerator.test.ts`.

- [ ] **Step 1: Failing test (stub client)**

```ts
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
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { ClaudeClient } from './claudeClient'
import type { Settings } from './settings'
import type { GeneratedCaption } from '../types'
import { systemPrompt, userPrompt } from './promptBuilder'
import { applyRules } from './captionRules'

export async function generateCaption(client: ClaudeClient, settings: Settings, base64Frames: string[]): Promise<GeneratedCaption> {
  const raw = await client.generate(base64Frames, systemPrompt(settings), userPrompt())
  return applyRules(raw)
}
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add captionGenerator orchestration`.

---

## Task 9: shareService (captionText tested; share manual)

**Files:** Create `src/lib/shareService.ts`, test `shareService.test.ts`.

- [ ] **Step 1: Failing test for captionText**

```ts
import { expect, test } from 'vitest'
import { captionText } from '../shareService'

test('composes title/description/tags', () => {
  const t = captionText({ title: 'Уют', description: 'Тёплый вечер', tags: ['#дом','#уют'] })
  expect(t).toContain('Уют'); expect(t).toContain('Тёплый вечер'); expect(t).toContain('#дом #уют')
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { GeneratedCaption } from '../types'

export function captionText(c: GeneratedCaption): string {
  return [c.title, c.description, c.tags.join(' ')].filter(Boolean).join('\n\n')
}

/** Copies caption to clipboard and opens the OS share sheet with the media file. */
export async function shareToPinterest(caption: GeneratedCaption, file: File): Promise<'shared'|'copied'|'unsupported'> {
  const text = captionText(caption)
  try { await navigator.clipboard.writeText(text) } catch { /* non-fatal */ }

  const canFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (navigator.share && canFiles) {
    try { await navigator.share({ files: [file], text }); return 'shared' }
    catch { return 'copied' } // user cancelled or share failed; text is on clipboard
  }
  return 'unsupported' // caller shows fallback (download + open Pinterest)
}
```

- [ ] **Step 4: Run — PASS.** Commit `feat: add shareService`.

---

## Task 10: imageDownscaler + frameExtractor (browser; manual verify)

**Files:** Create `src/lib/imageDownscaler.ts`, `src/lib/frameExtractor.ts`.

These use canvas/`<video>` — verify in the running app (Task 12), not jsdom.

- [ ] **Step 1: Implement imageDownscaler**

```ts
export async function fileToBase64Jpeg(source: Blob, maxDim = 1024, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > maxDim ? maxDim / longest : 1
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.split(',')[1] // strip "data:image/jpeg;base64,"
}
```

- [ ] **Step 2: Implement frameExtractor**

```ts
import { fileToBase64Jpeg } from './imageDownscaler'

export async function framesFromPhoto(file: File): Promise<string[]> {
  return [await fileToBase64Jpeg(file)]
}

export async function framesFromVideo(file: File, maxFrames = 3): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url; video.muted = true; (video as any).playsInline = true
  await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(new Error('video load failed')) })
  const dur = video.duration || 0
  const stops = [0, dur / 2, Math.max(0, dur - 0.2)].slice(0, maxFrames)
  const out: string[] = []
  for (const t of stops) {
    await new Promise<void>((res) => { video.onseeked = () => res(); video.currentTime = t })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.7))
    out.push(await fileToBase64Jpeg(blob))
  }
  URL.revokeObjectURL(url)
  return out
}

export function framesFromFile(file: File): Promise<string[]> {
  return file.type.startsWith('video') ? framesFromVideo(file) : framesFromPhoto(file)
}
```

- [ ] **Step 3: Build check** `npx tsc --noEmit`. Commit `feat: add canvas downscaler and frame extractor`.

---

## Task 11: React components + wiring (manual verify)

**Files:** Create `src/App.tsx`, `src/components/SettingsView.tsx`, `GalleryView.tsx`, `CaptionCard.tsx`, `ShareSheetFallback.tsx`, `src/styles.css`; update `src/main.tsx`.

- [ ] **Step 1: `App.tsx`** — simple two-view state (`gallery` | `settings`); if `getApiKey()` is null, show a banner on gallery linking to settings.

- [ ] **Step 2: `SettingsView.tsx`** — masked input (`type="password"`) for the key → `setApiKey`; niche text input, model select (Haiku default / a Sonnet id); Save persists via `saveSettings`.

- [ ] **Step 3: `GalleryView.tsx`** — `<input type="file" accept="image/*,video/*" multiple>`; on change build `MediaItem[]` (object URLs, type from MIME); "Сгенерировать все" runs generation sequentially; render a `CaptionCard` per item.

- [ ] **Step 4: Generation wiring** — per item: set `generating`; `framesFromFile(file)` → `new FetchClaudeClient(getApiKey()!, settings.model)` → `generateCaption(...)`; set `done` + caption or `failed` + message. If no key: set `failed` with a "добавьте ключ" message.

- [ ] **Step 5: `CaptionCard.tsx`** — thumbnail (`<img>`/`<video>`), status, editable title (input, counter vs 100), description (textarea, counter vs 500), tags (input), "Сгенерировать"/"Повторить", "Опубликовать" → `shareToPinterest`; if it returns `'unsupported'`, show `ShareSheetFallback` (download link + "Открыть Pinterest" via `https://www.pinterest.com`), caption already on clipboard.

- [ ] **Step 6: Manual verification** — `npm run dev`, open the printed URL:
  - On desktop: pick an image, generate with a real key, confirm Russian caption within limits, edit a field. (Share may be `unsupported` on desktop → fallback path shows; that's expected.)
  - Confirm no-key banner and error states (wrong key → "Проверьте ключ").
  - Later, real-device check in mobile Safari for the share/gallery/video paths.

- [ ] **Step 7: Commit** `feat: add React UI and wire end-to-end flow`.

---

## Task 12: PWA install + polish

**Files:** `public/manifest.webmanifest`, icons, `vite.config.ts` (vite-plugin-pwa), `index.html` meta.

- [ ] **Step 1: Add manifest** (name "PinBuddy", `display: standalone`, theme colors, 192/512 icons).
- [ ] **Step 2: Configure `vite-plugin-pwa`** with `registerType: 'autoUpdate'` and a minimal precache of the app shell.
- [ ] **Step 3: Add iOS meta** in `index.html`: `apple-mobile-web-app-capable`, `apple-touch-icon`, viewport.
- [ ] **Step 4: Verify** `npm run build && npm run preview`; on iPhone Safari → Share → "На экран „Домой“" → launches standalone.
- [ ] **Step 5: Commit** `feat: add PWA manifest and installability`.

---

## Task 13: Deploy to Cloudflare Pages (manual)

- [ ] Push the repo to GitHub (or use `wrangler pages`).
- [ ] Cloudflare dashboard → Pages → Connect repo → Framework preset: Vite → Build command `npm run build`, output dir `dist`.
- [ ] Deploy → get the `*.pages.dev` URL.
- [ ] Open on the girlfriend's iPhone in Safari → Settings → paste your Claude API key once → "На экран „Домой“".
- [ ] Set a spend limit and a dedicated key in the Anthropic Console.

---

## Notes / Deferred (spec §10)

- Auto-publish via Pinterest API v5 deferred; `shareService` is the seam a future `pinterestApiClient` can replace behind a shared interface.
- If Web Share for video is unreliable on the target iOS version, default video to the fallback (download + open Pinterest) path.
- Optional Cloudflare Worker proxy to hide the key if the app ever goes beyond personal use.
- Confirm current Anthropic model id/pricing; model id lives in settings for easy updates.
