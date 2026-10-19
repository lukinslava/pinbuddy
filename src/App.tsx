import { useEffect, useState } from 'react'
import { getApiKey } from './lib/keyStore'
import { useGallery } from './lib/useGallery'
import { copy } from './copy'
import PinList from './components/PinList'
import PinScreen from './components/PinScreen'
import SettingsScreen from './components/SettingsScreen'
import './styles.css'

type Route = { name: 'list' } | { name: 'pin'; id: string } | { name: 'settings' }

function App() {
  const [apiKey, setApiKey] = useState(getApiKey)
  const [route, setRoute] = useState<Route>({ name: 'list' })
  const gallery = useGallery(apiKey)

  useEffect(() => {
    // Returning to an iOS home-screen PWA after navigator.share() hands off to
    // another app (e.g. Pinterest) can leave WebKit's native share sheet
    // rendered as a stale compositing artifact over the page — a known WebKit
    // bug, not something this app's share logic causes. A cheap forced reflow
    // on regaining visibility clears that artifact without a destructive
    // reload; the manual reload button is the fallback if it doesn't (safe to
    // use: the gallery is persisted in IndexedDB).
    function nudgeRepaint() {
      if (document.visibilityState !== 'visible') return
      window.scrollTo({ top: window.scrollY + 1 })
      requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, window.scrollY - 1) }))
    }
    document.addEventListener('visibilitychange', nudgeRepaint)
    return () => document.removeEventListener('visibilitychange', nudgeRepaint)
  }, [])

  function go(next: Route) {
    setRoute(next)
    if (next.name !== 'list') window.scrollTo({ top: 0 })
  }

  const onboarding = apiKey === null && gallery.loaded && gallery.items.length === 0
  const pinIndex = route.name === 'pin' ? gallery.items.findIndex((it) => it.id === route.id) : -1
  const pin = pinIndex >= 0 ? gallery.items[pinIndex] : null

  // Next unpublished pin after this one (wrapping), so "Да, к следующему"
  // walks through the batch in order.
  let nextId: string | null = null
  if (pin) {
    const n = gallery.items.length
    for (let k = 1; k < n; k++) {
      const it = gallery.items[(pinIndex + k) % n]
      if (!it.published) {
        nextId = it.id
        break
      }
    }
  }

  const showBack = route.name !== 'list' && !onboarding

  return (
    <div className="app">
      <header className="app-header">
        {showBack ? (
          <button type="button" className="header-back" onClick={() => go({ name: 'list' })}>
            ‹ {copy.allPins}
          </button>
        ) : (
          <span className="app-title">{copy.appName}</span>
        )}
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => window.location.reload()}
            aria-label={copy.reload}
            title={copy.reload}
          >
            ⟳
          </button>
          {!onboarding && route.name !== 'settings' && (
            <button
              type="button"
              className="icon-button"
              onClick={() => go({ name: 'settings' })}
              aria-label={copy.openSettings}
              title={copy.openSettings}
            >
              ⚙
            </button>
          )}
        </div>
      </header>

      <main>
        {onboarding ? (
          <SettingsScreen onboarding onSaved={setApiKey} />
        ) : (
          <>
            {/* The list stays mounted so its scroll position survives a visit to a pin. */}
            <div hidden={route.name !== 'list'}>
              <PinList
                gallery={gallery}
                hasKey={apiKey !== null}
                onOpen={(id) => go({ name: 'pin', id })}
                onOpenSettings={() => go({ name: 'settings' })}
              />
            </div>
            {route.name === 'pin' && pin && (
              <PinScreen
                key={pin.id}
                item={pin}
                position={pinIndex + 1}
                total={gallery.items.length}
                nextId={nextId}
                hasKey={apiKey !== null}
                gallery={gallery}
                onOpen={(id) => go({ name: 'pin', id })}
                onBack={() => go({ name: 'list' })}
              />
            )}
            {route.name === 'settings' && (
              <SettingsScreen
                onboarding={false}
                onSaved={(key) => {
                  setApiKey(key)
                  go({ name: 'list' })
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
