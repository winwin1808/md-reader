import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { parse } from 'yaml'
import type { RenderPlugins } from '../render/types.js'

type MathPlugin = (this: any, ...args: any[]) => any

let loaded: MathPlugin | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

/** Loads KaTeX (rehype-katex) as a separate chunk. Idempotent. */
export function loadMathPlugin(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loading) {
    loading = import('rehype-katex')
      .then((m) => {
        loaded = m.default as unknown as MathPlugin
        for (const cb of [...listeners]) cb()
      })
      .catch(() => { loading = null })
  }
  return loading
}

export function isMathLoaded(): boolean {
  return loaded !== null
}

/** Called once KaTeX has loaded, so callers can re-render. Returns unsubscribe. */
export function onMathLoaded(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function hasMathNode(node: any): boolean {
  const cls = node?.properties?.className
  if (Array.isArray(cls) && cls.some((c: unknown) => c === 'math-inline' || c === 'math-display')) return true
  return Array.isArray(node?.children) && node.children.some(hasMathNode)
}

/** Sync wrapper: no-op until KaTeX is loaded; triggers the load only when the tree has math. */
const lazyKatex = function (this: any, ...args: any[]) {
  const self = this
  return (tree: any, file: any) => {
    if (!loaded) {
      if (hasMathNode(tree)) void loadMathPlugin()
      return
    }
    const t = loaded.apply(self, args)
    return typeof t === 'function' ? t(tree, file) : undefined
  }
}

export function defaultRenderPlugins(): RenderPlugins {
  return { raw: rehypeRaw, highlight: rehypeHighlight, math: lazyKatex as any }
}

export const parseYaml: (src: string) => unknown = (src) => parse(src)
