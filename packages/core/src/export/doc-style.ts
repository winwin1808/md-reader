export type DocStyle = 'lesach' | 'business' | 'academic' | 'technical'

export const DOC_STYLES: readonly DocStyle[] = ['lesach', 'business', 'academic', 'technical']

export function isDocStyle(v: unknown): v is DocStyle {
  return typeof v === 'string' && (DOC_STYLES as readonly string[]).includes(v)
}
