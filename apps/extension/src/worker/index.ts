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

    if (message.content && fileUrl) {
      chrome.storage?.local?.set?.({
        ['file_content_' + fileUrl]: message.content,
      }).catch((err) => console.warn('Failed to cache file content in worker:', err))
    }

    if (tabId && message.replace) {
      chrome.tabs.update(tabId, { url: targetUrl }).then(() => {
        sendResponse?.({ success: true })
      }).catch((err) => {
        console.warn('Failed to update tab in worker:', err)
        chrome.tabs.create({ url: targetUrl }).then(() => sendResponse?.({ success: true, created: true }))
      })
      return true
    } else {
      chrome.tabs.create({ url: targetUrl }).then(() => {
        sendResponse?.({ success: true })
      }).catch((err) => {
        console.warn('Failed to create tab in worker:', err)
        sendResponse?.({ success: false, error: String(err) })
      })
      return true
    }
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
  if (!cleanUrl.match(/\.(md|markdown)$/i)) return

  // Skip GitHub web blob pages (e.g. github.com/owner/repo/blob/...)
  if (targetUrl.includes('github.com') && targetUrl.includes('/blob/')) return

  try {
    const settings = await chrome.storage.sync.get(['alwaysOpenApp', 'autoFormatMd'])
    if (settings.autoFormatMd === false) return
    if (settings.alwaysOpenApp === false) return

    const appUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(targetUrl))
    await chrome.tabs.update(tabId, { url: appUrl })
  } catch (err) {
    console.warn('MD Reader worker navigation error:', err)
  }
})

export {}

