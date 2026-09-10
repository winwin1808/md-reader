import { describe, it, expect } from 'vitest'
import { EXTENSION_VERSION } from './version'

describe('EXTENSION_VERSION', () => {
  it('is 0.1.0', () => {
    expect(EXTENSION_VERSION).toBe('0.1.0')
  })
})
