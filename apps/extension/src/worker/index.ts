chrome.action.onClicked.addListener(async (tab) => {
  const tabUrl = tab?.url || ''
  const cleanUrl = tabUrl.split('?')[0]?.split('#')[0] || ''
  if (cleanUrl.match(/\.(md|markdown)$/i) && tab?.id) {
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.url
  if (!targetUrl) return

  // Do not redirect extension pages
  const appBaseUrl = chrome.runtime.getURL('')
  if (targetUrl.startsWith(appBaseUrl)) return

  // Check if URL ends with markdown extension (strip query params and hash)
  const cleanUrl = targetUrl.split('?')[0]?.split('#')[0] || ''
  if (!cleanUrl.match(/\.(md|markdown|mdown|mkd|mdx)$/i)) return

  // Skip GitHub web blob pages (e.g. github.com/owner/repo/blob/...)
  if (targetUrl.includes('github.com') && targetUrl.includes('/blob/')) return

  // Skip file:// URLs here because content.js must run first to extract and cache DOM content!
  if (targetUrl.startsWith('file:')) return

  try {
    let localSettings: any = {}
    let syncSettings: any = {}
    if (typeof chrome.storage?.local?.get === 'function') {
      localSettings = (await chrome.storage.local.get(['alwaysOpenApp', 'autoFormatMd'])) || {}
    }
    if (typeof chrome.storage?.sync?.get === 'function') {
      syncSettings = (await chrome.storage.sync.get(['alwaysOpenApp', 'autoFormatMd'])) || {}
    }

    let autoFormatMd = true
    let alwaysOpenApp = false
    if (typeof localSettings.autoFormatMd === 'boolean') {
      autoFormatMd = localSettings.autoFormatMd
    } else if (typeof syncSettings.autoFormatMd === 'boolean') {
      autoFormatMd = syncSettings.autoFormatMd
    }

    if (typeof localSettings.alwaysOpenApp === 'boolean') {
      alwaysOpenApp = localSettings.alwaysOpenApp
    } else if (typeof syncSettings.alwaysOpenApp === 'boolean') {
      alwaysOpenApp = syncSettings.alwaysOpenApp
    }

    if (autoFormatMd === false) return
    if (alwaysOpenApp === false) {
      if ((chrome as any).scripting?.executeScript) {
        try {
          await (chrome as any).scripting.executeScript({
            target: { tabId },
            files: ['content.js'],
          })
        } catch {
          // Ignored
        }
      }
      return
    }

    const appUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(targetUrl))
    await chrome.tabs.update(tabId, { url: appUrl })
  } catch (err) {
    console.warn('MD Reader worker navigation error:', err)
  }
})

export {}

