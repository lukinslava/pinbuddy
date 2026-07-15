import { useEffect, useState } from 'react'
import { getApiKey, setApiKey } from '../lib/keyStore'
import { getSettings, saveSettings, DEFAULT_MODEL, type Settings } from '../lib/settings'

const MODEL_OPTIONS = [
  { id: DEFAULT_MODEL, label: 'Haiku (быстрее, дешевле)' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet (качественнее)' },
]

interface Props {
  onDone: () => void
}

export default function SettingsView({ onDone }: Props) {
  const [apiKey, setApiKeyField] = useState('')
  const [niche, setNiche] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const s: Settings = getSettings()
    setNiche(s.niche)
    setModel(s.model)
    setApiKeyField(getApiKey() ?? '')
  }, [])

  function handleSave() {
    setApiKey(apiKey)
    saveSettings({ ...getSettings(), niche, model })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-view">
      <h1>Настройки</h1>

      <label className="field">
        <span>API-ключ Claude</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKeyField(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>Ниша (для подсказок модели)</span>
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="lifestyle"
        />
      </label>

      <label className="field">
        <span>Модель</span>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="settings-actions">
        <button type="button" onClick={handleSave}>
          Сохранить
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Назад
        </button>
      </div>

      {saved && <p className="confirmation">Сохранено</p>}
    </div>
  )
}
