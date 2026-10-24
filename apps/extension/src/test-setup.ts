import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
})
