import { useState, type FormEvent } from 'react'
import { getApiKey, setApiKey } from '../lib/keyStore'
import { getSettings, saveSettings, DEFAULT_MODEL } from '../lib/settings'
import { copy } from '../copy'

const MODEL_OPTIONS = [
  { id: DEFAULT_MODEL, label: copy.settings.modelHaiku },
  { id: 'claude-sonnet-4-5-20250929', label: copy.settings.modelSonnet },
]

const CONSOLE_URL = 'https://console.anthropic.com/settings/keys'

interface Props {
  /** First launch without a key: explain what's needed, fewer fields. */
  onboarding: boolean
  onSaved: (apiKey: string | null) => void
}

export default function SettingsScreen({ onboarding, onSaved }: Props) {
  const initial = getSettings()
  const [apiKey, setApiKeyField] = useState(getApiKey() ?? '')
  const [niche, setNiche] = useState(initial.niche)
  const [model, setModel] = useState(initial.model)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiKey(apiKey)
    saveSettings({ ...getSettings(), niche: niche.trim() || initial.niche, model })
    onSaved(getApiKey())
  }

  return (
    <form className="screen settings-screen" onSubmit={handleSubmit}>
      {onboarding ? (
        <>
          <h1>{copy.onboarding.title}</h1>
          <p className="lead">{copy.onboarding.lead}</p>
          <a className="text-link" href={CONSOLE_URL} target="_blank" rel="noreferrer">
            {copy.onboarding.consoleLink} ↗
          </a>
        </>
      ) : (
        <h1>{copy.settings.title}</h1>
      )}

      <label className="field">
        <span>{copy.settings.keyLabel}</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKeyField(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required={onboarding}
        />
      </label>

      <label className="field">
        <span>{copy.settings.nicheLabel}</span>
        <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="lifestyle" />
        <span className="field-hint">{copy.settings.nicheHint}</span>
      </label>

      {!onboarding && (
        <label className="field">
          <span>{copy.settings.modelLabel}</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className="button button-primary button-block">
        {onboarding ? copy.onboarding.submit : copy.settings.save}
      </button>

      {!onboarding && <p className="build-stamp">{copy.settings.build(__BUILD_STAMP__)}</p>}
    </form>
  )
}
