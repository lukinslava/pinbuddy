// All interface copy in one place. Russian UI typography: no final period in
// one-sentence texts, non-breaking space ( ) before an em dash and after
// one-letter prepositions.

export const copy = {
  appName: 'PinBuddy',
  reload: 'Обновить страницу',
  openSettings: 'Настройки',
  back: 'Назад',
  allPins: 'Все пины',

  onboarding: {
    title: 'Подключите Claude',
    lead: 'PinBuddy пишет подписи к пинам с помощью Claude. Для этого нужен API‑ключ',
    consoleLink: 'Создать ключ в консоли Anthropic',
    submit: 'Сохранить и начать',
  },

  list: {
    title: 'Пины',
    add: 'Добавить фото и видео',
    emptyTitle: 'Пока пусто',
    emptyText: 'Выберите фото или видео из галереи — подписи появятся сами',
    progress: (done: number, total: number) => `Опубликовано ${done} из ${total}`,
    toPublish: 'Ждут публикации',
    published: 'Опубликованные',
    removePublished: 'Убрать все',
    failedCount: (n: number) => `${n} ${plural(n, 'пин', 'пина', 'пинов')} с ошибкой`,
    retryFailed: 'Повторить',
    keyPaused: 'Ключ Claude не подошёл. Подписи не пишутся, пока его не заменить',
    openSettings: 'Открыть настройки',
    storageError: 'Не удалось сохранить на устройстве — после перезагрузки подписи пропадут',
    video: 'Видео',
  },

  status: {
    queued: 'В очереди',
    waitingKey: 'Ждёт ключ Claude',
    generating: 'Пишу подпись…',
    done: 'Готово',
    failed: 'Ошибка',
    published: 'Опубликовано',
  },

  pin: {
    position: (n: number, total: number) => `${n} из ${total}`,
    captionLabel: 'Подпись',
    chars: (n: number) => `${n} ${plural(n, 'символ', 'символа', 'символов')}`,
    failedTitle: 'Не удалось написать подпись',
    retry: 'Повторить',
    copy: 'Скопировать',
    copied: 'Скопировано',
    copyFailed: 'Не получилось скопировать. Выделите текст и скопируйте вручную',
    publish: 'Опубликовать',
    publishing: 'Открываю…',
    stepHint: 'Сначала скопируйте текст, затем опубликуйте',
    photoHint: (withLink: boolean) =>
      withLink
        ? 'В Pinterest вставьте текст в описание, а ссылку из последней строки перенесите в поле ссылки. Возвращайтесь сюда, когда закончите — иначе окно «Поделиться» может зависнуть'
        : 'В Pinterest вставьте текст в описание. Возвращайтесь сюда, когда закончите — иначе окно «Поделиться» может зависнуть',
    captionHint: 'Первая строка — заголовок пина, дальше описание',
    linkLabel: 'Ссылка на YouTube',
    linkHint: 'Скопируется последней строкой вместе с текстом',
    topicsLabel: 'Темы для Pinterest',
    topicsHint: 'Отметьте их в поле тем при создании пина. Зрители их не видят',
    videoHelpTitle: 'Видео публикуется вручную',
    publishSteps: (o: { video: boolean; copied: boolean; link: boolean; topics: boolean }) =>
      [
        'Откройте Pinterest и создайте пин',
        o.video ? 'Выберите это видео из галереи' : 'Выберите это фото из галереи',
        o.copied
          ? 'Вставьте подпись в описание — она уже скопирована'
          : 'Вернитесь сюда, скопируйте подпись и вставьте её в описание',
        o.link ? 'Перенесите ссылку из последней строки в поле ссылки' : '',
        o.topics ? 'Отметьте темы из списка выше' : '',
      ].filter(Boolean),
    manualHelpTitle: 'Отправить файл не получилось',
    askPublished: 'Пин опубликован?',
    yesNext: 'Да, к следующему',
    yesDone: 'Да, готово',
    notYet: 'Ещё нет',
    next: 'Следующий пин',
    toList: 'Ко всем пинам',
    regenerate: 'Написать заново',
    confirmRegenerate: 'Заменить подпись? Ваши правки пропадут',
    markPublished: 'Отметить опубликованным',
    unmarkPublished: 'Снять отметку',
    remove: 'Убрать',
    confirmRemove: 'Убрать пин из списка? Подпись удалится',
  },

  settings: {
    title: 'Настройки',
    keyLabel: 'API‑ключ Claude',
    nicheLabel: 'Ниша аккаунта',
    nicheHint: 'Claude учитывает её, когда пишет подписи',
    youtubeLabel: 'YouTube‑канал',
    youtubeHint: 'Ссылка подставится в пины, а в описании появится призыв перейти на YouTube',
    modelLabel: 'Модель',
    modelHaiku: 'Haiku — быстрее и дешевле',
    modelSonnet: 'Sonnet — точнее',
    save: 'Сохранить',
    build: (stamp: string) => `Сборка ${stamp}`,
  },
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
