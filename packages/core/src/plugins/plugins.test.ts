import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMarkdown } from '../parse/index.js'
import { renderToHtml } from '../render/index.js'
import { defaultRenderPlugins, parseYaml, loadMathPlugin } from './index.js'
beforeAll(() => loadMathPlugin())

describe('plugins entry', () => {
  it('renders hljs and katex with default plugins', () => {
    const r = renderToHtml(parseMarkdown('```js\nconst a=1\n```\n\n$x^2$', { math: true }), { plugins: defaultRenderPlugins() })
    expect(r.html).toContain('hljs')
    expect(r.html).toContain('katex')
  })
  it('parseYaml', () => { expect(parseYaml('a: 1')).toEqual({ a: 1 }) })
  it('fresh object', () => { expect(defaultRenderPlugins()).not.toBe(defaultRenderPlugins()) })
  it('index.ts does not reference plugins/', () => {
    const t = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8')
    expect(t).not.toContain('plugins/')
  })
})
