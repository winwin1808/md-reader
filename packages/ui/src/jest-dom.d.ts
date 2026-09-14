import 'vitest'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Assertion<R = any, T = any> extends TestingLibraryMatchers<any, T> {}
}
