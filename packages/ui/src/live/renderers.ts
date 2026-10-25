import { parseMarkdown, renderToHtml } from '@md-reader/core';
import { defaultRenderPlugins } from '@md-reader/core/plugins';
import { renderMermaidToSvg } from '../components/MermaidBlock';
import type { BlockRenderers } from './block-widgets';

export function createDefaultRenderers(): BlockRenderers {
  const plugins = defaultRenderPlugins();
  return {
    table: (src) => renderToHtml(parseMarkdown(src), { highlight: false }).html,
    math: (tex) => `<div class="cm-live-math">${renderToHtml(parseMarkdown(`$$\n${tex}\n$$`), { plugins }).html}</div>`,
    mermaid: (code, theme) => renderMermaidToSvg(code, theme),
  };
}
