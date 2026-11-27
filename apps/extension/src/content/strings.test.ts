import { describe, expect, it } from 'vitest'
import { CONTENT_STRINGS, resolveContentLocale, type ContentLocale } from './strings'

describe('content strings', () => {
  it('5 locale đủ 8 khoá không rỗng', () => {
    const locales: ContentLocale[] = ['vi', 'en', 'it', 'fr', 'de']
    for (const l of locales) {
      const S = CONTENT_STRINGS[l]
      expect(Object.keys(S)).toHaveLength(8)
      for (const v of Object.values(S)) expect(v.length).toBeGreaterThan(0)
    }
  })
  it('resolve', () => {
    expect(resolveContentLocale(undefined, ['fr-CA', 'vi'])).toBe('fr')
    expect(resolveContentLocale('auto', ['es', 'de'])).toBe('de')
    expect(resolveContentLocale(undefined, ['ja'])).toBe('en')
    expect(resolveContentLocale(undefined, [])).toBe('en')
    expect(resolveContentLocale(undefined, undefined)).toBe('en')
    expect(resolveContentLocale('es', ['it'])).toBe('it')
    expect(resolveContentLocale('de', ['vi'])).toBe('de')
    expect(resolveContentLocale('vi', ['de'])).toBe('vi')
    expect(resolveContentLocale(undefined, ['IT_it'.replace('_', '-')])).toBe('it')
  })
})
