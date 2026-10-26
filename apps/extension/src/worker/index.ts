import { MAX_RENDER_CHARS, renderMarkdownForPage } from './render-md'
import { createBridge } from './bridge'
import { createExecuteInApp } from './bridge-route'
import { createRecord, writeDocText, deleteRecord, listRecent, getRecord, docQuery, ensureShortKey, docParam } from '../app/doc-registry'
import {
  BRIDGE_SCAN_MSG, BRIDGE_STORAGE_KEY, PAIR_DECISION_MSG, addApproved, nextScanDelayMin, parseBridgeSettings, parsePairDecision, readBridgeSettings,
} from './bridge-storage'
import { isMarkdownUrl, isGithubBlobMarkdownUrl, isStaleCacheEntry, makeCacheEntry } from '../shared/md-url'

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
        const { html, title } = renderMarkdownForPage(md)
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

const bridge = createBridge({
  connect: (url) => new WebSocket(url) as unknown as import('./bridge').WsLike,
  approved: async () => (await readBridgeSettings(chrome.storage.local)).approved,
  requestPairing: ({ port, client, keyHash }) => {
    if ((revokedUntil.get(keyHash) ?? 0) > Date.now()) return
    void chrome.tabs.create({
      url: chrome.runtime.getURL('app.html?pair=' + port + '&client=' + encodeURIComponent(client) + '&key=' + keyHash),
    })
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
      return
    }
    const n = await bridge.scan()
    const idle = n > 0 ? 0 : (await readIdle()) + 1
    await setIdle(idle)
    await chrome.alarms?.create?.(ALARM, { periodInMinutes: nextScanDelayMin(idle) })
  } catch (err) {
    console.warn('Bridge tick failed:', err)
  }
}

async function onBoot(): Promise<void> {
  await purgeStaleCache()
  await tick()
}

chrome.runtime?.onStartup?.addListener(onBoot)
chrome.runtime?.onInstalled?.addListener(onBoot)

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
      revokedUntil.set(a.keyHash, Date.now() + 60_000)
    }
  }
  if (parseBridgeSettings(changes[BRIDGE_STORAGE_KEY].oldValue).enabled !== next.enabled) void tick()
})

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  const type = message?.type
  if (type !== PAIR_DECISION_MSG && type !== BRIDGE_SCAN_MSG) return
  const appUrl = chrome.runtime.getURL('app.html')
  if (sender?.id !== chrome.runtime.id || !sender?.url || !sender.url.startsWith(appUrl)) return
  void (async () => {
    if (type === BRIDGE_SCAN_MSG) {
      await setIdle(0)
      await tick()
    } else if (parsePairDecision(message)) {
      const d = parsePairDecision(message)!
      await bridge.decide(d.port, d.allow, (c) => addApproved(chrome.storage.local, c), d.keyHash)
      if (sender.tab?.id !== undefined) {
        try { await chrome.tabs.remove(sender.tab.id) } catch { /* tab gone */ }
      }
    }
    sendResponse?.({ ok: true })
  })()
  return true
})

export {}
