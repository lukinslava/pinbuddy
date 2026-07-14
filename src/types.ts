export type MediaType = 'photo' | 'video'
export type GenerationStatus =
  | { kind: 'idle' } | { kind: 'generating' }
  | { kind: 'done' } | { kind: 'failed'; message: string }

export interface GeneratedCaption {
  title: string
  description: string
  tags: string[]
}

export interface MediaItem {
  id: string
  type: MediaType
  file: File
  previewUrl: string          // object URL for <img>/<video>
  status: GenerationStatus
  caption?: GeneratedCaption
}
