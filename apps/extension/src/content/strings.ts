// Tiny local map for the content script (budget-sensitive: must not import @md-reader/ui).
export type ContentLocale = 'vi' | 'en' | 'it' | 'fr' | 'de'

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
  it: {
    fail: "Impossibile aprire MD Reader. Prova a fare clic sull'icona di MD Reader nella barra degli strumenti.",
    docTitle: 'Documento Markdown',
    opening: 'Apertura...',
    open: 'Leggi in MD Reader',
    viewRaw: 'Mostra sorgente',
    viewRead: 'Mostra formattato',
    openTitle: 'Apri MD Reader',
    hide: 'Nascondi',
  },
  fr: {
    fail: "Impossible d'ouvrir MD Reader. Essayez de cliquer sur l'icône MD Reader dans la barre d'outils.",
    docTitle: 'Document Markdown',
    opening: 'Ouverture...',
    open: 'Lire dans MD Reader',
    viewRaw: 'Voir le texte brut',
    viewRead: 'Voir le rendu',
    openTitle: 'Ouvrir MD Reader',
    hide: 'Masquer',
  },
  de: {
    fail: 'MD Reader konnte nicht geöffnet werden. Klicken Sie auf das MD Reader-Symbol in der Symbolleiste.',
    docTitle: 'Markdown-Dokument',
    opening: 'Wird geöffnet...',
    open: 'In MD Reader lesen',
    viewRaw: 'Rohtext anzeigen',
    viewRead: 'Formatiert anzeigen',
    openTitle: 'MD Reader öffnen',
    hide: 'Ausblenden',
  },
}

const LOCALES: readonly string[] = ['vi', 'en', 'it', 'fr', 'de']

/** Same rule as @md-reader/ui resolveLocale, duplicated to keep content.js small. */
export function resolveContentLocale(pref: unknown, langs: readonly string[] | undefined): ContentLocale {
  if (typeof pref === 'string' && LOCALES.includes(pref)) return pref as ContentLocale
  for (const l of langs ?? []) {
    const main = String(l).toLowerCase().split('-')[0] ?? ''
    if (LOCALES.includes(main)) return main as ContentLocale
  }
  return 'en'
}
