chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
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

