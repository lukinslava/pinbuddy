import { useState, type ReactNode } from 'react'
import type { MediaItem } from '../types'
import type { Gallery } from '../lib/useGallery'
import { captionText, clipboardText, shareToPinterest } from '../lib/shareService'
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

// What happened after "Опубликовать": the share sheet was used (ask whether it
// worked), or the file has to be posted by hand (video, or no share support).
type After = null | 'ask' | 'video' | 'manual'

export default function PinScreen({ item, position, total, nextId, hasKey, gallery, onOpen, onBack }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [after, setAfter] = useState<After>(null)

  const busy = item.status.kind === 'queued' || item.status.kind === 'generating'
  const ready = item.status.kind === 'done' && !!item.caption
  const text = item.text
  // A pin without its own link uses the channel from settings.
  const link = item.link ?? getSettings().youtubeChannel
  const topics = item.caption?.topics ?? []
  const payload = clipboardText(text, link)

  async function copyText(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(payload)
      setCopyState('ok')
      return true
    } catch {
      setCopyState('failed')
      return false
    }
  }

  // Photos go through the share sheet. Video never does: on iOS the share
  // sheet gets stuck after returning from Pinterest with a video (reproducible,
  // not fixable from JS), so video is posted by hand. A tap here is a clean
  // user gesture, so copying for video is reliable.
  async function publish() {
    if (item.type === 'video') {
      await copyText()
      setAfter('video')
      return
    }
    setPublishing(true)
    try {
      const result = await shareToPinterest(payload, item.file)
      if (result === 'shared') setAfter('ask')
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
    const edited = item.caption && text !== captionText(item.caption)
    if (edited && !window.confirm(copy.pin.confirmRegenerate)) return
    gallery.requeue([item.id])
    setAfter(null)
    setCopyState('idle')
  }

  function remove() {
    if (item.caption && !item.published && !window.confirm(copy.pin.confirmRemove)) return
    gallery.remove([item.id])
    onBack()
  }

  const steps =
    after === 'video' || after === 'manual'
      ? copy.pin.publishSteps({
          video: item.type === 'video',
          copied: after === 'manual' || copyState === 'ok',
          link: link.trim() !== '',
          topics: topics.length > 0,
        })
      : null

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

      {(item.caption || busy) && (
        <label className="field">
          <span className="field-head">
            <span>{copy.pin.captionLabel}</span>
            {item.caption && <span className="muted">{copy.pin.chars([...text].length)}</span>}
          </span>
          <textarea
            value={busy && !item.caption ? copy.status.generating : text}
            onChange={(e) => gallery.setText(item.id, e.target.value)}
            disabled={busy || !item.caption}
            rows={7}
          />
          {item.caption && <span className="field-hint">{copy.pin.captionHint}</span>}
        </label>
      )}

      {item.caption && (
        <label className="field">
          <span>{copy.pin.linkLabel}</span>
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => gallery.setLink(item.id, e.target.value)}
            placeholder="https://youtube.com/…"
            autoCapitalize="off"
            spellCheck={false}
          />
          <span className="field-hint">{copy.pin.linkHint}</span>
        </label>
      )}

      {topics.length > 0 && (
        <div className="field">
          <span>{copy.pin.topicsLabel}</span>
          <ul className="topics">
            {topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <span className="field-hint">{copy.pin.topicsHint}</span>
        </div>
      )}

      {copyState === 'failed' && <p className="error-text">{copy.pin.copyFailed}</p>}

      {steps && (
        <div className="notice">
          <p>
            <strong>{after === 'video' ? copy.pin.videoHelpTitle : copy.pin.manualHelpTitle}</strong>
          </p>
          <ol className="steps">
            {steps.map((s) => (
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
            <p className="action-hint">
              {copyState !== 'ok' ? copy.pin.stepHint : item.type === 'photo' ? copy.pin.photoHint(link.trim() !== '') : ''}
            </p>
            <div className="action-row">
              <button
                type="button"
                className={`button ${copyState === 'ok' ? 'button-secondary' : 'button-primary'}`}
                onClick={copyText}
              >
                <span className="step-num">1</span>
                {copyState === 'ok' ? `${copy.pin.copied} ✓` : copy.pin.copy}
              </button>
              <button
                type="button"
                className={`button ${copyState === 'ok' ? 'button-primary' : 'button-secondary'}`}
                onClick={publish}
                disabled={publishing}
              >
                <span className="step-num">2</span>
                {publishing ? copy.pin.publishing : copy.pin.publish}
              </button>
            </div>
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
