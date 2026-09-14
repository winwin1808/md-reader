import type { RenderOptions } from './types.js'

export function applyTypographer(html: string): string {
  const regex = /(<(?:pre|code|script|style|svg)[^>]*>[\s\S]*?<\/(?:pre|code|script|style|svg)>|<[^>]+>)/ig;
  const parts = html.split(regex);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      let text = parts[i]!;
      text = text.replace(/\(c\)/ig, '©');
      text = text.replace(/\(tm\)/ig, '™');
      text = text.replace(/\(r\)/ig, '®');
      text = text.replace(/---/g, '—');
      text = text.replace(/--/g, '–');
      
      text = text.replace(/(^|[-\u2014\s(\["])'/g, '$1‘');
      text = text.replace(/'/g, '’');
      text = text.replace(/(^|[-\u2014\s(\[])"/g, '$1“');
      text = text.replace(/"/g, '”');
      
      parts[i] = text;
    }
  }
  return parts.join('');
}

export function applyExternalLinks(html: string): string {
  return html.replace(/<a ([^>]*)href="(https?:\/\/[^"]+)"([^>]*)>/gi, (match, before, url, after) => {
    if (match.includes('class="external-link"')) return match;
    const innerAttr = (before + after).replace(/class="([^"]*)"/, (m, c) => `class="${c} external-link"`).replace(/target="[^"]*"/, '').replace(/rel="[^"]*"/, '');
    let attrs = innerAttr;
    if (!attrs.includes('class=')) {
      attrs += ' class="external-link"';
    }
    attrs += ' target="_blank" rel="noopener noreferrer"';
    return `<a href="${url}" ${attrs.trim()}><svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3"/></svg></a>`;
  });
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
