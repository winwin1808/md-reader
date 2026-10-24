import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { parse } from 'yaml'
import type { RenderPlugins } from '../render/types.js'

export function defaultRenderPlugins(): RenderPlugins {
  return { raw: rehypeRaw, highlight: rehypeHighlight, math: rehypeKatex }
}

export const parseYaml: (src: string) => unknown = (src) => parse(src)
