export type MediaType = 'photo' | 'video'
// queued: waiting its turn (or for an API key); generating: request in flight.
export type GenerationStatus =
  | { kind: 'queued' } | { kind: 'generating' }
  | { kind: 'done' } | { kind: 'failed'; message: string }

export interface GeneratedCaption {
  title: string
  description: string
  /** Search phrases for Pinterest's hidden "related topics" field (no #). */
  topics: string[]
  /** Hashtags from captions generated before topics replaced them. */
  tags?: string[]
}

export interface MediaItem {
  id: string
  type: MediaType
  file: File
  previewUrl: string          // object URL for <img>/<video>
  status: GenerationStatus
  caption?: GeneratedCaption
  text: string                // the editable text that gets copied to Pinterest
  published: boolean          // marked as posted to Pinterest
  link?: string               // YouTube URL for Pinterest's link field; falls back to the channel from settings
  createdAt: number
}
