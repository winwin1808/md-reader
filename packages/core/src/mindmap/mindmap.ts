import { extractToc, type TocEntry } from '../render/index.js'

export interface MindNode {
  id: string
  text: string
  depth: number
  headingId?: string
  children: MindNode[]
}

export function extractMindmap(mdast: any, fallbackTitle?: string): MindNode {
  const rootText = fallbackTitle?.trim() || 'Root'
  const rootNode: MindNode = {
    id: 'root',
    text: rootText,
    depth: 0,
    children: [],
  }

  if (!mdast || !Array.isArray(mdast.children)) {
    return rootNode
  }

  const toc = extractToc(mdast)

  const toMindNode = (entry: TocEntry): MindNode => ({
    id: entry.id,
    text: entry.text.trim(),
    depth: entry.depth,
    headingId: entry.id,
    children: entry.children.map(toMindNode),
  })

  rootNode.children = toc.map(toMindNode)
  return rootNode
}
