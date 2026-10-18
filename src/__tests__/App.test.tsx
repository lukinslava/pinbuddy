import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App'
import { deleteItems, loadItems } from '../lib/mediaStore'

beforeAll(() => {
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => {}
})

beforeEach(async () => {
  await deleteItems((await loadItems()).map((it) => it.id))
})

test('picked files survive a trip to Settings and back', async () => {
  const { container } = render(<App />)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByText('Не сгенерировано')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
  fireEvent.click(screen.getByRole('button', { name: 'Галерея' }))

  expect(screen.getByText('Не сгенерировано')).toBeVisible()
})

test('marking a card published offers bulk removal, which clears it', async () => {
  const { container } = render(<App />)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findAllByRole('listitem')).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: 'Отметить опубликованным' }))
  expect(screen.getByText('Опубликовано ✓')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Убрать опубликованные \(1\)/ }))
  expect(screen.queryByText('Опубликовано ✓')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})
