import { useState } from 'react'
import { getApiKey } from './lib/keyStore'
import GalleryView from './components/GalleryView'
import SettingsView from './components/SettingsView'
import './styles.css'

type View = 'gallery' | 'settings'

function App() {
  const [view, setView] = useState<View>('gallery')
  const hasKey = getApiKey() !== null

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">PinBuddy</h1>
        <nav>
          <button
            type="button"
            className={view === 'gallery' ? 'nav-active' : ''}
            onClick={() => setView('gallery')}
          >
            Галерея
          </button>
          <button
            type="button"
            className={view === 'settings' ? 'nav-active' : ''}
            onClick={() => setView('settings')}
          >
            Настройки
          </button>
        </nav>
      </header>

      <main>
        {view === 'gallery' && !hasKey && (
          <button type="button" className="no-key-banner" onClick={() => setView('settings')}>
            API-ключ не задан — нажмите, чтобы открыть настройки
          </button>
        )}

        {view === 'gallery' ? <GalleryView /> : <SettingsView onDone={() => setView('gallery')} />}
      </main>
    </div>
  )
}

export default App
