export type IconName =
  | 'book' | 'edit' | 'split' | 'present' | 'mindmap' | 'export' | 'settings' | 'search' | 'close'
  | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'more' | 'open-file' | 'save' | 'check' | 'alert' | 'fullscreen'
  | 'zoom-in' | 'zoom-out' | 'expand-all' | 'collapse-all' | 'copy' | 'speaker' | 'toc' | 'font-smaller' | 'font-larger'
  | 'undo' | 'redo' | 'menu' | 'share'

// 24-grid line icons, 2px padding, stroke only. Circles are expressed as path arcs.
const PATHS: Record<IconName, string[]> = {
  book: ['M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5', 'M12 6.5C14 5 17 4.5 20.5 5v13c-3.5-.5-6.5 0-8.5 1.5', 'M12 6.5v13'],
  edit: ['M15.5 4.5l4 4L8 20l-4.5 1 1-4.5z', 'M13.5 6.5l4 4'],
  split: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M12 5v14'],
  present: ['M3 4h18', 'M5 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4', 'M12 15v4', 'M8 21l4-2 4 2'],
  mindmap: ['M5 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M19 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M7 12h10', 'M7 12c4 0 5-7 10-7', 'M7 12c4 0 5 7 10 7'],
  export: ['M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5', 'M12 15V4', 'M7.5 8.5L12 4l4.5 4.5'],
  settings: ['M4 7h10', 'M18 7h2', 'M14 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M4 17h2', 'M10 17h10', 'M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z', 'M16 16l4.5 4.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  'chevron-left': ['M14.5 5.5L8 12l6.5 6.5'],
  'chevron-right': ['M9.5 5.5L16 12l-6.5 6.5'],
  'chevron-down': ['M5.5 9.5L12 16l6.5-6.5'],
  more: ['M5 12m-.6 0a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0', 'M12 12m-.6 0a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0', 'M19 12m-.6 0a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0'],
  'open-file': ['M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],
  save: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 4h7v5H8z', 'M7 20v-7h10v7'],
  check: ['M4.5 12.5l5 5 10-11'],
  alert: ['M12 3.5L2.5 20h19z', 'M12 10v4.5', 'M12 17.2v.3'],
  fullscreen: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  'zoom-in': ['M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z', 'M16 16l4.5 4.5', 'M8 11h6', 'M11 8v6'],
  'zoom-out': ['M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z', 'M16 16l4.5 4.5', 'M8 11h6'],
  'expand-all': ['M6 8l6-5 6 5', 'M6 16l6 5 6-5'],
  'collapse-all': ['M6 4l6 5 6-5', 'M6 20l6-5 6 5'],
  copy: ['M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z', 'M16 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'],
  speaker: ['M12 6m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M7.5 13a4.5 4 0 0 1 9 0', 'M6 14h12l-2 7H8z'],
  toc: ['M4 6h.01', 'M4 12h.01', 'M4 18h.01', 'M8.5 6H20', 'M8.5 12H20', 'M8.5 18H20'],
  'font-smaller': ['M3 18L8 5l5 13', 'M4.8 14h6.4', 'M15 6h6'],
  'font-larger': ['M3 18L8 5l5 13', 'M4.8 14h6.4', 'M15 6h6', 'M18 3v6'],
  undo: ['M9 5L4 10l5 5', 'M4 10h10a6 6 0 0 1 0 12h-3'],
  redo: ['M15 5l5 5-5 5', 'M20 10H10a6 6 0 0 0 0 12h3'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  share: ['M18 5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M6 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M18 19m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M8.2 10.8l7.6-4.6', 'M8.2 13.2l7.6 4.6'],
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[]

export function Icon(props: { name: IconName; size?: 16 | 20 | 24; label?: string; className?: string }) {
  const size = props.size ?? 20
  const a11y = props.label
    ? { role: 'img' as const, 'aria-label': props.label }
    : { 'aria-hidden': true as const }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={props.className}
      {...a11y}
    >
      {PATHS[props.name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

export function iconSvg(name: IconName, size: 16 | 20 | 24 = 20): string {
  const paths = PATHS[name].map((d) => `<path d="${d}"></path>`).join('')
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${paths}</svg>`
}
