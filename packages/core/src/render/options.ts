import type { RenderOptions } from './types.js'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
