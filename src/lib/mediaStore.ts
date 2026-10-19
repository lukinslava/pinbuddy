import type { GeneratedCaption, GenerationStatus, MediaItem, MediaType } from '../types'

// Gallery persistence in IndexedDB, so generated captions survive a reload,
// switching tabs, or iOS evicting the PWA while the user is in Pinterest.
// Metadata and media blobs live in separate stores: metadata is rewritten on
// every edit, the (possibly large) file is written once.

const DB_NAME = 'pinbuddy'
const DB_VERSION = 1
const ITEMS = 'items'
const FILES = 'files'

// 'idle' is the pre-queue name for "not generated yet", kept so old records load.
type StoredStatus = GenerationStatus | { kind: 'idle' }

interface StoredMeta {
  id: string
  type: MediaType
  name: string
  mimeType: string
  status: StoredStatus
  caption?: GeneratedCaption
  title?: string
  description?: string
  /** Pre-split single text (title on the first line), from older versions. */
  text?: string
  link?: string
  published?: boolean          // absent in records saved before this field existed
  createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function restoreStatus(s: StoredStatus): GenerationStatus {
  return s.kind === 'idle' || s.kind === 'generating' ? { kind: 'queued' } : s
}

function restoreText(m: StoredMeta): { title: string; description: string } {
  if (m.title !== undefined || m.description !== undefined) return { title: m.title ?? '', description: m.description ?? '' }
  // Older records kept one text block: title, blank line, description.
  const text = m.text ?? ''
  const nl = text.indexOf('\n')
  if (nl < 0) return { title: text.trim(), description: '' }
  return { title: text.slice(0, nl).trim(), description: text.slice(nl).trim() }
}

function toMeta(item: MediaItem): StoredMeta {
  return {
    id: item.id,
    type: item.type,
    name: item.file.name,
    mimeType: item.file.type,
    // A generation can't survive a reload: store it as queued so it resumes.
    status: item.status.kind === 'generating' ? { kind: 'queued' } : item.status,
    caption: item.caption,
    title: item.title,
    description: item.description,
    link: item.link,
    published: item.published,
    createdAt: item.createdAt,
  }
}

export async function saveFile(id: string, file: File): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(FILES, 'readwrite')
  tx.objectStore(FILES).put(file, id)
  await done(tx)
}

export async function saveItems(items: MediaItem[]): Promise<void> {
  if (items.length === 0) return
  const db = await openDb()
  const tx = db.transaction(ITEMS, 'readwrite')
  const store = tx.objectStore(ITEMS)
  for (const item of items) store.put(toMeta(item))
  await done(tx)
}

export async function deleteItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  const tx = db.transaction([ITEMS, FILES], 'readwrite')
  for (const id of ids) {
    tx.objectStore(ITEMS).delete(id)
    tx.objectStore(FILES).delete(id)
  }
  await done(tx)
}

/** Loads saved items, oldest first. Items whose media blob is missing are dropped. */
export async function loadItems(): Promise<MediaItem[]> {
  const db = await openDb()
  const tx = db.transaction([ITEMS, FILES], 'readonly')
  const metas = await request(tx.objectStore(ITEMS).getAll() as IDBRequest<StoredMeta[]>)
  const blobs = await Promise.all(
    metas.map((m) => request(tx.objectStore(FILES).get(m.id) as IDBRequest<Blob | undefined>)),
  )
  const items: MediaItem[] = []
  metas.forEach((m, i) => {
    const blob = blobs[i]
    if (!blob) return
    const file = blob instanceof File ? blob : new File([blob], m.name, { type: m.mimeType })
    items.push({
      id: m.id,
      type: m.type,
      file,
      previewUrl: URL.createObjectURL(file),
      status: restoreStatus(m.status),
      caption: m.caption,
      ...restoreText(m),
      link: m.link,
      published: m.published ?? false,
      createdAt: m.createdAt,
    })
  })
  return items.sort((a, b) => a.createdAt - b.createdAt)
}
