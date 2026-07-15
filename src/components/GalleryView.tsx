import { useState, type ChangeEvent } from 'react'
import type { GeneratedCaption, MediaItem } from '../types'
import { getApiKey } from '../lib/keyStore'
import { getSettings } from '../lib/settings'
import { FetchClaudeClient } from '../lib/claudeClient'
import { generateCaption } from '../lib/captionGenerator'
import { framesFromFile } from '../lib/frameExtractor'
import { clampTitle, clampDescription, normalizeTags } from '../lib/captionRules'
import CaptionCard from './CaptionCard'

function mediaItemFromFile(file: File): MediaItem {
  return {
    id: crypto.randomUUID(),
    type: file.type.startsWith('video') ? 'video' : 'photo',
    file,
    previewUrl: URL.createObjectURL(file),
    status: { kind: 'idle' },
  }
}

export default function GalleryView() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [generatingAll, setGeneratingAll] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newItems = Array.from(files).map(mediaItemFromFile)
    setItems((prev) => [...prev, ...newItems])
    e.target.value = ''
  }

  function updateItem(id: string, patch: Partial<MediaItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function updateCaption(id: string, patch: Partial<GeneratedCaption>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id && it.caption ? { ...it, caption: { ...it.caption, ...patch } } : it)),
    )
  }

  async function generateOne(item: MediaItem) {
    const apiKey = getApiKey()
    if (!apiKey) {
      updateItem(item.id, { status: { kind: 'failed', message: 'Добавьте API-ключ в настройках' } })
      return
    }
    updateItem(item.id, { status: { kind: 'generating' } })
    try {
      const settings = getSettings()
      const frames = await framesFromFile(item.file)
      const client = new FetchClaudeClient(apiKey, settings.model)
      const caption = await generateCaption(client, settings, frames)
      updateItem(item.id, { status: { kind: 'done' }, caption })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сгенерировать подпись'
      updateItem(item.id, { status: { kind: 'failed', message } })
    }
  }

  async function generateOneById(id: string) {
    const item = items.find((it) => it.id === id)
    if (item) await generateOne(item)
  }

  async function generateAll() {
    setGeneratingAll(true)
    const targets = items.filter((it) => it.status.kind === 'idle' || it.status.kind === 'failed')
    try {
      for (const item of targets) {
        // eslint-disable-next-line no-await-in-loop -- sequential by design, avoid hammering the API
        await generateOne(item)
      }
    } finally {
      setGeneratingAll(false)
    }
  }

  return (
    <div className="gallery-view">
      <h1>Галерея</h1>

      <div className="gallery-controls">
        <label className="file-picker">
          Выбрать фото/видео
          <input type="file" accept="image/*,video/*" multiple onChange={handleFileChange} />
        </label>
        <button type="button" onClick={generateAll} disabled={items.length === 0 || generatingAll}>
          {generatingAll ? 'Генерация...' : 'Сгенерировать все'}
        </button>
      </div>

      {items.length === 0 && <p className="empty-state">Добавьте фото или видео, чтобы начать.</p>}

      <ul className="caption-card-list">
        {items.map((item) => (
          <CaptionCard
            key={item.id}
            item={item}
            onGenerate={generateOneById}
            onEditTitle={(id, title) => updateCaption(id, { title: clampTitle(title) })}
            onEditDescription={(id, description) => updateCaption(id, { description: clampDescription(description) })}
            onEditTags={(id, tags) => updateCaption(id, { tags: normalizeTags(tags) })}
          />
        ))}
      </ul>
    </div>
  )
}
