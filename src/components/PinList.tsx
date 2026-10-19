import type { ChangeEvent } from 'react'
import type { MediaItem } from '../types'
import type { Gallery } from '../lib/useGallery'
import { copy } from '../copy'
import Thumb from './Thumb'
import StatusLabel from './StatusLabel'

interface Props {
  gallery: Gallery
  hasKey: boolean
  onOpen: (id: string) => void
  onOpenSettings: () => void
}

function firstLine(text: string): string {
  return text.split('\n').find((l) => l.trim()) ?? ''
}

function Row({ item, hasKey, onOpen }: { item: MediaItem; hasKey: boolean; onOpen: (id: string) => void }) {
  const detail =
    item.status.kind === 'failed' && !item.published ? item.status.message : firstLine(item.text) || item.file.name
  return (
    <li>
      <button type="button" className={`pin-row${item.published ? ' is-published' : ''}`} onClick={() => onOpen(item.id)}>
        <Thumb item={item} />
        <span className="pin-row-body">
          <StatusLabel item={item} hasKey={hasKey} />
          <span className="pin-row-text">{detail}</span>
        </span>
        <span className="pin-row-chevron" aria-hidden="true">›</span>
      </button>
    </li>
  )
}

export default function PinList({ gallery, hasKey, onOpen, onOpenSettings }: Props) {
  const { items, loaded } = gallery
  const open = items.filter((it) => !it.published)
  const published = items.filter((it) => it.published)
  const failed = open.filter((it) => it.status.kind === 'failed')

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) gallery.add(Array.from(files))
    e.target.value = ''
  }

  const picker = (
    <label className={`button ${items.length === 0 ? 'button-primary' : 'button-secondary'} file-picker`}>
      {copy.list.add}
      <input type="file" accept="image/*,video/*" multiple onChange={handleFiles} />
    </label>
  )

  return (
    <div className="screen pin-list">
      <div className="pin-list-head">
        <h1>{copy.list.title}</h1>
        {items.length > 0 && <p className="muted">{copy.list.progress(published.length, items.length)}</p>}
      </div>

      {gallery.keyPaused && (
        <div className="notice notice-danger">
          <p>{copy.list.keyPaused}</p>
          <button type="button" className="button button-small" onClick={onOpenSettings}>
            {copy.list.openSettings}
          </button>
        </div>
      )}

      {gallery.storageError && (
        <div className="notice notice-danger">
          <p>{copy.list.storageError}</p>
        </div>
      )}

      {loaded && items.length === 0 ? (
        <div className="empty">
          <h2>{copy.list.emptyTitle}</h2>
          <p className="muted">{copy.list.emptyText}</p>
          {picker}
        </div>
      ) : (
        <>
          {picker}

          {failed.length > 0 && (
            <div className="notice">
              <p>{copy.list.failedCount(failed.length)}</p>
              <button
                type="button"
                className="button button-small"
                onClick={() => gallery.requeue(failed.map((it) => it.id))}
              >
                {copy.list.retryFailed}
              </button>
            </div>
          )}

          {open.length > 0 && (
            <section>
              <h2 className="section-title">{copy.list.toPublish}</h2>
              <ul className="pin-rows">
                {open.map((it) => (
                  <Row key={it.id} item={it} hasKey={hasKey} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          )}

          {published.length > 0 && (
            <section>
              <div className="section-head">
                <h2 className="section-title">
                  {copy.list.published} · {published.length}
                </h2>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => gallery.remove(published.map((it) => it.id))}
                >
                  {copy.list.removePublished}
                </button>
              </div>
              <ul className="pin-rows">
                {published.map((it) => (
                  <Row key={it.id} item={it} hasKey={hasKey} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
