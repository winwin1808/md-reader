// Tiny local map for the content script (budget-sensitive: must not import @md-reader/ui).
export type ContentLocale = 'vi' | 'en'

export interface ContentStrings {
  fail: string
  docTitle: string
  opening: string
  open: string
  viewRaw: string
  viewRead: string
  openTitle: string
  hide: string
}

export const CONTENT_STRINGS: Record<ContentLocale, ContentStrings> = {
  vi: {
    fail: 'Không mở được MD Reader. Thử bấm biểu tượng MD Reader trên thanh công cụ.',
    docTitle: 'Tài liệu Markdown',
    opening: 'Đang mở...',
    open: 'Đọc trong MD Reader',
    viewRaw: 'Xem bản thô',
    viewRead: 'Xem bản đọc',
    openTitle: 'Mở MD Reader',
    hide: 'Ẩn',
  },
  en: {
    fail: 'Could not open MD Reader. Try clicking the MD Reader icon in the toolbar.',
    docTitle: 'Markdown document',
    opening: 'Opening...',
    open: 'Read in MD Reader',
    viewRaw: 'View raw',
    viewRead: 'View rendered',
    openTitle: 'Open MD Reader',
    hide: 'Hide',
  },
}

/** Same rule as @md-reader/ui resolveLocale, duplicated to keep content.js small. */
export function resolveContentLocale(pref: unknown, langs: readonly string[] | undefined): ContentLocale {
  if (pref === 'vi' || pref === 'en') return pref
  const first = (langs ?? [])[0]
  return first && first.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}
