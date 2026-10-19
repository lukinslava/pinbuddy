import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../types'
import { getSettings } from './settings'
import { ClaudeError, FetchClaudeClient } from './claudeClient'
import { generateCaption } from './captionGenerator'
import { framesFromFile } from './frameExtractor'
import { captionText } from './shareService'
import { deleteItems, loadItems, saveFile, saveItems } from './mediaStore'

function newItem(file: File, createdAt: number): MediaItem {
  return {
    id: crypto.randomUUID(),
    type: file.type.startsWith('video') ? 'video' : 'photo',
    file,
    previewUrl: URL.createObjectURL(file),
    status: { kind: 'queued' },
    text: '',
    published: false,
    createdAt,
  }
}

/**
 * The gallery: items persisted in IndexedDB plus a generation queue that
 * captions queued items one at a time. The queue waits while there's no API
 * key, and pauses when the current key is rejected until it's changed.
 */
export function useGallery(apiKey: string | null) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [rejectedKey, setRejectedKey] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const running = useRef(false)

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

  useEffect(() => {
    if (!loaded) return
    saveItems(items).catch(() => setStorageError(true))
  }, [items, loaded])

  const update = useCallback((id: string, patch: Partial<MediaItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const keyPaused = apiKey !== null && apiKey === rejectedKey

  // Queue runner: start the oldest queued item when nothing is in flight.
  useEffect(() => {
    if (!loaded || running.current || !apiKey || keyPaused) return
    const next = items.find((it) => it.status.kind === 'queued')
    if (!next) return
    running.current = true
    update(next.id, { status: { kind: 'generating' } })
    ;(async () => {
      try {
        const settings = getSettings()
        const frames = await framesFromFile(next.file)
        const client = new FetchClaudeClient(apiKey, settings.model)
        const caption = await generateCaption(client, settings, frames, next.type)
        update(next.id, { status: { kind: 'done' }, caption, text: captionText(caption) })
      } catch (err) {
        if (err instanceof ClaudeError && err.code === 'unauthorized') {
          // Not this item's fault: put it back and wait for a new key.
          update(next.id, { status: { kind: 'queued' } })
          setRejectedKey(apiKey)
        } else {
          const message = err instanceof Error ? err.message : 'Не удалось написать подпись'
          update(next.id, { status: { kind: 'failed', message } })
        }
      } finally {
        running.current = false
        setTick((t) => t + 1)
      }
    })()
  }, [items, loaded, apiKey, keyPaused, tick, update])

  function add(files: File[]) {
    // Files picked together share a timestamp; offset by index so the
    // restored order after a reload matches the order they were picked in.
    const now = Date.now()
    const added = files.map((file, i) => newItem(file, now + i))
    setItems((prev) => [...prev, ...added])
    for (const it of added) saveFile(it.id, it.file).catch(() => setStorageError(true))
  }

  function remove(ids: string[]) {
    const gone = new Set(ids)
    for (const it of items) if (gone.has(it.id)) URL.revokeObjectURL(it.previewUrl)
    setItems((prev) => prev.filter((it) => !gone.has(it.id)))
    deleteItems(ids).catch(() => setStorageError(true))
  }

  function requeue(ids: string[]) {
    const set = new Set(ids)
    setItems((prev) => prev.map((it) => (set.has(it.id) ? { ...it, status: { kind: 'queued' } } : it)))
  }

  return {
    items,
    loaded,
    storageError,
    keyPaused,
    add,
    remove,
    requeue,
    setText: (id: string, text: string) => update(id, { text }),
    setPublished: (id: string, published: boolean) => update(id, { published }),
    setLink: (id: string, link: string) => update(id, { link }),
  }
}

export type Gallery = ReturnType<typeof useGallery>
