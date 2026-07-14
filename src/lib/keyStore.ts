const KEY = 'pinbuddy.apiKey'

export function setApiKey(value: string): void {
  const v = value.trim()
  if (!v) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, v)
}

export function getApiKey(): string | null {
  const v = localStorage.getItem(KEY)?.trim()
  return v ? v : null
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY)
}
