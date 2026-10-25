import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { hideMarks } from './hide-marks'
import { inlineWidgets } from './widgets'
import { blockWidgets, type BlockRenderers } from './block-widgets'
import { livePreviewTheme, livePreviewWidgetTheme, livePreviewBlockTheme } from './theme'

export function livePreview(r: BlockRenderers, opts?: { theme?: () => 'default' | 'dark' }): Extension[] {
  return [
    hideMarks(),
    inlineWidgets(),
    blockWidgets(r, opts),
    livePreviewTheme,
    livePreviewWidgetTheme,
    livePreviewBlockTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ class: 'cm-live', spellcheck: 'true', lang: 'vi' }),
  ]
}

export { createDefaultRenderers } from './renderers'
export type { BlockRenderers } from './block-widgets'
export { pasteImages, toDataUrl } from './paste-images'
export type { ImageSaver } from './paste-images'
