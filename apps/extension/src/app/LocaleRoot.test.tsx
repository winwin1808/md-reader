import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { useLocale } from '@md-reader/ui'
import { LocaleRoot } from './LocaleRoot'

function Probe() {
  return <div data-testid="p">{useLocale()}</div>
}

function setup(local: Record<string, unknown>, langs: string[]) {
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn(async () => local) },
      sync: { get: vi.fn(async () => ({})) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  })
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs)
}

describe('LocaleRoot', () => {
  beforeEach(() => {
    document.documentElement.lang = ''
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('follows the browser language when storage is empty', async () => {
    setup({}, ['de-DE'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(screen.getByTestId('p').textContent).toBe('de'))
    expect(document.documentElement.lang).toBe('de')
  })

  it('uses a stored language', async () => {
    setup({ uiLanguage: 'fr' }, ['de-DE'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(screen.getByTestId('p').textContent).toBe('fr'))
  })

  it('ignores an unknown stored language', async () => {
    setup({ uiLanguage: 'es' }, ['it-IT'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(screen.getByTestId('p').textContent).toBe('it'))
  })
})
