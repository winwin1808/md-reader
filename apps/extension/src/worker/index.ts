import { isMarkdownUrl, isStaleCacheEntry } from '../shared/md-url'

chrome.action.onClicked.addListener(async (tab) => {
  const tabUrl = tab?.url || ''
  if (isMarkdownUrl(tabUrl) && tab?.id) {
    const appUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(tabUrl))
    await chrome.tabs.update(tab.id, { url: appUrl })
    return
  }
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
})

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'openApp') {
    const tabId = sender.tab?.id
    const fileUrl = message.fileUrl || ''
    const targetUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(fileUrl))

    const handleOpen = async () => {
      if (message.content && fileUrl) {
        try {
          await chrome.storage?.local?.set?.({
            ['file_content_' + fileUrl]: message.content,
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

chrome.runtime?.onStartup?.addListener(purgeStaleCache)
chrome.runtime?.onInstalled?.addListener(purgeStaleCache)

export {}

