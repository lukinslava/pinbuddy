// Tracking parameters YouTube and others add to shared links (?si=…, utm_*).
const TRACKING = /^(si|feature|pp|utm_[a-z_]+|fbclid|gclid|igshid)$/i

/** Trims a URL and drops tracking parameters; non-URLs are returned trimmed. */
export function cleanLink(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return s
  }
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key)
  return url.toString().replace(/\?$/, '')
}
