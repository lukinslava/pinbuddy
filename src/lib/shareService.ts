import type { GeneratedCaption } from '../types'

/** The editable caption: title, then description. Legacy captions keep their hashtags. */
export function captionText(c: GeneratedCaption): string {
  return [c.title, c.description, (c.tags ?? []).join(' ')].filter(Boolean).join('\n\n')
}

/**
 * What goes to the clipboard. The YouTube link rides along as the last line
 * so it can be moved into Pinterest's link field without coming back here —
 * returning mid-share leaves the iOS share sheet stuck.
 */
export function clipboardText(text: string, link: string): string {
  const l = link.trim()
  return l ? `${text.trimEnd()}\n\n${l}` : text
}

/** Copies the given text to clipboard and opens the OS share sheet with the media file. */
export async function shareToPinterest(text: string, file: File): Promise<'shared'|'copied'|'unsupported'> {
  try { await navigator.clipboard.writeText(text) } catch { /* non-fatal */ }

  const canFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (navigator.share && canFiles) {
    // Pinterest reads a video "files + text" share as text-only ("sharing text
    // on its own isn't possible"), so send the file alone for video. Photos
    // accept the accompanying text fine. Caption is on the clipboard either way.
    const isVideo = file.type.startsWith('video')
    const payload = isVideo ? { files: [file] } : { files: [file], text }
    try { await navigator.share(payload); return 'shared' }
    catch { return 'copied' } // user cancelled or share failed; text is on clipboard
  }
  return 'unsupported' // caller shows fallback (download + open Pinterest)
}
