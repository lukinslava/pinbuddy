import 'fake-indexeddb/auto'
import { beforeAll, expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

beforeAll(() => {
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => {}
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
