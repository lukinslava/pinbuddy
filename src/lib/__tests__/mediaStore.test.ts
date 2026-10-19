import 'fake-indexeddb/auto'
import { beforeAll, expect, test } from 'vitest'
import { deleteItems, loadItems, saveFile, saveItems } from '../mediaStore'
import type { MediaItem } from '../../types'

beforeAll(() => {
  // jsdom has no object URLs
  URL.createObjectURL = () => 'blob:test'
})

function item(id: string, createdAt: number, patch: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    type: 'photo',
    file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: 'blob:old',
    status: { kind: 'queued' },
    title: '',
    description: '',
    published: false,
    createdAt,
    ...patch,
  }
}

test('round-trips items with their files, oldest first', async () => {
  const a = item('a', 2, { status: { kind: 'done' }, title: 'привет', published: true })
  const b = item('b', 1)
  await saveFile(a.id, a.file)
  await saveFile(b.id, b.file)
  await saveItems([a, b])

  const loaded = await loadItems()
  expect(loaded.map((i) => i.id)).toEqual(['b', 'a'])
  expect(loaded[1].title).toBe('привет')
  expect(loaded[1].file.name).toBe('a.jpg')
  expect(loaded[1].published).toBe(true)
  expect(loaded[0].published).toBe(false)
  await deleteItems(['a', 'b'])
})

test('an in-flight generation is restored as queued', async () => {
  const c = item('c', 3, { status: { kind: 'generating' } })
  await saveFile(c.id, c.file)
  await saveItems([c])
  const [loaded] = await loadItems()
  expect(loaded.status).toEqual({ kind: 'queued' })
  await deleteItems(['c'])
})

test('deleteItems removes metadata and file; items without a file are skipped', async () => {
  const d = item('d', 4)
  await saveFile(d.id, d.file)
  await saveItems([d, item('orphan', 5)])
  await deleteItems(['d'])
  expect(await loadItems()).toEqual([])
  await deleteItems(['orphan'])
})

test('older single-text records are split into title and description', async () => {
  const e = item('e', 6)
  await saveFile(e.id, e.file)
  await saveItems([e])
  // Simulate a record written by the previous version.
  const req = indexedDB.open('pinbuddy')
  await new Promise<void>((resolve) => {
    req.onsuccess = () => {
      const tx = req.result.transaction('items', 'readwrite')
      const store = tx.objectStore('items')
      store.get('e').onsuccess = (ev) => {
        const rec = (ev.target as IDBRequest).result
        delete rec.title
        delete rec.description
        rec.text = 'Заголовок\n\nОписание пина\n\n#дом'
        store.put(rec)
      }
      tx.oncomplete = () => resolve()
    }
  })
  const [loaded] = await loadItems()
  expect(loaded.title).toBe('Заголовок')
  expect(loaded.description).toBe('Описание пина\n\n#дом')
  await deleteItems(['e'])
})
