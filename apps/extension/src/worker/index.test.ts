import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Service Worker', () => {
  let actionListener: ((tab?: any) => Promise<void> | void) | null = null
  let updatedListener: ((tabId: number, changeInfo: any, tab: any) => Promise<void>) | null = null
  let startupListener: (() => Promise<void>) | null = null
  let installedListener: (() => Promise<void>) | null = null
  let removeMock = vi.fn()
  let tabsUpdateMock = vi.fn()
  let tabsCreateMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    actionListener = null
    updatedListener = null
    startupListener = null
    installedListener = null
    removeMock = vi.fn().mockResolvedValue(undefined)
    tabsUpdateMock = vi.fn().mockResolvedValue(undefined)
    tabsCreateMock = vi.fn().mockResolvedValue(undefined)

    let messageListener: ((message: any, sender: any, sendResponse: any) => boolean | void) | null = null

    globalThis.chrome = {
      runtime: {
        getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
        onStartup: { addListener: vi.fn((cb) => { startupListener = cb }) },
        onInstalled: { addListener: vi.fn((cb) => { installedListener = cb }) },
        onMessage: {
          addListener: vi.fn((cb) => {
            messageListener = cb
          }),
        },
      },
      action: {
        onClicked: {
          addListener: vi.fn((cb) => {
            actionListener = cb
          }),
        },
      },
      tabs: {
        create: tabsCreateMock,
        update: tabsUpdateMock,
        onUpdated: {
          addListener: vi.fn((cb) => {
            updatedListener = cb
          }),
        },
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
        },
        local: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({
            file_content_legacy: '# x',
            file_content_old: { text: 'x', ts: 0 },
            file_content_fresh: { text: 'x', ts: Date.now() },
            other_key: '# keep',
          }),
          remove: removeMock,
        },
      },
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).chrome
  })

  it('opens app.html when extension icon is clicked without active file tab', async () => {
    await import('./index')
    expect(actionListener).not.toBeNull()

    await actionListener!({} as any)
    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/app.html',
    })
  })

  it('updates tab when extension icon is clicked on a .md file tab', async () => {
    await import('./index')
    await actionListener!({ id: 10, url: 'file:///path/to/notes.md' } as any)
    expect(tabsUpdateMock).toHaveBeenCalledWith(10, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///path/to/notes.md'),
    })
  })

  it('handles openApp message with replace=true', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const messageListener = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    messageListener(
      { action: 'openApp', fileUrl: 'file:///test.md', content: '# Hello', replace: true },
      { tab: { id: 5 } },
      sendResponse
    )
    for (let i = 0; i < 5; i++) await Promise.resolve()

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      'file_content_file:///test.md': { text: '# Hello', ts: expect.any(Number) },
    })
    expect(tabsUpdateMock).toHaveBeenCalledWith(5, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///test.md'),
    })
  })

  it('handles openApp message with replace=false', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const messageListener = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    messageListener(
      { action: 'openApp', fileUrl: 'file:///test.md', content: '# Hello', replace: false },
      {},
      sendResponse
    )
    for (let i = 0; i < 5; i++) await Promise.resolve()

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent('file:///test.md'),
    })
  })

  it('action click on non-markdown tab opens blank app', async () => {
    await import('./index')
    await actionListener!({ id: 3, url: 'https://example.com/page.html' } as any)
    expect(tabsUpdateMock).not.toHaveBeenCalled()
    expect(tabsCreateMock).toHaveBeenCalledWith({ url: 'chrome-extension://test-id/app.html' })
  })

  it('action click on a github blob md page opens the app', async () => {
    await import('./index')
    const u = 'https://github.com/o/r/blob/main/a.md'
    await actionListener!({ id: 4, url: u } as any)
    expect(tabsUpdateMock).toHaveBeenCalledWith(4, {
      url: 'chrome-extension://test-id/app.html?file=' + encodeURIComponent(u),
    })
  })

  it('registers no tabs.onUpdated listener', async () => {
    await import('./index')
    expect(updatedListener).toBeNull()
  })

  it('purges only stale/legacy file_content_* keys on startup and install', async () => {
    await import('./index')
    expect(startupListener).not.toBeNull()
    expect(installedListener).not.toBeNull()
    await startupListener!()
    expect(removeMock).toHaveBeenCalledWith(['file_content_legacy', 'file_content_old'])
    removeMock.mockClear()
    await installedListener!()
    expect(removeMock).toHaveBeenCalledWith(['file_content_legacy', 'file_content_old'])
  })
  it('renderMd responds synchronously with html', async () => {
    await import('./index')
    const sendResponse = vi.fn()
    const l = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    const ret = l({ action: 'renderMd', markdown: '# Hi' }, {}, sendResponse)
    expect(ret).not.toBe(true)
    const arg = sendResponse.mock.calls[0]![0]
    expect(arg.ok).toBe(true)
    expect(arg.html).toContain('<h1')
    expect(arg.title).toBe('Hi')
  })

  it('renderMd rejects non-string and too-large input', async () => {
    await import('./index')
    const l = (chrome.runtime.onMessage.addListener as any).mock.calls[0][0]
    const r1 = vi.fn()
    l({ action: 'renderMd', markdown: 42 }, {}, r1)
    expect(r1).toHaveBeenCalledWith({ ok: false, error: 'bad-request' })
    const r2 = vi.fn()
    l({ action: 'renderMd', markdown: 'a'.repeat(2_000_001) }, {}, r2)
    expect(r2).toHaveBeenCalledWith({ ok: false, error: 'too-large' })
  })
})

describe('Service Worker revokedUntil expiry (15g)', () => {
  const approved = [{ keyHash: 'k1', client: 'c', at: 1, serverKey: 's' }]
  let changed: ((c: any, area: string) => void) | null = null
  let reqPairing: ((a: { port: number; client: string; keyHash: string; pinned: string }) => unknown) | null = null
  let tabsCreate: ReturnType<typeof vi.fn>
  let expiryMap: Map<string, number> | null = null

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    changed = null
    reqPairing = null
    expiryMap = null
    tabsCreate = vi.fn().mockResolvedValue(undefined)
    vi.doMock('./bridge', async (orig) => {
      const actual = await orig<typeof import('./bridge')>()
      return {
        ...actual,
        createBridge: (deps: any) => {
          reqPairing = deps.onUnpaired
          return actual.createBridge(deps)
        },
      }
    })
    vi.doMock('../shared/md-url', async (orig) => {
      const actual = await orig<typeof import('../shared/md-url')>()
      return {
        ...actual,
        isExpiryActive: (m: Map<string, number>, k: string, n?: number) => { expiryMap = m; return actual.isExpiryActive(m, k, n) },
        setExpiry: (m: Map<string, number>, k: string, u: number, n?: number) => { expiryMap = m; return actual.setExpiry(m, k, u, n) },
      }
    })
    globalThis.chrome = {
      runtime: {
        id: 'x', getURL: (p: string) => `chrome-extension://x/${p}`,
        onStartup: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() },
      },
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { create: tabsCreate, update: vi.fn(), onUpdated: { addListener: vi.fn() } },
      storage: {
        sync: { get: vi.fn().mockResolvedValue({}) },
        local: { set: vi.fn(), get: vi.fn().mockResolvedValue({}), remove: vi.fn() },
        onChanged: { addListener: vi.fn((cb) => { changed = cb }) },
      },
    } as any
    await import('./index')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('./bridge')
    vi.doUnmock('../shared/md-url')
    delete (globalThis as any).chrome
  })

  const revoke = () => changed!({ 'mdr.bridge': { oldValue: { enabled: true, approved }, newValue: { enabled: true, approved: [] } } }, 'local')
  const pair = () => reqPairing!({ port: 47821, client: 'c', keyHash: 'k1', pinned: 'unknown' })

  it('ignores pairing from a revoked keyHash for 60s, accepts after, and drops the expired entry', async () => {
    revoke()
    await pair()
    expect(tabsCreate).not.toHaveBeenCalled()
    vi.setSystemTime(1_000_000 + 59_000)
    await pair()
    expect(tabsCreate).not.toHaveBeenCalled()
    vi.setSystemTime(1_000_000 + 61_000)
    await pair()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(expiryMap!.has('k1')).toBe(false)
  })

  it('sweeps other expired entries when a new revocation is recorded', () => {
    revoke()
    vi.setSystemTime(1_000_000 + 61_000)
    changed!({ 'mdr.bridge': {
      oldValue: { enabled: true, approved: [{ keyHash: 'k2', client: 'c', at: 1, serverKey: 's' }] },
      newValue: { enabled: true, approved: [] },
    } }, 'local')
    expect([...expiryMap!.keys()]).toEqual(['k2'])
  })
})

describe('Service Worker lifecycle (18a.2)', () => {
  let installed: ((d?: any) => Promise<void>) | null = null
  let startup: (() => Promise<void>) | null = null
  let store: Record<string, any>
  let tabsCreate: ReturnType<typeof vi.fn>
  let setUninstallURL: ReturnType<typeof vi.fn>
  let removeMock: ReturnType<typeof vi.fn>
  let getCalls: number

  beforeEach(async () => {
    vi.resetModules()
    installed = null
    startup = null
    store = {}
    getCalls = 0
    tabsCreate = vi.fn().mockResolvedValue(undefined)
    setUninstallURL = vi.fn()
    removeMock = vi.fn().mockResolvedValue(undefined)
    globalThis.chrome = {
      runtime: {
        id: 'x',
        getURL: (p: string) => `chrome-extension://x/${p}`,
        getManifest: () => ({ version: '9.8.7' }),
        setUninstallURL,
        onStartup: { addListener: vi.fn((cb) => { startup = cb }) },
        onInstalled: { addListener: vi.fn((cb) => { installed = cb }) },
        onMessage: { addListener: vi.fn() },
      },
      i18n: { getUILanguage: () => 'vi' },
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { create: tabsCreate, update: vi.fn() },
      storage: {
        sync: { get: vi.fn().mockResolvedValue({}) },
        local: {
          get: vi.fn(async (k: any) => {
            getCalls++
            await Promise.resolve()
            if (k === null) return { file_content_old: { text: 'x', ts: 0 } }
            return typeof k === 'string' ? (k in store ? { [k]: store[k] } : {}) : { ...store }
          }),
          set: vi.fn(async (o: any) => { await Promise.resolve(); Object.assign(store, o) }),
          remove: removeMock,
        },
      },
    } as any
    await import('./index')
  })

  afterEach(() => {
    delete (globalThis as any).chrome
  })

  it('install opens welcome tab once, storing pendingWelcome false before tabs.create', async () => {
    const order: string[] = []
    ;(chrome.storage.local.set as any).mockImplementation(async (o: any) => {
      order.push('set:' + String((Object.values(o)[0] as any)?.pendingWelcome))
      Object.assign(store, o)
    })
    tabsCreate.mockImplementation(async () => { order.push('create') })
    await installed!({ reason: 'install' })
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(tabsCreate.mock.calls[0]![0].url.endsWith('app.html?welcome=1')).toBe(true)
    const key = Object.keys(store).find((k) => store[k]?.pendingWelcome !== undefined)!
    expect(store[key].pendingWelcome).toBe(false)
    expect(order.indexOf('set:false')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('set:false')).toBeLessThan(order.indexOf('create'))
  })

  it('update does not open a tab; startup afterwards opens only whatsnew, never welcome', async () => {
    await installed!({ reason: 'update', previousVersion: '1.0.0' })
    expect(tabsCreate).not.toHaveBeenCalled()
    await startup!()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(tabsCreate.mock.calls[0]![0].url).toContain('whatsnew=1')
    expect(tabsCreate.mock.calls[0]![0].url).not.toContain('welcome=1')
  })

  it('tabs.create throwing does not block tick', async () => {
    tabsCreate.mockRejectedValue(new Error('boom'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(installed!({ reason: 'install' })).resolves.toBeUndefined()
    expect(removeMock).toHaveBeenCalledWith(['file_content_old'])
    warn.mockRestore()
  })

  it('sets uninstall URL with manifest version on install and startup', async () => {
    await installed!({ reason: 'install' })
    expect(setUninstallURL).toHaveBeenLastCalledWith(expect.stringContaining('v=9.8.7'))
    setUninstallURL.mockClear()
    await startup!()
    expect(setUninstallURL).toHaveBeenLastCalledWith(expect.stringContaining('v=9.8.7'))
  })

  it('setUninstallURL throwing does not block cache purge', async () => {
    setUninstallURL.mockImplementation(() => { throw new Error('boom') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await installed!({ reason: 'install' })
    expect(removeMock).toHaveBeenCalledWith(['file_content_old'])
    warn.mockRestore()
  })

  it('onInstalled without reason leaves stored state unchanged and does not throw', async () => {
    await installed!({ reason: 'install' })
    const before = JSON.stringify(store)
    await expect(installed!({})).resolves.toBeUndefined()
    expect(JSON.stringify(store)).toBe(before)
  })

  it('back-to-back installed then startup run sequentially', async () => {
    const p1 = installed!({ reason: 'install' })
    const p2 = startup!()
    await Promise.all([p1, p2])
    const sets = (chrome.storage.local.set as any).mock.calls.map((c: any[]) => c[0])
    expect(sets.length).toBe(2)
    const key = Object.keys(sets[0])[0]!
    // second write was computed from the first's state: pendingWelcome stays consumed after startup
    expect(sets[1][key].pendingWelcome).toBe(false)
  })

  describe('whatsnew on startup (18c1.4)', () => {
    const keyOf = async () => {
      const mod = await import('./lifecycle')
      return mod.LIFECYCLE_KEY
    }
    const seedState = async (over: Record<string, unknown>) => {
      const key = await keyOf()
      store[key] = { lastSeenVersion: '1.4.0', pendingWhatsNew: '1.5.0', pendingWelcome: false, autoOpenWhatsNew: true, ...over }
      return key
    }

    it('opens once with pending cleared before tabs.create', async () => {
      const key = await seedState({})
      const order: string[] = []
      ;(chrome.storage.local.set as any).mockImplementation(async (o: any) => {
        order.push('set:' + String(o[key]?.pendingWhatsNew))
        Object.assign(store, o)
      })
      tabsCreate.mockImplementation(async () => { order.push('create') })
      await startup!()
      expect(tabsCreate).toHaveBeenCalledTimes(1)
      expect(tabsCreate.mock.calls[0]![0].url.endsWith('app.html?whatsnew=1&v=1.5.0')).toBe(true)
      expect(order.indexOf('set:null')).toBeGreaterThanOrEqual(0)
      expect(order.indexOf('set:null')).toBeLessThan(order.indexOf('create'))
      await startup!()
      expect(tabsCreate).toHaveBeenCalledTimes(1)
    })

    it('does not open when autoOpenWhatsNew is false', async () => {
      await seedState({ autoOpenWhatsNew: false })
      await startup!()
      expect(tabsCreate).not.toHaveBeenCalled()
    })

    it('tabs.create throwing does not block tick/cache purge', async () => {
      await seedState({})
      tabsCreate.mockRejectedValue(new Error('boom'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await expect(startup!()).resolves.toBeUndefined()
      expect(removeMock).toHaveBeenCalledWith(['file_content_old'])
      warn.mockRestore()
    })
  })
})

describe('Service Worker pairing policy (21c4.1)', () => {
  const K = 'a'.repeat(64)
  const SENDER = { id: 'x', url: 'chrome-extension://x/app.html?pair=47821', tab: { id: 7 } }
  let unpaired: ((a: any) => Promise<boolean>) | null
  let listener: ((m: any, s: any, r: any) => unknown) | null
  let local: Record<string, any>
  let session: Record<string, any>
  let tabsCreate: ReturnType<typeof vi.fn>
  let tabsRemove: ReturnType<typeof vi.fn>
  let decideOutcome: string
  let connList: any[]

  const mkStore = (o: Record<string, any>) => ({
    get: vi.fn(async (k: any) => (typeof k === 'string' ? (k in o ? { [k]: o[k] } : {}) : { ...o })),
    set: vi.fn(async (v: any) => { Object.assign(o, v) }),
    remove: vi.fn(async (k: any) => { for (const x of [].concat(k)) delete o[x as string] }),
  })
  const un = (pinned = 'unknown') => unpaired!({ port: 47821, client: 'c', keyHash: K, pinned })
  const send = (m: any, sender: any = SENDER) => new Promise<any>((res) => { listener!(m, sender, res) })

  beforeEach(async () => {
    vi.resetModules()
    unpaired = null; listener = null
    local = {}; session = {}
    tabsCreate = vi.fn().mockResolvedValue(undefined)
    tabsRemove = vi.fn().mockResolvedValue(undefined)
    decideOutcome = 'paired'
    connList = []
    vi.doMock('./bridge', async (orig) => {
      const actual = await orig<typeof import('./bridge')>()
      return {
        ...actual,
        createBridge: (deps: any) => {
          unpaired = deps.onUnpaired
          const b = actual.createBridge(deps)
          return {
            ...b,
            scan: async () => 0,
            conns: () => connList,
            decide: async (_p: number, _a: boolean, add: any) => {
              if (decideOutcome === 'paired') await add?.({ keyHash: K, client: 'c', at: 1, serverKey: 's' })
              return decideOutcome
            },
          }
        },
      }
    })
    globalThis.chrome = {
      runtime: {
        id: 'x', getURL: (p: string) => `chrome-extension://x/${p}`,
        onStartup: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn((cb) => { listener = cb }) },
      },
      action: { onClicked: { addListener: vi.fn() } },
      tabs: { create: tabsCreate, update: vi.fn(), remove: tabsRemove },
      storage: {
        sync: { get: vi.fn().mockResolvedValue({}) },
        local: mkStore(local),
        session: mkStore(session),
        onChanged: { addListener: vi.fn() },
      },
    } as any
    await import('./index')
  })

  afterEach(() => {
    vi.doUnmock('./bridge')
    delete (globalThis as any).chrome
  })

  it('asks once: first hello records asked then opens exactly one tab', async () => {
    expect(await un()).toBe(true)
    expect(local['mdr.bridgeAsked'][K]).toBeDefined()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
  })

  it('second hello of the same key stays silent but is listed as seen', async () => {
    await un()
    expect(await un()).toBe(false)
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(session['mdr.bridgeSeen'].some((x: any) => x.keyHash === K)).toBe(true)
  })

  it('pinned other never opens a tab and is recorded as seen', async () => {
    expect(await un('other')).toBe(false)
    expect(tabsCreate).not.toHaveBeenCalled()
    expect(session['mdr.bridgeSeen'][0].pinned).toBe('other')
  })

  it('manual connect re-enables asking once; other still silent', async () => {
    await un()
    connList = [{ port: 47821, client: 'c', keyHash: K, state: 'pending', pinned: 'unknown' }]
    const r = await send({ type: 'mdr-bridge-connect', keyHash: K })
    expect(r).toEqual({ ok: true })
    expect(await un()).toBe(true)
    expect(tabsCreate).toHaveBeenCalledTimes(2)
    await send({ type: 'mdr-bridge-connect', keyHash: K })
    expect(await un('other')).toBe(false)
    expect(tabsCreate).toHaveBeenCalledTimes(2)
  })

  it('connect from a non-app page is ignored; bad keyHash and no conn answer ok:false', async () => {
    const ret = listener!({ type: 'mdr-bridge-connect', keyHash: K }, { id: 'x', url: 'https://evil.test/' }, vi.fn())
    expect(ret).toBeUndefined()
    expect(await send({ type: 'mdr-bridge-connect', keyHash: 'zz' })).toEqual({ ok: false })
    expect(await send({ type: 'mdr-bridge-connect', keyHash: K })).toEqual({ ok: false })
  })

  const decision = () => send({ type: 'mdr-bridge-pair-decision', port: 47821, allow: true, keyHash: K })

  it('rejected: approval removed, asked.rejected, tab kept open, reply carries outcome+pinned', async () => {
    local['mdr.bridge'] = { enabled: true, approved: [{ keyHash: K, client: 'c', at: 1, serverKey: 's' }] }
    session['mdr.bridgeSeen'] = [{ keyHash: K, client: 'c', port: 47821, pinned: 'unknown', rejected: false, at: Date.now() }]
    connList = [{ port: 47821, client: 'c', keyHash: K, state: 'pending', pinned: 'other' }]
    decideOutcome = 'rejected'
    const r = await decision()
    expect(r).toEqual({ ok: true, outcome: 'rejected', pinned: 'other' })
    expect(local['mdr.bridge'].approved).toEqual([])
    expect(local['mdr.bridgeAsked'][K].rejected).toBe(true)
    expect(tabsRemove).not.toHaveBeenCalled()
    expect(session['mdr.bridgeSeen'][0].rejected).toBe(true)
  })

  it('paired closes the tab and drops seen; gone drops seen but keeps the tab', async () => {
    session['mdr.bridgeSeen'] = [{ keyHash: K, client: 'c', port: 47821, pinned: 'unknown', rejected: false, at: Date.now() }]
    const r = await decision()
    expect(r.outcome).toBe('paired')
    expect(tabsRemove).toHaveBeenCalledWith(7)
    expect(session['mdr.bridgeSeen']).toEqual([])
    tabsRemove.mockClear()
    session['mdr.bridgeSeen'] = [{ keyHash: K, client: 'c', port: 47821, pinned: 'unknown', rejected: false, at: Date.now() }]
    decideOutcome = 'gone'
    const g = await decision()
    expect(g.outcome).toBe('gone')
    expect(tabsRemove).not.toHaveBeenCalled()
    expect(session['mdr.bridgeSeen']).toEqual([])
  })
})
