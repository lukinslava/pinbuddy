import type { MediaItem } from '../types'
import { copy } from '../copy'

/** Small square preview used in the pin list. */
export default function Thumb({ item }: { item: MediaItem }) {
  return (
    <span className="thumb">
      {item.type === 'photo' ? (
        <img src={item.previewUrl} alt="" />
      ) : (
        <>
          {/* #t= makes iOS Safari render the first frame instead of a blank box */}
          <video src={`${item.previewUrl}#t=0.1`} muted playsInline preload="metadata" />
          <span className="thumb-badge" aria-label={copy.list.video}>▶</span>
        </>
      )}
    </span>
  )
}
