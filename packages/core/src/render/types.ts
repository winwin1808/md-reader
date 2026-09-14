export interface TocEntry {
  id: string
  depth: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  children: TocEntry[]
}

export interface RenderResult {
  html: string
  toc: TocEntry[]
}

export interface RenderOptions {
  highlight?: boolean
  allowRawHtml?: boolean
  stripFrontmatter?: boolean
  displayMetadata?: boolean
  typographer?: boolean
  externalLinks?: boolean
  githubAlerts?: boolean
  localizeAlerts?: 'vi' | 'en' | string
}
