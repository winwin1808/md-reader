import { Facet } from '@codemirror/state'
import { createT, type TFunction } from '../i18n'

export const defaultTranslate: TFunction = createT('vi')

/** Translator for CM6 code living outside React. Defaults to Vietnamese. */
export const translateFacet = Facet.define<TFunction, TFunction>({
  combine: (v) => v[0] ?? defaultTranslate,
})
