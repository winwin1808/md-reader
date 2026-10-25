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
