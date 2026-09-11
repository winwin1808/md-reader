import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ExternalHyperlink,
  ShadingType,
  AlignmentType,
  LevelFormat,
} from 'docx'
import type {
  Root,
  RootContent,
  PhrasingContent,
  List,
  Blockquote,
  Code,
  Table as MdastTable,
} from 'mdast'

export interface ExportDocxOptions {
  mdast: Root
  title?: string
  imageMap?: Record<string, { buffer: ArrayBuffer; width: number; height: number }>
}

interface PhrasingStyle {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  font?: string
  style?: string
}

interface NumberingLevelConfig {
  level: number
  format: (typeof LevelFormat)[keyof typeof LevelFormat]
  text: string
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType]
}

interface NumberingConfigItem {
  reference: string
  levels: NumberingLevelConfig[]
}

const HEADING_LEVEL_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

function getImageType(url: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const withoutQuery = url.split('?')[0] ?? ''
  const clean = (withoutQuery.split('#')[0] ?? '').toLowerCase()
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpg'
  if (clean.endsWith('.gif')) return 'gif'
  if (clean.endsWith('.bmp')) return 'bmp'
  return 'png'
}

function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { value?: unknown; children?: unknown[] }
  if (typeof n.value === 'string') return n.value
  if (Array.isArray(n.children)) {
    return n.children.map(extractText).join('')
  }
  return ''
}

function convertPhrasingNode(
  node: PhrasingContent | unknown,
  options: ExportDocxOptions,
  style: PhrasingStyle = {}
): (TextRun | ImageRun | ExternalHyperlink)[] {
  const n = node as Record<string, any>
  if (!n || typeof n.type !== 'string') return []

  switch (n.type) {
    case 'text': {
      return [
        new TextRun({
          text: n.value ?? '',
          bold: style.bold,
          italics: style.italics,
          strike: style.strike,
          font: style.font,
          style: style.style,
        }),
      ]
    }
    case 'strong': {
      return (n.children ?? []).flatMap((child: PhrasingContent) =>
        convertPhrasingNode(child, options, { ...style, bold: true })
      )
    }
    case 'emphasis': {
      return (n.children ?? []).flatMap((child: PhrasingContent) =>
        convertPhrasingNode(child, options, { ...style, italics: true })
      )
    }
    case 'delete': {
      return (n.children ?? []).flatMap((child: PhrasingContent) =>
        convertPhrasingNode(child, options, { ...style, strike: true })
      )
    }
    case 'inlineCode': {
      return [
        new TextRun({
          text: n.value ?? '',
          font: 'Courier New',
          shading: {
            type: ShadingType.CLEAR,
            fill: 'F0F0F0',
          },
          bold: style.bold,
          italics: style.italics,
          strike: style.strike,
        }),
      ]
    }
    case 'link': {
      const linkUrl = n.url ?? ''
      const childRuns = (n.children ?? []).flatMap((child: PhrasingContent) =>
        convertPhrasingNode(child, options, {
          style: 'Hyperlink',
          ...style,
        })
      )
      if (childRuns.length === 0) {
        childRuns.push(
          new TextRun({
            text: linkUrl,
            style: 'Hyperlink',
            ...style,
          })
        )
      }
      return [
        new ExternalHyperlink({
          children: childRuns,
          link: linkUrl,
        }),
      ]
    }
    case 'image': {
      const imgUrl = n.url ?? ''
      const imgAlt = n.alt || imgUrl
      if (options.imageMap && options.imageMap[imgUrl]) {
        const imgData = options.imageMap[imgUrl]
        return [
          new ImageRun({
            type: getImageType(imgUrl),
            data: new Uint8Array(imgData.buffer),
            transformation: {
              width: imgData.width,
              height: imgData.height,
            },
          }),
        ]
      }
      return [
        new TextRun({
          text: `[Image: ${imgAlt}]`,
          italics: true,
          ...style,
        }),
      ]
    }
    case 'break': {
      return [new TextRun({ break: 1 })]
    }
    case 'html': {
      return [
        new TextRun({
          text: n.value ?? '',
          ...style,
        }),
      ]
    }
    default: {
      const text = extractText(n)
      if (!text) return []
      return [
        new TextRun({
          text,
          bold: style.bold,
          italics: style.italics,
          strike: style.strike,
          font: style.font,
          style: style.style,
        }),
      ]
    }
  }
}

function convertCode(node: Code): Paragraph {
  const lines = (node.value ?? '').split('\n')
  const runs: TextRun[] = []
  lines.forEach((line, index) => {
    runs.push(
      new TextRun({
        text: line,
        font: 'Courier New',
        break: index > 0 ? 1 : 0,
      })
    )
  })

  return new Paragraph({
    shading: {
      type: ShadingType.CLEAR,
      fill: 'F5F5F5',
    },
    border: {
      left: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      top: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
    },
    children: runs,
  })
}

function convertTable(node: MdastTable, options: ExportDocxOptions): Table {
  const alignments = node.align ?? []
  const rows: TableRow[] = []
  const rowNodes = node.children ?? []

  for (let rowIndex = 0; rowIndex < rowNodes.length; rowIndex++) {
    const rowNode = rowNodes[rowIndex]
    if (!rowNode) continue
    const cells: TableCell[] = []
    const cellNodes = rowNode.children ?? []

    for (let colIndex = 0; colIndex < cellNodes.length; colIndex++) {
      const cellNode = cellNodes[colIndex]
      if (!cellNode) continue
      const align = alignments[colIndex]
      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
      if (align === 'center') alignment = AlignmentType.CENTER
      else if (align === 'right') alignment = AlignmentType.RIGHT

      const runs = (cellNode.children ?? []).flatMap((c) =>
        convertPhrasingNode(c, options, { bold: rowIndex === 0 })
      )

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              alignment,
              children: runs.length > 0 ? runs : [new TextRun('')],
            }),
          ],
        })
      )
    }

    rows.push(
      new TableRow({
        tableHeader: rowIndex === 0,
        children: cells,
      })
    )
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
  })
}

function convertThematicBreak(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: 'CCCCCC',
      },
    },
    children: [],
  })
}

function convertList(
  listNode: List,
  options: ExportDocxOptions,
  level: number,
  numberingRef: string | undefined,
  createNumberingRef: () => string
): Paragraph[] {
  const isOrdered = Boolean(listNode.ordered)
  const currentRef = isOrdered ? (numberingRef || createNumberingRef()) : undefined
  const paragraphs: Paragraph[] = []

  for (const item of listNode.children ?? []) {
    let isFirstBlockInItem = true
    const isTask = typeof item.checked === 'boolean'
    const taskPrefix = isTask ? (item.checked ? '[x] ' : '[ ] ') : ''

    for (const child of item.children ?? []) {
      if (child.type === 'paragraph') {
        const runs = (child.children ?? []).flatMap((pChild) =>
          convertPhrasingNode(pChild, options)
        )
        if (isFirstBlockInItem && taskPrefix) {
          runs.unshift(new TextRun(taskPrefix))
        }

        if (isFirstBlockInItem) {
          paragraphs.push(
            new Paragraph({
              ...(isOrdered && currentRef
                ? { numbering: { reference: currentRef, level } }
                : { bullet: { level } }),
              children: runs,
            })
          )
          isFirstBlockInItem = false
        } else {
          paragraphs.push(
            new Paragraph({
              indent: { left: (level + 1) * 720 },
              children: runs,
            })
          )
        }
      } else if (child.type === 'list') {
        paragraphs.push(
          ...convertList(child as List, options, level + 1, currentRef, createNumberingRef)
        )
      } else {
        const blocks = convertBlockNode(child, options, createNumberingRef, currentRef)
        for (const b of blocks) {
          if (b instanceof Paragraph) {
            paragraphs.push(b)
          }
        }
      }
    }
  }

  return paragraphs
}

function convertBlockquote(
  node: Blockquote,
  options: ExportDocxOptions,
  createNumberingRef: () => string,
  numberingRef?: string
): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = []
  for (const child of node.children ?? []) {
    if (child.type === 'paragraph') {
      const runs = (child.children ?? []).flatMap((pChild) =>
        convertPhrasingNode(pChild, options, { italics: true })
      )
      children.push(
        new Paragraph({
          indent: { left: 720 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 24,
              color: 'CCCCCC',
            },
          },
          children: runs,
        })
      )
    } else {
      children.push(...convertBlockNode(child, options, createNumberingRef, numberingRef))
    }
  }
  return children
}

function convertBlockNode(
  node: RootContent | unknown,
  options: ExportDocxOptions,
  createNumberingRef: () => string,
  numberingRef?: string
): (Paragraph | Table)[] {
  const n = node as Record<string, any>
  if (!n || typeof n.type !== 'string') return []

  switch (n.type) {
    case 'heading': {
      const headingLevel = HEADING_LEVEL_MAP[n.depth] ?? HeadingLevel.HEADING_1
      const runs = (n.children ?? []).flatMap((c: PhrasingContent) =>
        convertPhrasingNode(c, options)
      )
      return [
        new Paragraph({
          heading: headingLevel,
          children: runs,
        }),
      ]
    }
    case 'paragraph': {
      const runs = (n.children ?? []).flatMap((c: PhrasingContent) =>
        convertPhrasingNode(c, options)
      )
      return [
        new Paragraph({
          children: runs,
        }),
      ]
    }
    case 'list': {
      return convertList(n as List, options, 0, numberingRef, createNumberingRef)
    }
    case 'blockquote': {
      return convertBlockquote(n as Blockquote, options, createNumberingRef, numberingRef)
    }
    case 'code': {
      return [convertCode(n as Code)]
    }
    case 'table': {
      return [convertTable(n as MdastTable, options)]
    }
    case 'thematicBreak': {
      return [convertThematicBreak()]
    }
    case 'image': {
      const runs = convertPhrasingNode(n, options)
      return [
        new Paragraph({
          children: runs,
        }),
      ]
    }
    default: {
      const text = extractText(n)
      if (!text.trim()) return []
      return [
        new Paragraph({
          children: [new TextRun(text)],
        }),
      ]
    }
  }
}

export async function mdastToDocx(options: ExportDocxOptions): Promise<Blob> {
  const { mdast, title } = options
  const children: (Paragraph | Table)[] = []
  const numberingConfigs: NumberingConfigItem[] = []
  let listCounter = 0

  function createNumberingRef(): string {
    listCounter++
    const ref = `ordered-list-${listCounter}`
    numberingConfigs.push({
      reference: ref,
      levels: [0, 1, 2, 3, 4, 5].map((lvl) => ({
        level: lvl,
        format: LevelFormat.DECIMAL,
        text: `%${lvl + 1}.`,
        alignment: AlignmentType.START,
      })),
    })
    return ref
  }

  for (const child of mdast?.children ?? []) {
    children.push(...convertBlockNode(child, options, createNumberingRef))
  }

  const doc = new Document({
    ...(title ? { title } : {}),
    ...(numberingConfigs.length > 0
      ? { numbering: { config: numberingConfigs } }
      : {}),
    sections: [
      {
        children,
      },
    ],
  })

  return await Packer.toBlob(doc)
}
