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
    titleLabel: 'Заголовок',
    descriptionLabel: 'Описание',
    linkLabel: 'Ссылка на YouTube',
    counter: (n: number, max: number) => `${n} / ${max}`,
    copyField: 'Копировать',
    copiedField: 'Скопировано',
    failedTitle: 'Не удалось написать подпись',
    retry: 'Повторить',
    copyFailed: 'Не получилось скопировать. Выделите текст и скопируйте вручную',
    publish: 'Опубликовать',
    publishing: 'Открываю…',
    photoHint: 'Фото и описание уйдут в Pinterest. Заголовок и ссылку добавите после публикации',
    videoHint: 'Видео публикуется вручную: поля копируются по одному',
    afterPhotoTitle: 'Добавьте заголовок и ссылку',
    afterPhotoSteps: (link: boolean) =>
      [
        'В Pinterest откройте пин и нажмите «Изменить»',
        'Скопируйте заголовок и вставьте в поле Title',
        link ? 'Скопируйте ссылку и вставьте в поле Website' : '',
      ].filter(Boolean),
    videoHelpTitle: 'Видео публикуется вручную',
    manualHelpTitle: 'Отправить файл не получилось',
    manualSteps: (video: boolean, link: boolean) =>
      [
        'Откройте Pinterest и создайте пин',
        video ? 'Выберите это видео из галереи' : 'Выберите это фото из галереи',
        'Скопируйте заголовок и вставьте в поле Title',
        'Скопируйте описание и вставьте в поле Description',
        link ? 'Скопируйте ссылку и вставьте в поле Website' : '',
      ].filter(Boolean),
    topicsLabel: 'Темы',
    topicsHint: 'Если Pinterest предложит выбрать темы, отметьте эти. Зрители их не видят',
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
