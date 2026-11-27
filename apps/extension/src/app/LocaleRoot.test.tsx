import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import { useLocale, type Locale } from '@md-reader/ui'
import { LocaleRoot } from './LocaleRoot'

// loadLocale is replaced by a test-controlled promise: the real one does a lazy
// dynamic import whose first-time transform can exceed waitFor's 1s under load.
const loads: { locale: Locale; resolve: () => void }[] = []
let autoResolve = true
vi.mock('@md-reader/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@md-reader/ui')>()
  return {
    ...actual,
    loadLocale: (locale: Locale) =>
      new Promise<void>((resolve) => {
        if (autoResolve) resolve()
        else loads.push({ locale, resolve })
      }),
  }
})

function Probe() {
  return <div data-testid="p">{useLocale()}</div>
}

type Listener = (changes: Record<string, { newValue?: unknown }>) => void
let listener: Listener | null = null
let stored: Record<string, unknown> = {}

function setup(local: Record<string, unknown>, langs: string[]) {
  stored = local
  listener = null
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn(async () => stored) },
      sync: { get: vi.fn(async () => ({})) },
      onChanged: {
        addListener: vi.fn((l: Listener) => { listener = l }),
        removeListener: vi.fn(),
      },
    },
  })
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs)
}

async function changeLanguage(lang: string) {
  stored = { uiLanguage: lang }
  await act(async () => { listener?.({ uiLanguage: { newValue: lang } }) })
}

const pendingFor = (l: Locale) => loads.filter((x) => x.locale === l)
const shown = () => screen.queryByTestId('p')?.textContent ?? null

describe('LocaleRoot', () => {
  beforeEach(() => {
    document.documentElement.lang = ''
    loads.length = 0
    autoResolve = true
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.documentElement.lang = ''
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

  it('renders nothing until the catalog is loaded', async () => {
    autoResolve = false
    setup({ uiLanguage: 'fr' }, ['en-US'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(pendingFor('fr').length).toBe(1))
    expect(shown()).toBeNull()
    await act(async () => { pendingFor('fr')[0]!.resolve() })
    expect(shown()).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
  })

  it('keeps the old locale until the new catalog is loaded', async () => {
    setup({ uiLanguage: 'en' }, ['de-DE'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(shown()).toBe('en'))
    autoResolve = false
    await changeLanguage('fr')
    await waitFor(() => expect(pendingFor('fr').length).toBe(1))
    expect(shown()).toBe('en')
    await act(async () => { pendingFor('fr')[0]!.resolve() })
    expect(shown()).toBe('fr')
  })

  it('a stale load cannot overwrite a newer choice', async () => {
    setup({ uiLanguage: 'en' }, ['en-US'])
    render(<LocaleRoot><Probe /></LocaleRoot>)
    await waitFor(() => expect(shown()).toBe('en'))
    autoResolve = false
    await changeLanguage('fr')
    await waitFor(() => expect(pendingFor('fr').length).toBe(1))
    await changeLanguage('de')
    await waitFor(() => expect(pendingFor('de').length).toBe(1))
    await act(async () => { pendingFor('de')[0]!.resolve() })
    expect(shown()).toBe('de')
    await act(async () => { pendingFor('fr')[0]!.resolve() })
    expect(shown()).toBe('de')
  })
})
