import type { RenderOptions } from './types.js'

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

export function applyTypographer(html: string): string {
  const protectedTags = new Set(['pre', 'code', 'script', 'style', 'svg'])
  let result = ''
  let i = 0
  const len = html.length

  while (i < len) {
    if (html[i] === '<') {
      if (html.startsWith('<!--', i)) {
        const end = html.indexOf('-->', i + 4)
        if (end === -1) {
          result += html.slice(i)
          break
        }
        result += html.slice(i, end + 3)
        i = end + 3
        continue
      }

      if (!/[a-zA-Z!/]/.test(html[i + 1] ?? '')) {
        result += replaceTypography(html[i]!)
        i++
        continue
      }

      const tagStart = i
      i++
      const isClosing = html[i] === '/'
      if (isClosing) i++

      const nameStart = i
      while (i < len && /[a-zA-Z0-9:-]/.test(html[i]!)) {
        i++
      }
      const tagName = html.slice(nameStart, i).toLowerCase()

      let inQuote: '"' | "'" | null = null
      while (i < len) {
        const char = html[i]!
        if (inQuote) {
          if (char === inQuote) {
            inQuote = null
          }
        } else if (char === '"' || char === "'") {
          inQuote = char
        } else if (char === '>') {
          i++
          break
        }
        i++
      }

      const tagHtml = html.slice(tagStart, i)
      result += tagHtml

      if (!isClosing && protectedTags.has(tagName) && !tagHtml.endsWith('/>')) {
        const closeTag = `</${tagName}>`
        const lower = html.toLowerCase()
        const closeIndex = lower.indexOf(closeTag, i)
        if (closeIndex === -1) {
          result += html.slice(i)
          break
        }
        result += html.slice(i, closeIndex + closeTag.length)
        i = closeIndex + closeTag.length
      }
    } else {
      const nextTag = html.indexOf('<', i)
      const text = nextTag === -1 ? html.slice(i) : html.slice(i, nextTag)
      result += replaceTypography(text)
      i = nextTag === -1 ? len : nextTag
    }
  }

  return result
}

const EXTERNAL_LINK_ICON = '<svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3"/></svg>'

export function applyExternalLinks(html: string): string {
  return html.replace(/<a\b((?:[^"'>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a>/gi, (match, attrs, content) => {
    if (attrs.includes('class="external-link"') || attrs.includes("class='external-link'") || /\bclass="[^"]*\bexternal-link\b[^"]*"/.test(attrs)) {
      return match
    }

    const hrefMatch = attrs.match(/\bhref=["'](https?:\/\/[^"']+)["']/i)
    if (!hrefMatch) {
      return match
    }

    let newAttrs = attrs
    if (/\bclass="([^"]*)"/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/\bclass="([^"]*)"/i, 'class="$1 external-link"')
    } else if (/\bclass='([^']*)'/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/\bclass='([^']*)'/i, "class='$1 external-link'")
    } else {
      newAttrs += ' class="external-link"'
    }

    newAttrs = newAttrs.replace(/\btarget=["'][^"']*["']/gi, '').replace(/\brel=["'][^"']*["']/gi, '')
    newAttrs += ' target="_blank" rel="noopener noreferrer"'

    const cleanedAttrs = newAttrs.trim().replace(/\s+/g, ' ')
    return `<a ${cleanedAttrs}>${content}${EXTERNAL_LINK_ICON}</a>`
  })
}

export function applyGitHubAlerts(html: string, locale?: string): string {
  const titlesVi: Record<string, string> = {
    NOTE: 'Ghi chú',
    TIP: 'Mẹo',
    IMPORTANT: 'Quan trọng',
    WARNING: 'Cảnh báo',
    CAUTION: 'Chú ý'
  };
  const titlesEn: Record<string, string> = {
    NOTE: 'Note',
    TIP: 'Tip',
    IMPORTANT: 'Important',
    WARNING: 'Warning',
    CAUTION: 'Caution'
  };

  const regex = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n)?([\s\S]*?)<\/blockquote>/ig;
  return html.replace(regex, (match, type, content) => {
    const t = type.toUpperCase();
    const title = locale === 'vi' ? titlesVi[t] : titlesEn[t];
    const typeLower = t.toLowerCase();
    return `<div class="markdown-alert markdown-alert-${typeLower}" role="region" aria-label="${title}"><p class="markdown-alert-title"><svg></svg><span>${title}</span></p><p>${content.trim()}</div>`;
  });
}

export function processFrontmatter(source: string, options?: RenderOptions): { cleanMarkdown: string, metadataHtml?: string } {
  let cleanMarkdown = source;
  let metadataHtml: string | undefined;

  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (match) {
    if (options?.stripFrontmatter || options?.displayMetadata) {
      cleanMarkdown = source.slice(match[0].length);
    }
    if (options?.displayMetadata) {
      const yaml = match[1];
      const lines = yaml.split('\n').filter((l: string) => l.trim());
      const metadata = lines.map((line: string) => {
        const [key, ...rest] = line.split(':');
        return `<div><strong>${key!.trim()}</strong>: ${rest.join(':').trim()}</div>`;
      }).join('');
      metadataHtml = `<div class="markdown-metadata-card">${metadata}</div>`;
    }
  }

  return { cleanMarkdown, metadataHtml };
}
