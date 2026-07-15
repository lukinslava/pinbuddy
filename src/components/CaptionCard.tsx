import { useEffect, useState } from 'react'
import type { MediaItem } from '../types'
import { TITLE_MAX, DESC_MAX } from '../lib/captionRules'
import { shareToPinterest } from '../lib/shareService'
import ShareSheetFallback from './ShareSheetFallback'

interface Props {
  item: MediaItem
  bulkGenerating: boolean
  onGenerate: (id: string) => void
  onEditTitle: (id: string, title: string) => void
  onEditDescription: (id: string, description: string) => void
  onEditTags: (id: string, tags: string[]) => void
}

// Tags are entered as a single text field; both spaces and commas separate tags,
// so "путешествия, лето отпуск" and "путешествия лето, отпуск" behave the same.
function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export default function CaptionCard({
  item,
  bulkGenerating,
  onGenerate,
  onEditTitle,
  onEditDescription,
  onEditTags,
}: Props) {
  const [tagsText, setTagsText] = useState(item.caption?.tags.join(' ') ?? '')
  const [shareResult, setShareResult] = useState<'shared' | 'copied' | 'unsupported' | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState<'title' | 'desc' | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    setTagsText(item.caption?.tags.join(' ') ?? '')
  }, [item.caption?.tags])

  const isGenerating = item.status.kind === 'generating'
  const generateDisabled = isGenerating || bulkGenerating
  const generateLabel = item.status.kind === 'idle' ? 'Сгенерировать' : 'Повторить'

  // A direct tap is a clean user gesture, so the clipboard write is reliable on
  // iOS (unlike copying during the share flow, which iOS often drops). Title and
  // description are copied separately to match Pinterest's two fields; tags go
  // with the description (Pinterest has no separate tag field).
  async function copyField(text: string, key: 'title' | 'desc') {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
    } catch {
      setCopyFailed(true)
    }
    setCopied(key)
    setTimeout(() => {
      setCopied(null)
      setCopyFailed(false)
    }, 2500)
  }

  async function handlePublish() {
    if (!item.caption) return
    setPublishing(true)
    setShareResult(null)
    try {
      const result = await shareToPinterest(item.caption, item.file)
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
          <span>
            Заголовок ({[...(item.caption?.title ?? '')].length}/{TITLE_MAX})
          </span>
          <input
            type="text"
            value={item.caption?.title ?? ''}
            onChange={(e) => onEditTitle(item.id, e.target.value)}
            disabled={!item.caption || isGenerating}
          />
        </label>

        <label className="field">
          <span>
            Описание ({[...(item.caption?.description ?? '')].length}/{DESC_MAX})
          </span>
          <textarea
            value={item.caption?.description ?? ''}
            onChange={(e) => onEditDescription(item.id, e.target.value)}
            disabled={!item.caption || isGenerating}
            rows={3}
          />
        </label>

        <label className="field">
          <span>Теги (через пробел или запятую)</span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            onBlur={() => onEditTags(item.id, parseTagsInput(tagsText))}
            disabled={!item.caption || isGenerating}
          />
        </label>

        <div className="caption-card-actions">
          <button type="button" onClick={() => onGenerate(item.id)} disabled={generateDisabled}>
            {isGenerating ? 'Генерация...' : generateLabel}
          </button>
          <button
            type="button"
            onClick={() => copyField(item.caption!.title, 'title')}
            disabled={!item.caption || isGenerating}
          >
            {copied === 'title' ? (copyFailed ? 'Не вышло' : 'Скопировано ✓') : 'Копировать заголовок'}
          </button>
          <button
            type="button"
            onClick={() =>
              copyField(
                [item.caption!.description, item.caption!.tags.join(' ')].filter(Boolean).join('\n\n'),
                'desc',
              )
            }
            disabled={!item.caption || isGenerating}
          >
            {copied === 'desc' ? (copyFailed ? 'Не вышло' : 'Скопировано ✓') : 'Копировать описание'}
          </button>
          <button type="button" onClick={handlePublish} disabled={!item.caption || publishing || isGenerating}>
            {publishing ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>

        {shareResult === 'shared' && <p className="confirmation">Отправлено в приложение для публикации</p>}
        {shareResult === 'copied' && <p className="confirmation">Текст скопирован в буфер обмена</p>}
        {shareResult === 'unsupported' && <ShareSheetFallback item={item} />}
      </div>
    </li>
  )
}
