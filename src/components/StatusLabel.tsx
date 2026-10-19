import type { MediaItem } from '../types'
import { copy } from '../copy'

function statusText(item: MediaItem, hasKey: boolean): string {
  if (item.published) return copy.status.published
  switch (item.status.kind) {
    case 'queued':
      return hasKey ? copy.status.queued : copy.status.waitingKey
    case 'generating':
      return copy.status.generating
    case 'done':
      return copy.status.done
    case 'failed':
      return copy.status.failed
  }
}

function statusTone(item: MediaItem): string {
  if (item.published) return 'published'
  return item.status.kind
}

export default function StatusLabel({ item, hasKey }: { item: MediaItem; hasKey: boolean }) {
  return <span className={`status-label tone-${statusTone(item)}`}>{statusText(item, hasKey)}</span>
}
