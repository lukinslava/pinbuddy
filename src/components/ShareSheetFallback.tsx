import type { MediaItem } from '../types'

interface Props {
  item: MediaItem
  textCopied: boolean
}

export default function ShareSheetFallback({ item, textCopied }: Props) {
  const mediaWord = item.type === 'video' ? 'Видео' : 'Фото'
  return (
    <div className="share-fallback">
      <p>
        {mediaWord} уже есть на телефоне — скачивать заново не нужно. Откройте Pinterest сами,
        создайте пин и выберите этот файл из галереи.{' '}
        {textCopied
          ? 'Текст подписи скопирован — вставьте его там.'
          : 'Скопировать текст не получилось — нажмите «Копировать текст», потом откройте Pinterest.'}
      </p>
    </div>
  )
}
