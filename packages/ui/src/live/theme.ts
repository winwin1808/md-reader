import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export const livePreviewTheme: Extension = EditorView.theme({
  '.cm-content': {
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--body-size)',
    lineHeight: 'var(--body-lh)',
    color: 'var(--ink)',
    maxWidth: 'var(--measure)',
    margin: '0 auto',
  },
  '.cm-live-h1': { fontSize: '2em', fontWeight: '600' },
  '.cm-live-h2': { fontSize: '1.5em', fontWeight: '600' },
  '.cm-live-h3': { fontSize: '1.25em', fontWeight: '600' },
  '.cm-live-strong': { fontWeight: '700' },
  '.cm-live-em': { fontStyle: 'italic' },
  '.cm-live-del': { textDecoration: 'line-through' },
  '.cm-live-quote': { borderLeft: '3px solid var(--rule)', paddingLeft: '1em', color: 'var(--pencil)' },
  '.cm-live-icode': { fontFamily: 'var(--font-code)', backgroundColor: 'var(--surface)' },
  '.cm-live-code': { fontFamily: 'var(--font-code)', backgroundColor: 'var(--surface)' },
  '.cm-live-link': { color: 'var(--accent)', textDecoration: 'underline' },
});

export const livePreviewWidgetTheme: Extension = EditorView.theme({
  '.cm-live-hr': { border: 'none', borderTop: '1px solid var(--rule)', margin: '0.5em 0' },
  '.cm-live-task': { accentColor: 'var(--accent)' },
  '.cm-live-img': { maxWidth: '100%' },
  '.cm-live-lang': { float: 'right', fontSize: '0.75em', color: 'var(--pencil)' },
  '.cm-live-fence-close': { fontSize: '0', lineHeight: '0.5' },
  '.cm-live-alert': { borderLeft: '3px solid var(--accent)', paddingLeft: '1em' },
  '.cm-live-alert-title': { fontWeight: '600' },
  '.cm-live-alert-note': { borderLeftColor: 'var(--accent)' },
  '.cm-live-alert-tip': { borderLeftColor: 'var(--ok)' },
  '.cm-live-alert-important': { borderLeftColor: 'var(--ink)' },
  '.cm-live-alert-warning': { borderLeftColor: 'var(--hl)' },
  '.cm-live-alert-caution': { borderLeftColor: 'var(--danger)' },
});
