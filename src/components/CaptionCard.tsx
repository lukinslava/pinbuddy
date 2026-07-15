import { useEffect, useState } from 'react'
import type { MediaItem } from '../types'
import { captionText, shareToPinterest } from '../lib/shareService'
import ShareSheetFallback from './ShareSheetFallback'

interface Props {
  item: MediaItem
  bulkGenerating: boolean
  onGenerate: (id: string) => void
}

export default function CaptionCard({ item, bulkGenerating, onGenerate }: Props) {
  // Pinterest has a single combined text field (no separate title/description/tags
  // fields in practice), so editing here is one block too — initialized from the
  // generated caption, freely editable, and that's exactly what gets copied.
  const [text, setText] = useState(item.caption ? captionText(item.caption) : '')
  const [shareResult, setShareResult] = useState<'shared' | 'copied' | 'unsupported' | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    if (item.caption) setText(captionText(item.caption))
  }, [item.caption])

  const isGenerating = item.status.kind === 'generating'
  const generateDisabled = isGenerating || bulkGenerating
  const generateLabel = item.status.kind === 'idle' ? 'Сгенерировать' : 'Повторить'

  // A direct tap is a clean user gesture, so the clipboard write is reliable on
  // iOS (unlike copying during the share flow, which iOS often drops).
  //
  // Copy happens BEFORE "Опубликовать": once the OS share sheet hands off to
  // Pinterest, switching back to PinBuddy leaves iOS's share sheet stuck in an
  // unclosable state. Copying up front means the whole visit to Pinterest
  // needs zero return trips — paste the one block into Pinterest's single text
  // field.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
    } catch {
      setCopyFailed(true)
    }
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setCopyFailed(false)
    }, 2500)
  }

  // Video never goes through navigator.share(): on iOS, sharing a video to
  // Pinterest reliably leaves the native share sheet stuck/unresponsive after
  // returning from Pinterest (confirmed reproducible, not fixable from JS —
  // repainting on visibility-change didn't clear it either). Photos share
  // fine, so only video is routed straight to the manual fallback.
  async function handlePublish() {
    if (!item.caption) return
    if (item.type === 'video') {
      setShareResult('unsupported')
      return
    }
    setPublishing(true)
    setShareResult(null)
    try {
      const result = await shareToPinterest(text, item.file)
      setShareResult(result)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <li className="caption-card">
      <div className="caption-card-media">
        {item.type === 'photo' ? (
          <img src={item.previewUrl} alt="" />
        ) : (
          <video src={item.previewUrl} muted controls />
        )}
      </div>

      <div className="caption-card-body">
        <p className={`status status-${item.status.kind}`}>
          {item.status.kind === 'idle' && 'Не сгенерировано'}
          {item.status.kind === 'generating' && 'Генерация...'}
          {item.status.kind === 'done' && 'Готово'}
          {item.status.kind === 'failed' && `Ошибка: ${item.status.message}`}
        </p>

        <label className="field">
          <span>Текст для Pinterest ({[...text].length} символов)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!item.caption || isGenerating}
            rows={5}
          />
        </label>

        <div className="caption-card-actions">
          <button type="button" onClick={() => onGenerate(item.id)} disabled={generateDisabled}>
            {isGenerating ? 'Генерация...' : generateLabel}
          </button>
          <button type="button" onClick={handleCopy} disabled={!item.caption || isGenerating}>
            {copied ? (copyFailed ? 'Не вышло' : 'Скопировано ✓') : 'Копировать текст'}
          </button>
          <button type="button" onClick={handlePublish} disabled={!item.caption || publishing || isGenerating}>
            {publishing ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>

        <p className="hint">
          {item.type === 'video'
            ? 'Сначала «Копировать текст», потом «Опубликовать» — приложение покажет, как создать пин вручную в Pinterest.'
            : 'Сначала «Копировать текст», потом «Опубликовать» — и вставьте текст в единственное текстовое поле в Pinterest. Не возвращайтесь в PinBuddy, пока не закроете Pinterest — иначе окно «Поделиться» может зависнуть.'}
        </p>

        {shareResult === 'shared' && <p className="confirmation">Отправлено в приложение для публикации</p>}
        {shareResult === 'copied' && <p className="confirmation">Текст скопирован в буфер обмена</p>}
        {shareResult === 'unsupported' && <ShareSheetFallback item={item} />}
      </div>
    </li>
  )
}
