import { describe, it, expect } from 'vitest'
import { CORE_VERSION } from './index'

describe('core', () => {
  it('exposes CORE_VERSION', () => {
    expect(CORE_VERSION).toBe('0.1.0')
  })
})
