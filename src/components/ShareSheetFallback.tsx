import type { MediaItem } from '../types'

interface Props {
  item: MediaItem
}

export default function ShareSheetFallback({ item }: Props) {
  return (
    <div className="share-fallback">
      <p>
        Автоматическая публикация недоступна на этом устройстве. Текст подписи уже скопирован в
        буфер обмена — вставьте его при создании пина.
      </p>
      <a href={item.previewUrl} download={item.file.name} className="button-link">
        Скачать файл
      </a>
      <a href="https://www.pinterest.com" target="_blank" rel="noreferrer" className="button-link">
        Открыть Pinterest
      </a>
    </div>
  )
}
