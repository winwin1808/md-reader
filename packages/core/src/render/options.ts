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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ALERT_ICONS: Record<string, string> = {
  NOTE: '<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>',
  TIP: '<path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.18.213-.362.43-.542.681-.207.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6.25 15h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5Z"/>',
  IMPORTANT: '<path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>',
  WARNING: '<path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>',
  CAUTION: '<path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>'
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
    const icon = `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ALERT_ICONS[t] ?? ''}</svg>`;
    return `<div class="markdown-alert markdown-alert-${typeLower}" role="region" aria-label="${title}"><p class="markdown-alert-title">${icon}<span>${title}</span></p><p>${content.trim()}</div>`;
  });
}

export function processFrontmatter(source: string, options?: RenderOptions): { cleanMarkdown: string, metadataHtml?: string } {
  let cleanMarkdown = source;
  let metadataHtml: string | undefined;

  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (match) {
    if (options?.stripFrontmatter || options?.displayMetadata) {
      cleanMarkdown = source.slice(match[0].length);
    }
    if (options?.displayMetadata) {
      const yaml = match[1] ?? '';
      const lines = yaml.split(/\r?\n/).filter((l: string) => l.trim());
      const metadata = lines.map((line: string) => {
        const [key, ...rest] = line.split(':');
        const escapedKey = escapeHtml(key!.trim());
        const escapedVal = escapeHtml(rest.join(':').trim());
        return `<div><strong>${escapedKey}</strong>: ${escapedVal}</div>`;
      }).join('');
      metadataHtml = `<div class="markdown-metadata-card">${metadata}</div>`;
    }
  }

  return { cleanMarkdown, metadataHtml };
}
