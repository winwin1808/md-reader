import { defaultSchema } from 'rehype-sanitize'

const svgAttributes = [
  'viewBox', 'd', 'fill', 'fillRule', 'stroke', 'strokeWidth',
  'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'strokeDashoffset',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform',
  'xmlns', 'xmlnsXlink', 'textAnchor', 'dominantBaseline',
  'fontSize', 'fontFamily', 'fontWeight', 'dx', 'dy',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'
]

export const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  clobberPrefix: '',
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
    'foreignObject',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^hljs-/, /^language-/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['className', /^hljs-/, /^language-/],
    ],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
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
    foreignObject: svgAttributes,
  },
}
