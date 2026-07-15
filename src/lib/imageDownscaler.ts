export async function fileToBase64Jpeg(source: Blob, maxDim = 1024, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > maxDim ? maxDim / longest : 1
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.split(',')[1] // strip "data:image/jpeg;base64,"
}
