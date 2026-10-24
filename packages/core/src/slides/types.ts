import type { RenderOptions } from '../render/index.js'
export interface Slide {
  id: string
  index: number
  rawMarkdown: string
  html: string
  notes: string[]
  title?: string
}

export interface SlideSplitOptions {
  strategy?: 'hr' | 'heading' | 'auto' // default 'auto'
  headingDepth?: number // default 2
  math?: boolean // default true
  /** Extra render options (same as the reader): alerts, typographer, links … */
  render?: Omit<RenderOptions, 'math'>
}
