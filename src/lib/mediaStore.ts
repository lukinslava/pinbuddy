import type { GeneratedCaption, GenerationStatus, MediaItem, MediaType } from '../types'

// Gallery persistence in IndexedDB, so generated captions survive a reload,
// switching tabs, or iOS evicting the PWA while the user is in Pinterest.
// Metadata and media blobs live in separate stores: metadata is rewritten on
// every edit, the (possibly large) file is written once.

const DB_NAME = 'pinbuddy'
const DB_VERSION = 1
const ITEMS = 'items'
const FILES = 'files'

interface StoredMeta {
  id: string
  type: MediaType
  name: string
  mimeType: string
  status: GenerationStatus
  caption?: GeneratedCaption
  text: string
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

function toMeta(item: MediaItem): StoredMeta {
  return {
    id: item.id,
    type: item.type,
    name: item.file.name,
    mimeType: item.file.type,
    // A generation can't survive a reload, so never persist it as in-flight.
    status: item.status.kind === 'generating' ? { kind: 'idle' } : item.status,
    caption: item.caption,
    text: item.text,
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
      status: m.status.kind === 'generating' ? { kind: 'idle' } : m.status,
      caption: m.caption,
      text: m.text,
      createdAt: m.createdAt,
    })
  })
  return items.sort((a, b) => a.createdAt - b.createdAt)
}
