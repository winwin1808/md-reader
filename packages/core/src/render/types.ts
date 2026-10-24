import type { Plugin } from 'unified'

export interface RenderPlugins { raw?: Plugin<any[], any>; highlight?: Plugin<any[], any>; math?: Plugin<any[], any> }

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
  plugins?: RenderPlugins
  highlight?: boolean
  /** Render math with KaTeX. Default: true */
  math?: boolean
  allowRawHtml?: boolean
  stripFrontmatter?: boolean
  displayMetadata?: boolean
  typographer?: boolean
  externalLinks?: boolean
  githubAlerts?: boolean
  localizeAlerts?: 'vi' | 'en' | string
}
