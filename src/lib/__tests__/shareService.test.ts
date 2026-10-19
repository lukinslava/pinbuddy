import { afterEach, expect, test, vi } from 'vitest'
import { shareToPinterest } from '../shareService'

afterEach(() => vi.unstubAllGlobals())

test('photo is shared together with the text, video without it', async () => {
  const share = vi.fn(async () => {})
  vi.stubGlobal('navigator', { share, canShare: () => true, clipboard: { writeText: async () => {} } })
  const photo = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
  const video = new File(['x'], 'a.mp4', { type: 'video/mp4' })
  expect(await shareToPinterest('Описание', photo)).toBe('shared')
  expect(share).toHaveBeenLastCalledWith({ files: [photo], text: 'Описание' })
  await shareToPinterest('Описание', video)
  expect(share).toHaveBeenLastCalledWith({ files: [video] })
})
