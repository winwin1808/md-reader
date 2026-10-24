import type { Root, Element, ElementContent, RootContent } from 'hast'

type Child = ElementContent | RootContent

const ALERT_PATHS: Record<string, string> = {
  NOTE: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  TIP: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.18.213-.362.43-.542.681-.207.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6.25 15h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5Z',
  IMPORTANT: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  WARNING: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  CAUTION: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'
}

const TITLES_VI: Record<string, string> = {
  NOTE: 'Ghi chú',
  TIP: 'Mẹo',
  IMPORTANT: 'Quan trọng',
  WARNING: 'Cảnh báo',
  CAUTION: 'Chú ý',
}
const TITLES_EN: Record<string, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
}

const EXTERNAL_LINK_PATH = 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3'

function el(tagName: string, properties: Element['properties'], children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children }
}

function text(value: string): ElementContent {
  return { type: 'text', value }
}

function walk(node: Root | Element, fn: (node: Element, parent: Root | Element, index: number) => void): void {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i] as Child
    if (child.type === 'element') {
      fn(child, node, i)
      const current = node.children[i] as Child
      if (current.type === 'element') walk(current, fn)
    }
  }
}

function classList(node: Element): string[] {
  const c: unknown = node.properties?.className
  if (Array.isArray(c)) return c.map(String)
  if (typeof c === 'string') return c.split(/\s+/).filter(Boolean)
  return []
}

export function rehypeGithubAlerts(options: { locale: 'vi' | 'en' }) {
  const titles = options.locale === 'vi' ? TITLES_VI : TITLES_EN
  return (tree: Root) => {
    walk(tree, (node, parent, index) => {
      if (node.tagName !== 'blockquote') return
      const firstEl = node.children.find((c) => c.type === 'element') as Element | undefined
      if (!firstEl || firstEl.tagName !== 'p') return
      const first = firstEl.children[0]
      if (!first || first.type !== 'text') return
      const m = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(first.value)
      if (!m) return
      const type = m[1]!.toUpperCase()
      const title = titles[type]!
      first.value = first.value.slice(m[0].length)
      if (first.value.startsWith('\n')) {
        first.value = first.value.slice(1)
      } else if (first.value === '') {
        const next = firstEl.children[1]
        if (next && next.type === 'element' && next.tagName === 'br') {
          firstEl.children.splice(1, 1)
        }
      }
      if (first.value === '') firstEl.children.shift()

      const icon = el(
        'svg',
        { className: ['markdown-alert-icon'], viewBox: '0 0 16 16', width: 16, height: 16, ariaHidden: 'true' },
        [el('path', { d: ALERT_PATHS[type]! })],
      )
      const div = el(
        'div',
        { className: ['markdown-alert', `markdown-alert-${type.toLowerCase()}`], role: 'region', ariaLabel: title },
        [
          el('p', { className: ['markdown-alert-title'] }, [icon, el('span', {}, [text(title)])]),
          ...node.children,
        ],
      )
      ;(parent.children as Child[])[index] = div
    })
  }
}

export function rehypeExternalLinks() {
  return (tree: Root) => {
    walk(tree, (node) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.href
      if (typeof href !== 'string' || !/^https?:\/\//i.test(href)) return
      const classes = classList(node)
      node.properties = {
        ...node.properties,
        className: classes.includes('external-link') ? classes : [...classes, 'external-link'],
        target: '_blank',
        rel: ['noopener', 'noreferrer'],
      }
      const last = node.children[node.children.length - 1]
      if (last && last.type === 'element' && last.tagName === 'svg' && classList(last).includes('external-link-icon')) return
      node.children.push(
        el(
          'svg',
          { className: ['external-link-icon'], xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', width: 16, height: 16 },
          [
            el('path', {
              fill: 'none',
              stroke: 'currentColor',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: '2',
              d: EXTERNAL_LINK_PATH,
            }),
          ],
        ),
      )
    })
  }
}

export function rehypePrefixFragmentLinks(prefix: string) {
  return (tree: Root) => {
    walk(tree, (node) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.href
      if (typeof href !== 'string' || !href.startsWith('#') || href.length < 2) return
      const rest = href.slice(1)
      if (rest.startsWith(prefix)) return
      node.properties = { ...node.properties, href: '#' + prefix + rest }
    })
  }
}

export function rehypeSafeLinkTargets() {
  return (tree: Root) => {
    walk(tree, (node) => {
      if (node.tagName !== 'a' || node.properties?.target === undefined) return
      const r: unknown = node.properties.rel
      const existing = Array.isArray(r) ? r.map(String) : typeof r === 'string' ? r.split(/\s+/).filter(Boolean) : []
      const rel = [...new Set([...existing, 'noopener', 'noreferrer'])]
      node.properties = { ...node.properties, rel }
    })
  }
}

function replaceTypography(text: string): string {
  let res = text
  res = res.replace(/\(c\)/gi, '©')
  res = res.replace(/\(tm\)/gi, '™')
  res = res.replace(/\(r\)/gi, '®')
  res = res.replace(/---/g, '—')
  res = res.replace(/--/g, '–')

  res = res.replace(/(^|[-\u2014\s(\["])'/g, '$1‘')
  res = res.replace(/'/g, '’')
  res = res.replace(/(^|[-\u2014\s(\[])"/g, '$1“')
  res = res.replace(/"/g, '”')

  return res
}

const TYPO_SKIP = new Set(['pre', 'code', 'kbd', 'script', 'style', 'svg'])

export function rehypeTypographer() {
  const visit = (node: Root | Element): void => {
    for (const child of node.children as Child[]) {
      if (child.type === 'text') {
        child.value = replaceTypography(child.value)
      } else if (child.type === 'element' && !TYPO_SKIP.has(child.tagName)) {
        visit(child)
      }
    }
  }
  return (tree: Root) => visit(tree)
}

export function rehypeMetadataCard(frontmatter: Record<string, unknown>) {
  return (tree: Root) => {
    const rows = Object.entries(frontmatter).map(([key, val]) => {
      const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')
      return el('div', {}, [el('strong', {}, [text(key)]), text(`: ${valStr}`)])
    })
    tree.children.unshift(el('div', { className: ['markdown-metadata-card'] }, rows))
  }
}
