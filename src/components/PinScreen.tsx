import { useRef, useState, type ReactNode } from 'react'
import type { MediaItem } from '../types'
import type { Gallery } from '../lib/useGallery'
import { shareToPinterest } from '../lib/shareService'
import { cleanLink } from '../lib/link'
import { getSettings } from '../lib/settings'
import { copy } from '../copy'
import StatusLabel from './StatusLabel'

interface Props {
  item: MediaItem
  position: number
  total: number
  nextId: string | null
  hasKey: boolean
  gallery: Gallery
  onOpen: (id: string) => void
  onBack: () => void
}

// Pinterest's own field limits.
const TITLE_LIMIT = 100
const DESCRIPTION_LIMIT = 800

type Field = 'title' | 'description' | 'link'

// After "Опубликовать": 'photo' — the photo and description went through the
// share sheet, title and link are added by editing the pin; 'video' / 'manual'
// — the pin is created by hand in Pinterest, field by field.
type After = null | 'photo' | 'video' | 'manual'

export default function PinScreen({ item, position, total, nextId, hasKey, gallery, onOpen, onBack }: Props) {
  const [copied, setCopied] = useState<Field | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [after, setAfter] = useState<After>(null)
  const copiedTimer = useRef<number | undefined>(undefined)

  const busy = item.status.kind === 'queued' || item.status.kind === 'generating'
  const ready = item.status.kind === 'done' && !!item.caption
  // A pin without its own link uses the channel from settings.
  const link = item.link ?? cleanLink(getSettings().youtubeChannel)
  const hasLink = cleanLink(link) !== ''
  const topics = item.caption?.topics ?? []

  async function copyField(field: Field) {
    const value = field === 'title' ? item.title : field === 'description' ? item.description : cleanLink(link)
    try {
      await navigator.clipboard.writeText(value)
      setCopyFailed(false)
      setCopied(field)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  // Photos go through the share sheet with the description as the shared text
  // — Pinterest puts it into Description by itself. Title and link can't be
  // passed that way, so they're added by editing the pin afterwards (after the
  // share sheet has closed, switching apps is safe). Video never uses the
  // share sheet: on iOS it gets stuck after returning from Pinterest.
  async function publish() {
    if (item.type === 'video') {
      await copyField('description')
      setAfter('video')
      return
    }
    setPublishing(true)
    try {
      const result = await shareToPinterest(item.description, item.file)
      if (result === 'shared') setAfter('photo')
      else if (result === 'unsupported') setAfter('manual')
      // 'copied' = the sheet was dismissed; stay on the publish step.
    } finally {
      setPublishing(false)
    }
  }

  function confirmPublished() {
    gallery.setPublished(item.id, true)
    if (nextId) onOpen(nextId)
    else onBack()
  }

  function regenerate() {
    const edited = item.caption && (item.title !== item.caption.title || item.description !== item.caption.description)
    if (edited && !window.confirm(copy.pin.confirmRegenerate)) return
    gallery.requeue([item.id])
    setAfter(null)
  }

  function remove() {
    if (item.caption && !item.published && !window.confirm(copy.pin.confirmRemove)) return
    gallery.remove([item.id])
    onBack()
  }

  const help =
    after === 'photo'
      ? { title: copy.pin.afterPhotoTitle, steps: copy.pin.afterPhotoSteps(hasLink) }
      : after === 'video'
        ? { title: copy.pin.videoHelpTitle, steps: copy.pin.manualSteps(true, hasLink) }
        : after === 'manual'
          ? { title: copy.pin.manualHelpTitle, steps: copy.pin.manualSteps(false, hasLink) }
          : null

  const copyButton = (field: Field) => (
    <button type="button" className="button-link copy-button" onClick={() => copyField(field)}>
      {copied === field ? `${copy.pin.copiedField} ✓` : copy.pin.copyField}
    </button>
  )

  return (
    <div className="screen pin-screen">
      <div className="pin-media">
        {item.type === 'photo' ? (
          <img src={item.previewUrl} alt="" />
        ) : (
          <video src={item.previewUrl} muted playsInline controls />
        )}
      </div>

      <div className="pin-meta">
        {item.status.kind === 'failed' && !item.published ? <span /> : <StatusLabel item={item} hasKey={hasKey} />}
        <span className="muted">{copy.pin.position(position, total)}</span>
      </div>

      {item.status.kind === 'failed' && (
        <div className="notice notice-danger">
          <p>
            <strong>{copy.pin.failedTitle}</strong>
            <br />
            {item.status.message}
          </p>
        </div>
      )}

      {busy && !item.caption && (
        <div className="field">
          <textarea value={copy.status.generating} disabled rows={3} aria-label={copy.status.generating} />
        </div>
      )}

      {item.caption && (
        <>
          <div className="field">
            <div className="field-head">
              <label htmlFor="pin-title">{copy.pin.titleLabel}</label>
              <span className="muted">{copy.pin.counter([...item.title].length, TITLE_LIMIT)}</span>
              {copyButton('title')}
            </div>
            <textarea
              id="pin-title"
              value={item.title}
              onChange={(e) => gallery.setTitle(item.id, e.target.value.replace(/\n/g, ' '))}
              disabled={busy}
              rows={2}
              maxLength={TITLE_LIMIT}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <label htmlFor="pin-description">{copy.pin.descriptionLabel}</label>
              <span className="muted">{copy.pin.counter([...item.description].length, DESCRIPTION_LIMIT)}</span>
              {copyButton('description')}
            </div>
            <textarea
              id="pin-description"
              value={item.description}
              onChange={(e) => gallery.setDescription(item.id, e.target.value)}
              disabled={busy}
              rows={6}
              maxLength={DESCRIPTION_LIMIT}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <label htmlFor="pin-link">{copy.pin.linkLabel}</label>
              {hasLink && copyButton('link')}
            </div>
            <input
              id="pin-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => gallery.setLink(item.id, e.target.value)}
              onBlur={(e) => gallery.setLink(item.id, cleanLink(e.target.value))}
              placeholder="https://youtube.com/…"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {topics.length > 0 && (
            <div className="field">
              <span className="field-head">{copy.pin.topicsLabel}</span>
              <ul className="topics">
                {topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <span className="field-hint">{copy.pin.topicsHint}</span>
            </div>
          )}
        </>
      )}

      {copyFailed && <p className="error-text">{copy.pin.copyFailed}</p>}

      {help && (
        <div className="notice">
          <p>
            <strong>{help.title}</strong>
          </p>
          <ol className="steps">
            {help.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="pin-secondary">
        {!item.published && (
          <button type="button" className="button-link" onClick={regenerate} disabled={busy || !hasKey}>
            {copy.pin.regenerate}
          </button>
        )}
        <button type="button" className="button-link" onClick={() => gallery.setPublished(item.id, !item.published)}>
          {item.published ? copy.pin.unmarkPublished : copy.pin.markPublished}
        </button>
        <button type="button" className="button-link danger" onClick={remove} disabled={item.status.kind === 'generating'}>
          {copy.pin.remove}
        </button>
      </div>

      <ActionBar>
        {item.published ? (
          nextId ? (
            <button type="button" className="button button-primary" onClick={() => onOpen(nextId)}>
              {copy.pin.next}
            </button>
          ) : (
            <button type="button" className="button button-secondary" onClick={onBack}>
              {copy.pin.toList}
            </button>
          )
        ) : item.status.kind === 'failed' ? (
          <button type="button" className="button button-primary" onClick={() => gallery.requeue([item.id])} disabled={!hasKey}>
            {copy.pin.retry}
          </button>
        ) : ready && after !== null ? (
          <>
            <p className="action-question">{copy.pin.askPublished}</p>
            <div className="action-row action-row-answer">
              <button type="button" className="button button-secondary" onClick={() => setAfter(null)}>
                {copy.pin.notYet}
              </button>
              <button type="button" className="button button-primary" onClick={confirmPublished}>
                {nextId ? copy.pin.yesNext : copy.pin.yesDone}
              </button>
            </div>
          </>
        ) : ready ? (
          <>
            <p className="action-hint">{item.type === 'photo' ? copy.pin.photoHint : copy.pin.videoHint}</p>
            <button type="button" className="button button-primary" onClick={publish} disabled={publishing}>
              {publishing ? copy.pin.publishing : copy.pin.publish}
            </button>
          </>
        ) : null}
      </ActionBar>
    </div>
  )
}

function ActionBar({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="action-bar">{children}</div>
}
