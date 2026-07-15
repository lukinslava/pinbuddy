import { fileToBase64Jpeg } from './imageDownscaler'

export async function framesFromPhoto(file: File): Promise<string[]> {
  return [await fileToBase64Jpeg(file)]
}

export async function framesFromVideo(file: File, maxFrames = 3): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url; video.muted = true; (video as any).playsInline = true
  await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(new Error('video load failed')) })
  const dur = video.duration || 0
  const stops = [0, dur / 2, Math.max(0, dur - 0.2)].slice(0, maxFrames)
  const out: string[] = []
  for (const t of stops) {
    await new Promise<void>((res) => {
      const timeout = setTimeout(() => res(), 1000)
      video.onseeked = () => { clearTimeout(timeout); res() }
      video.currentTime = t
    })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.7))
    out.push(await fileToBase64Jpeg(blob))
  }
  URL.revokeObjectURL(url)
  return out
}

export function framesFromFile(file: File): Promise<string[]> {
  return file.type.startsWith('video') ? framesFromVideo(file) : framesFromPhoto(file)
}
