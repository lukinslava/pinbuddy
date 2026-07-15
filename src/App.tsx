import { useEffect, useState } from 'react'
import { getApiKey } from './lib/keyStore'
import GalleryView from './components/GalleryView'
import SettingsView from './components/SettingsView'
import './styles.css'

type View = 'gallery' | 'settings'

function App() {
  const [view, setView] = useState<View>('gallery')
  const hasKey = getApiKey() !== null

  useEffect(() => {
    // Returning to an iOS home-screen PWA after navigator.share() hands off to
    // another app (e.g. Pinterest) can leave WebKit's native share sheet
    // rendered as a stale compositing artifact over the page — a known WebKit
    // bug, not something this app's share logic causes. A cheap forced reflow
    // on regaining visibility clears that artifact without a destructive
    // reload; the manual "Обновить" button below is the fallback if it doesn't.
    function nudgeRepaint() {
      if (document.visibilityState !== 'visible') return
      window.scrollTo({ top: 1 })
      requestAnimationFrame(() => window.scrollTo({ top: 0 }))
    }
    document.addEventListener('visibilitychange', nudgeRepaint)
    return () => document.removeEventListener('visibilitychange', nudgeRepaint)
  }, [])

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
          <button
            type="button"
            className="reload-button"
            onClick={() => window.location.reload()}
            aria-label="Обновить страницу"
            title="Если экран выглядит зависшим после Pinterest — нажмите, чтобы обновить"
          >
            ⟳
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
