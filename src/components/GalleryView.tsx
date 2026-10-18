import { useEffect, useState, type ChangeEvent } from 'react'
import type { MediaItem } from '../types'
import { getApiKey } from '../lib/keyStore'
import { getSettings } from '../lib/settings'
import { FetchClaudeClient } from '../lib/claudeClient'
import { generateCaption } from '../lib/captionGenerator'
import { framesFromFile } from '../lib/frameExtractor'
import { captionText } from '../lib/shareService'
import { deleteItems, loadItems, saveFile, saveItems } from '../lib/mediaStore'
import CaptionCard from './CaptionCard'

function mediaItemFromFile(file: File): MediaItem {
  return {
    id: crypto.randomUUID(),
    type: file.type.startsWith('video') ? 'video' : 'photo',
    file,
    previewUrl: URL.createObjectURL(file),
    status: { kind: 'idle' },
    text: '',
    published: false,
    createdAt: Date.now(),
  }
}

export default function GalleryView() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [generatingAll, setGeneratingAll] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState(false)

  // Restore the gallery saved on this device. Files picked before loading
  // finishes are kept after the restored ones.
  useEffect(() => {
    let cancelled = false
    loadItems()
      .then((saved) => {
        if (cancelled) return
        const savedIds = new Set(saved.map((it) => it.id))
        setItems((prev) => [...saved, ...prev.filter((it) => !savedIds.has(it.id))])
      })
      .catch(() => {
        if (!cancelled) setStorageError(true)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist every change (status, caption, edited text). Metadata only — the
  // media file itself is written once when it's added.
  useEffect(() => {
    if (!loaded) return
    saveItems(items).catch(() => setStorageError(true))
  }, [items, loaded])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newItems = Array.from(files).map(mediaItemFromFile)
    setItems((prev) => [...prev, ...newItems])
    for (const it of newItems) saveFile(it.id, it.file).catch(() => setStorageError(true))
    e.target.value = ''
  }

  function updateItem(id: string, patch: Partial<MediaItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
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
      updateItem(item.id, { status: { kind: 'done' }, caption, text: captionText(caption) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сгенерировать подпись'
      updateItem(item.id, { status: { kind: 'failed', message } })
    }
  }

  async function generateOneById(id: string) {
    const item = items.find((it) => it.id === id)
    if (item) await generateOne(item)
  }

  function changeText(id: string, text: string) {
    updateItem(id, { text })
  }

  function setPublished(id: string, published: boolean) {
    updateItem(id, { published })
  }

  function removeItems(ids: string[]) {
    const gone = new Set(ids)
    for (const it of items) if (gone.has(it.id)) URL.revokeObjectURL(it.previewUrl)
    setItems((prev) => prev.filter((it) => !gone.has(it.id)))
    deleteItems(ids).catch(() => setStorageError(true))
  }

  const publishedIds = items.filter((it) => it.published).map((it) => it.id)

  async function generateAll() {
    setGeneratingAll(true)
    const targets = items.filter(
      (it) => !it.published && (it.status.kind === 'idle' || it.status.kind === 'failed'),
    )
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
        {publishedIds.length > 0 && (
          <button type="button" className="secondary" onClick={() => removeItems(publishedIds)}>
            Убрать опубликованные ({publishedIds.length})
          </button>
        )}
      </div>

      {storageError && (
        <p className="storage-warning">
          Не получилось сохранить галерею на устройстве — после перезагрузки подписи пропадут.
        </p>
      )}

      {loaded && items.length === 0 && <p className="empty-state">Добавьте фото или видео, чтобы начать.</p>}

      <ul className="caption-card-list">
        {items.map((item) => (
          <CaptionCard
            key={item.id}
            item={item}
            bulkGenerating={generatingAll}
            onGenerate={generateOneById}
            onTextChange={changeText}
            onPublishedChange={setPublished}
            onRemove={(id) => removeItems([id])}
          />
        ))}
      </ul>
    </div>
  )
}
