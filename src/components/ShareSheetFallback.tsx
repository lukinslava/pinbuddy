import type { MediaItem } from '../types'

interface Props {
  item: MediaItem
}

export default function ShareSheetFallback({ item }: Props) {
  const mediaWord = item.type === 'video' ? 'Видео' : 'Фото'
  return (
    <div className="share-fallback">
      <p>
        {mediaWord} уже есть в приложении «Фото» — скачивать заново не нужно. Откройте Pinterest
        сами, создайте пин и выберите этот файл из «Фото». Текст подписи уже скопирован в буфер
        обмена — вставьте его там.
      </p>
    </div>
  )
}
