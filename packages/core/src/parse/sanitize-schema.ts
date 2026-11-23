import { defaultSchema } from 'rehype-sanitize'

export const LANG_CLASS = /^language-[A-Za-z0-9_+#.-]{1,40}$/

const svgAttributes = [
  'viewBox', 'd', 'fill', 'fillRule', 'stroke', 'strokeWidth',
  'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'strokeDashoffset',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform',
  'xmlns', 'xmlnsXlink', 'textAnchor', 'dominantBaseline',
  'fontSize', 'fontFamily', 'fontWeight', 'dx', 'dy',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'
]

const codeAttributes = (defaultSchema.attributes?.code ?? []).filter(
  (attr) => !(Array.isArray(attr) && attr[0] === 'className')
)

const spanAttributes = (defaultSchema.attributes?.span ?? []).filter(
  (attr) => !(Array.isArray(attr) && attr[0] === 'className')
)

const SP: [string, RegExp] = ['dataSp', /^\d+:\d+$/]
const withSp = (tag: string) => [...((defaultSchema.attributes as any)?.[tag] ?? []), SP]

export const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  clobberPrefix: 'user-content-',
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'defs',
    'marker',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...codeAttributes,
      ['className', /^hljs-/, LANG_CLASS],
    ],
    span: [
      ...spanAttributes,
      ['className', /^hljs-/, LANG_CLASS],
    ],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id', SP],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id', SP],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id', SP],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id', SP],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id', SP],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id', SP],
    p: withSp('p'),
    li: withSp('li'),
    blockquote: withSp('blockquote'),
    pre: withSp('pre'),
    table: withSp('table'),
    tr: withSp('tr'),
    hr: withSp('hr'),
    div: withSp('div'),
    svg: svgAttributes,
    g: svgAttributes,
    path: svgAttributes,
    rect: svgAttributes,
    circle: svgAttributes,
    ellipse: svgAttributes,
    line: svgAttributes,
    polyline: svgAttributes,
    polygon: svgAttributes,
    text: svgAttributes,
    tspan: svgAttributes,
    defs: svgAttributes,
    marker: svgAttributes,
  },
}
