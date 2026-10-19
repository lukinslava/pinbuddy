import 'fake-indexeddb/auto'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { deleteItems, loadItems, saveFile, saveItems } from '../lib/mediaStore'
import { setApiKey } from '../lib/keyStore'

// jsdom has no canvas/video decoding; frames don't matter for UI tests.
vi.mock('../lib/frameExtractor', () => ({ framesFromFile: async () => ['ZmFrZQ=='] }))

const writeText = vi.fn(async () => {})

beforeAll(() => {
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => {}
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

beforeEach(async () => {
  await deleteItems((await loadItems()).map((it) => it.id))
  localStorage.clear()
  writeText.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function claudeReplies(...titles: string[]) {
  let i = 0
  const fetchMock = vi.fn(async () => {
    const title = titles[Math.min(i++, titles.length - 1)]
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ title, description: 'Описание', topics: ['дом'] }) }] }),
      { status: 200 },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function pick(container: HTMLElement, ...names: string[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, {
    target: { files: names.map((n) => new File([n], n, { type: n.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' })) },
  })
}

test('first launch asks for a key, then shows the empty list', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Подключите Claude' })).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('API‑ключ Claude'), { target: { value: 'sk-ant-test' } })
  fireEvent.click(screen.getByRole('button', { name: /Сохранить и\sначать/ }))

  expect(await screen.findByText('Пока пусто')).toBeInTheDocument()
})

test('added files are captioned automatically, one after another', async () => {
  setApiKey('sk-ant-test')
  const fetchMock = claudeReplies('Утренний кофе', 'Букет')
  const { container } = render(<App />)
  await screen.findByText('Пока пусто')

  pick(container, 'a.jpg', 'b.jpg')

  expect(await screen.findByText(/Утренний кофе/)).toBeInTheDocument()
  expect(await screen.findByText(/Букет/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('copy → publish → confirm walks to the next pin and marks this one published', async () => {
  setApiKey('sk-ant-test')
  claudeReplies('Первый', 'Второй')
  const { container } = render(<App />)
  await screen.findByText('Пока пусто')
  pick(container, 'clip.mp4', 'b.jpg')
  await screen.findByText(/Второй/)

  fireEvent.click(screen.getByText(/Первый/))
  fireEvent.click(screen.getByRole('button', { name: /Скопировать/ }))
  await screen.findByRole('button', { name: /Скопировано/ })
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Первый'))

  // Video: no share sheet, manual steps instead.
  fireEvent.click(screen.getByRole('button', { name: /Опубликовать/ }))
  expect(await screen.findByText('Видео публикуется вручную')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Да, к\sследующему/ }))

  expect(await screen.findByDisplayValue(/Второй/)).toBeInTheDocument()
  expect(screen.getByText('2 из 2')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Все пины/ }))
  expect(screen.getByText('Опубликовано 1 из 2')).toBeInTheDocument()
})

test('a rejected key pauses the queue until the key is changed', async () => {
  setApiKey('sk-ant-bad')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  const { container } = render(<App />)
  await screen.findByText('Пока пусто')
  pick(container, 'a.jpg')

  expect(await screen.findByText(/Ключ Claude не подошёл/)).toBeInTheDocument()
  expect(screen.getByText('В очереди')).toBeInTheDocument()

  claudeReplies('После смены ключа')
  fireEvent.click(screen.getByRole('button', { name: 'Открыть настройки' }))
  fireEvent.change(screen.getByLabelText('API‑ключ Claude'), { target: { value: 'sk-ant-good' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(await screen.findByText(/После смены ключа/)).toBeInTheDocument()
  expect(screen.queryByText(/Ключ Claude не подошёл/)).not.toBeInTheDocument()
})

test('saved pins without a key wait for one, then get captioned', async () => {
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
  await saveFile('w', file)
  await saveItems([{ id: 'w', type: 'photo', file, previewUrl: '', status: { kind: 'queued' }, text: '', published: false, createdAt: 1 }])
  claudeReplies('Дождался')
  render(<App />)

  expect(await screen.findByText('Ждёт ключ Claude')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
  fireEvent.change(screen.getByLabelText('API‑ключ Claude'), { target: { value: 'sk-ant-test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(await screen.findByText(/Дождался/)).toBeInTheDocument()
})

test('published pins can be cleared in one tap', async () => {
  setApiKey('sk-ant-test')
  claudeReplies('Готовый')
  const { container } = render(<App />)
  await screen.findByText('Пока пусто')
  pick(container, 'a.jpg')
  fireEvent.click(await screen.findByText(/Готовый/))
  fireEvent.click(screen.getByRole('button', { name: 'Отметить опубликованным' }))
  fireEvent.click(screen.getByRole('button', { name: /Все пины/ }))

  const section = screen.getByRole('heading', { name: /Опубликованные · 1/ }).closest('section')!
  fireEvent.click(within(section).getByRole('button', { name: 'Убрать все' }))
  expect(await screen.findByText('Пока пусто')).toBeInTheDocument()
})

test('a batch keeps its order after a reload, and settings do not drop the list', async () => {
  setApiKey('sk-ant-test')
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))) // keep everything queued
  const names = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']
  const first = render(<App />)
  await screen.findByText('Пока пусто')
  pick(first.container, ...names)
  await waitFor(async () => expect(await loadItems()).toHaveLength(names.length))

  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
  fireEvent.click(screen.getByRole('button', { name: /Все пины/ }))
  expect(screen.getAllByRole('listitem')).toHaveLength(names.length)
  first.unmount()

  expect((await loadItems()).map((it) => it.file.name)).toEqual(names)
})

test('pin shows topics, and the copied text ends with the YouTube link', async () => {
  setApiKey('sk-ant-test')
  localStorage.setItem('pinbuddy.settings', JSON.stringify({ youtubeChannel: 'https://youtube.com/@me' }))
  claudeReplies('Кофе')
  const { container } = render(<App />)
  await screen.findByText('Пока пусто')
  pick(container, 'a.jpg')
  fireEvent.click(await screen.findByText(/Кофе/))

  expect(screen.getByText('дом')).toBeInTheDocument()
  expect(screen.getByDisplayValue('https://youtube.com/@me')).toBeInTheDocument()

  fireEvent.change(screen.getByDisplayValue('https://youtube.com/@me'), { target: { value: 'https://youtu.be/abc' } })
  fireEvent.click(screen.getByRole('button', { name: /Скопировать/ }))
  await screen.findByRole('button', { name: /Скопировано/ })
  expect(writeText).toHaveBeenLastCalledWith('Кофе\n\nОписание\n\nhttps://youtu.be/abc')
})
