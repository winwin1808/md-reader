import { MAX_RENDER_CHARS, renderMarkdownForPage } from './render-md'
import { createBridge } from './bridge'
import { createExecuteInApp } from './bridge-route'
import { createRecord, writeDocText, deleteRecord, listRecent, getRecord, docQuery, ensureShortKey, docParam } from '../app/doc-registry'
import {
  BRIDGE_CONNECT_MSG, BRIDGE_SCAN_MSG, BRIDGE_SEEN_KEY, BRIDGE_STORAGE_KEY, PAIR_DECISION_MSG, addApproved, loadOrCreateExtKey, markAsked, nextScanDelayMin,
  pairPolicy, parseBridgeSettings, parseConnectMsg, parsePairDecision, pruneSeen, readAsked, readBridgeSettings, readSeen, removeApproved, removeSeen, upsertSeen,
} from './bridge-storage'
import type { PairDecisionReply, StoreLike } from './bridge-storage'
import { LIFECYCLE_KEY, parseLifecycleState, decideLifecycle, uninstallUrl } from './lifecycle'
import type { LifecycleEvent } from './lifecycle'
import { RELEASE_NOTES } from '../shared/release-notes'
import { isMarkdownUrl, isGithubBlobMarkdownUrl, isStaleCacheEntry, makeCacheEntry, isExpiryActive, setExpiry } from '../shared/md-url'

chrome.action.onClicked.addListener(async (tab) => {
  const tabUrl = tab?.url || ''
  if ((isMarkdownUrl(tabUrl) || isGithubBlobMarkdownUrl(tabUrl)) && tab?.id) {
    const appUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(tabUrl))
    await chrome.tabs.update(tab.id, { url: appUrl })
    return
  }
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
})

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (message?.action === 'renderMd') {
    const md = message.markdown
    if (typeof md !== 'string') {
      sendResponse({ ok: false, error: 'bad-request' })
    } else if (md.length > MAX_RENDER_CHARS) {
      sendResponse({ ok: false, error: 'too-large' })
    } else {
      try {
        const { html, title } = renderMarkdownForPage(md, { alertLang: message.alertLang === 'vi' ? 'vi' : 'en' })
        sendResponse({ ok: true, html, title })
      } catch {
        sendResponse({ ok: false, error: 'render-failed' })
      }
    }
    return
  }
  if (message && message.action === 'openApp') {
    const tabId = sender.tab?.id
    const fileUrl = message.fileUrl || ''
    const targetUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(fileUrl))

    const handleOpen = async () => {
      if (message.content && fileUrl) {
        try {
          await chrome.storage?.local?.set?.({
            ['file_content_' + fileUrl]: makeCacheEntry(message.content),
          })
        } catch (err) {
          console.warn('Failed to cache file content in worker:', err)
        }
      }

      if (tabId && message.replace) {
        try {
          await chrome.tabs.update(tabId, { url: targetUrl })
          sendResponse?.({ success: true })
        } catch (err) {
          console.warn('Failed to update tab in worker:', err)
          await chrome.tabs.create({ url: targetUrl })
          sendResponse?.({ success: true, created: true })
        }
      } else {
        try {
          await chrome.tabs.create({ url: targetUrl })
          sendResponse?.({ success: true })
        } catch (err) {
          console.warn('Failed to create tab in worker:', err)
          sendResponse?.({ success: false, error: String(err) })
        }
      }
    }

    handleOpen()
    return true
  }
})

async function purgeStaleCache(): Promise<void> {
  try {
    const all = (await chrome.storage?.local?.get?.(null)) || {}
    const now = Date.now()
    const stale = Object.keys(all).filter(
      (k) => k.startsWith('file_content_') && isStaleCacheEntry(all[k], now),
    )
    if (stale.length) await chrome.storage.local.remove(stale)
  } catch (err) {
    console.warn('Failed to purge stale cache:', err)
  }
}

const ALARM = 'mdr-bridge'
const IDLE_KEY = 'mdr.bridgeIdle'

const revokedUntil = new Map<string, number>()
// keys whose approval we remove ourselves after a server rejection: not a user revoke
const selfRemoved = new Map<string, number>()
// keys the user asked to connect by hand from Settings
const manual = new Set<string>()
// keys for which onUnpaired opened a pair tab; lets the connect handler avoid a second tab per click
const openedByHello = new Set<string>()

// chrome.storage.session may be absent (tests, old browsers): behave as an empty store
const sessionStore: StoreLike = {
  get: async (k) => (await chrome.storage?.session?.get?.(k)) ?? {},
  set: async (v) => { await chrome.storage?.session?.set?.(v) },
}

const execute = createExecuteInApp({
  createRecord,
  writeDocText,
  listRecent,
  getRecord,
  docUrl: async (docId) => chrome.runtime.getURL('app.html') + (await docQuery(docId)),
  findTab: async (docId) => {
    const rec = await getRecord(docId)
    if (!rec) return null
    const param = docParam(await ensureShortKey(docId))
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('app.html') + '*' })
    for (const t of tabs) {
      if (t.id === undefined || !t.url) continue
      try {
        const q = new URL(t.url).searchParams
        if (q.get('d') === param || q.get('doc') === docId) return t.id
      } catch { /* ignore */ }
    }
    return null
  },
  openTab: async (url, active) => {
    const t = await chrome.tabs.create({ url, active })
    return t.id as number
  },
  closeTab: (id) => chrome.tabs.remove(id),
  deleteRecord,
  sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  sendToTab: (tabId, msg) => chrome.tabs.sendMessage(tabId, msg),
  focusTab: async (id) => {
    const t = await chrome.tabs.update(id, { active: true })
    if (t?.windowId !== undefined) await chrome.windows.update(t.windowId, { focused: true })
  },
})

let extKeyP: ReturnType<typeof loadOrCreateExtKey> | null = null

const bridge = createBridge({
  extKey: () => (extKeyP ??= loadOrCreateExtKey(chrome.storage.local)),
  connect: (url) => new WebSocket(url) as unknown as import('./bridge').WsLike,
  approved: async () => (await readBridgeSettings(chrome.storage.local)).approved,
  onUnpaired: async (s) => {
    try {
      const asked = await readAsked(chrome.storage.local)
      const policy = pairPolicy({
        pinned: s.pinned,
        asked: s.keyHash in asked,
        manual: manual.has(s.keyHash),
        recentlyRevoked: isExpiryActive(revokedUntil, s.keyHash),
      })
      try {
        await upsertSeen(sessionStore, {
          keyHash: s.keyHash, client: s.client, port: s.port, pinned: s.pinned,
          rejected: asked[s.keyHash]?.rejected === true, at: Date.now(),
        })
      } catch { /* seen list is best effort */ }
      manual.delete(s.keyHash)
      if (policy === 'silent') return false
      await markAsked(chrome.storage.local, s.keyHash, Date.now())
      await chrome.tabs.create({
        url: chrome.runtime.getURL('app.html?pair=' + s.port + '&client=' + encodeURIComponent(s.client) + '&key=' + s.keyHash),
      })
      openedByHello.add(s.keyHash)
      return true
    } catch {
      return false
    }
  },
  execute,
  // setInterval so the 20 s ping repeats; bridge clears the one-shot connect timer itself when it fires or the socket opens.
  setTimer: (fn, ms) => setInterval(fn, ms),
  clearTimer: (h) => clearInterval(h as ReturnType<typeof setInterval>),
})

async function readIdle(): Promise<number> {
  const r = await chrome.storage.session?.get?.(IDLE_KEY)
  const v = r?.[IDLE_KEY]
  return typeof v === 'number' ? v : 0
}
async function setIdle(n: number): Promise<void> {
  await chrome.storage.session?.set?.({ [IDLE_KEY]: n })
}

async function tick(): Promise<void> {
  try {
    const s = await readBridgeSettings(chrome.storage.local)
    if (!s.enabled) {
      bridge.stopAll()
      await chrome.alarms?.clear?.(ALARM)
      try { await chrome.storage?.session?.remove?.(BRIDGE_SEEN_KEY) } catch { /* ignore */ }
      return
    }
    const n = await bridge.scan()
    try { await pruneSeen(sessionStore, Date.now()) } catch { /* ignore */ }
    const idle = n > 0 ? 0 : (await readIdle()) + 1
    await setIdle(idle)
    await chrome.alarms?.create?.(ALARM, { periodInMinutes: nextScanDelayMin(idle) })
  } catch (err) {
    console.warn('Bridge tick failed:', err)
  }
}

let chain: Promise<unknown> = Promise.resolve()
function enqueue(fn: () => Promise<void>): Promise<void> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

async function runLifecycle(ev: LifecycleEvent): Promise<void> {
  try {
    const version = chrome.runtime.getManifest().version
    const raw = await chrome.storage.local.get(LIFECYCLE_KEY)
    const s = parseLifecycleState(raw?.[LIFECYCLE_KEY])
    const { next, open } = decideLifecycle(ev, s, RELEASE_NOTES, version, Date.now())
    const openWelcome = open.includes('welcome')
    if (openWelcome) next.pendingWelcome = false
    await chrome.storage.local.set({ [LIFECYCLE_KEY]: next })
    if (openWelcome) {
      try {
        await chrome.tabs?.create?.({ url: chrome.runtime.getURL('app.html?welcome=1') })
      } catch (err) {
        console.warn('Opening welcome page failed:', err)
      }
    }
    if (open.includes('whatsnew') && s.pendingWhatsNew !== null) {
      // v = pendingWhatsNew of the pre-decide state (decideLifecycle already moved it on)
      try {
        await chrome.tabs?.create?.({
          url: chrome.runtime.getURL('app.html?whatsnew=1&v=' + encodeURIComponent(s.pendingWhatsNew)),
        })
      } catch (err) {
        console.warn('Opening whatsnew page failed:', err)
      }
    }
    try {
      chrome.runtime.setUninstallURL?.(uninstallUrl(version, chrome.i18n?.getUILanguage?.() ?? 'en'))
    } catch (err) {
      console.warn('setUninstallURL failed:', err)
    }
  } catch (err) {
    console.warn('Lifecycle failed:', err)
  }
}

async function afterLifecycle(): Promise<void> {
  await purgeStaleCache()
  await tick()
}

async function onInstalled(details?: { reason?: string; previousVersion?: string }): Promise<void> {
  await runLifecycle({ type: 'installed', reason: details?.reason ?? '', previousVersion: details?.previousVersion })
  await afterLifecycle()
}

async function onStartup(): Promise<void> {
  await runLifecycle({ type: 'startup' })
  await afterLifecycle()
}

chrome.runtime?.onStartup?.addListener(() => enqueue(() => onStartup()))
chrome.runtime?.onInstalled?.addListener((details) => enqueue(() => onInstalled(details)))

chrome.alarms?.onAlarm?.addListener((a) => {
  if (a.name === ALARM) void tick()
})

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes[BRIDGE_STORAGE_KEY]) return
  const before = parseBridgeSettings(changes[BRIDGE_STORAGE_KEY].oldValue).approved
  const next = parseBridgeSettings(changes[BRIDGE_STORAGE_KEY].newValue)
  const after = new Set(next.approved.map((a) => a.keyHash))
  for (const a of before) {
    if (!after.has(a.keyHash)) {
      bridge.revoke(a.keyHash)
      if (!isExpiryActive(selfRemoved, a.keyHash)) setExpiry(revokedUntil, a.keyHash, Date.now() + 60_000)
    }
  }
  if (parseBridgeSettings(changes[BRIDGE_STORAGE_KEY].oldValue).enabled !== next.enabled) void tick()
})

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  const type = message?.type
  if (type !== PAIR_DECISION_MSG && type !== BRIDGE_SCAN_MSG && type !== BRIDGE_CONNECT_MSG) return
  const appUrl = chrome.runtime.getURL('app.html')
  if (sender?.id !== chrome.runtime.id || !sender?.url || !sender.url.startsWith(appUrl)) return
  void (async () => {
    try {
      if (type === BRIDGE_SCAN_MSG) {
        await setIdle(0)
        await tick()
        sendResponse?.({ ok: true })
      } else if (type === BRIDGE_CONNECT_MSG) {
        const c = parseConnectMsg(message)
        if (!c) { sendResponse?.({ ok: false }); return }
        manual.add(c.keyHash)
        openedByHello.delete(c.keyHash)
        await setIdle(0)
        await tick()
        const live = bridge.conns().find((x) => x.keyHash === c.keyHash)
        if (live) {
          manual.delete(c.keyHash)
          if (live.state === 'pending' && live.pinned !== 'other' && !openedByHello.has(c.keyHash)) {
            await markAsked(chrome.storage.local, c.keyHash, Date.now())
            await chrome.tabs.create({
              url: chrome.runtime.getURL('app.html?pair=' + live.port + '&client=' + encodeURIComponent(live.client) + '&key=' + c.keyHash),
            })
          }
          openedByHello.delete(c.keyHash)
          sendResponse?.({ ok: true })
        } else {
          manual.delete(c.keyHash)
          try { await removeSeen(sessionStore, c.keyHash) } catch { /* ignore */ }
          sendResponse?.({ ok: false })
        }
      } else {
        const d = parsePairDecision(message)
        if (!d) { sendResponse?.({ ok: true }); return }
        const find = () => bridge.conns().find((x) => x.keyHash === d.keyHash && x.port === d.port) ?? bridge.conns().find((x) => x.keyHash === d.keyHash)
        let pinned = find()?.pinned ?? 'unknown'
        const outcome = await bridge.decide(d.port, d.allow, (c) => addApproved(chrome.storage.local, c), d.keyHash)
        pinned = find()?.pinned ?? pinned
        const closeTab = async () => {
          if (sender.tab?.id !== undefined) {
            try { await chrome.tabs.remove(sender.tab.id) } catch { /* tab gone */ }
          }
        }
        if (outcome === 'paired') {
          try { await removeSeen(sessionStore, d.keyHash) } catch { /* best effort */ }
          await closeTab()
        } else if (outcome === 'denied') {
          await closeTab()
        } else if (outcome === 'rejected') {
          setExpiry(selfRemoved, d.keyHash, Date.now() + 5_000)
          await removeApproved(chrome.storage.local, d.keyHash)
          await markAsked(chrome.storage.local, d.keyHash, Date.now(), true)
          const seen = (await readSeen(sessionStore)).find((x) => x.keyHash === d.keyHash)
          await upsertSeen(sessionStore, {
            keyHash: d.keyHash, client: seen?.client ?? '', port: seen?.port ?? d.port, pinned, rejected: true, at: Date.now(),
          })
        } else {
          await removeSeen(sessionStore, d.keyHash)
        }
        const reply: PairDecisionReply = { ok: true, outcome, pinned }
        sendResponse?.(reply)
      }
    } catch {
      try { sendResponse?.({ ok: false }) } catch { /* channel closed */ }
    }
  })()
  return true
})

export {}
