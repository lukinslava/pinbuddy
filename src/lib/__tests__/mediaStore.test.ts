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
    status: { kind: 'idle' },
    text: '',
    createdAt,
    ...patch,
  }
}

test('round-trips items with their files, oldest first', async () => {
  const a = item('a', 2, { status: { kind: 'done' }, text: 'привет' })
  const b = item('b', 1)
  await saveFile(a.id, a.file)
  await saveFile(b.id, b.file)
  await saveItems([a, b])

  const loaded = await loadItems()
  expect(loaded.map((i) => i.id)).toEqual(['b', 'a'])
  expect(loaded[1].text).toBe('привет')
  expect(loaded[1].file.name).toBe('a.jpg')
  await deleteItems(['a', 'b'])
})

test('an in-flight generation is restored as idle', async () => {
  const c = item('c', 3, { status: { kind: 'generating' } })
  await saveFile(c.id, c.file)
  await saveItems([c])
  const [loaded] = await loadItems()
  expect(loaded.status).toEqual({ kind: 'idle' })
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
