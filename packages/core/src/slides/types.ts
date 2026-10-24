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
}
