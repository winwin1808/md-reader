import React from 'react'
import { createRoot } from 'react-dom/client'
import { ContentApp } from './ContentApp'

class ErrorBoundary extends React.Component<{ children: React.ReactNode, onError: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MD Reader ErrorBoundary caught error:', error, errorInfo)
    this.props.onError()
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

;(async function () {
  let autoFormatMd = true
  let alwaysOpenApp = true

  try {
    let localSettings: any = {}
    let syncSettings: any = {}
    if (typeof chrome.storage?.local?.get === 'function') {
      localSettings = (await chrome.storage.local.get(['autoFormatMd', 'alwaysOpenApp'])) || {}
    }
    if (typeof chrome.storage?.sync?.get === 'function') {
      syncSettings = (await chrome.storage.sync.get(['autoFormatMd', 'alwaysOpenApp'])) || {}
    }

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
  } catch (err) {
    console.warn('MD Reader: Failed to read settings:', err)
  }

  if (autoFormatMd === false) {
    return
  }

  const cleanPath = window.location.pathname.split('?')[0]?.split('#')[0] || ''
  const isMdFile = Boolean(cleanPath.match(/\.(md|markdown)$/i))
  const isTxtFile = Boolean(cleanPath.match(/\.txt$/i))
  const isFileProtocol = window.location.protocol === 'file:'

  if (isFileProtocol && !isMdFile && !isTxtFile) {
    return
  }

  if (!document.body || document.readyState === 'loading') {
    await new Promise<void>((resolve) => {
      if (document.readyState !== 'loading' && document.body) {
        resolve()
      } else {
        const onReady = () => {
          window.removeEventListener('DOMContentLoaded', onReady)
          window.removeEventListener('load', onReady)
          resolve()
        }
        window.addEventListener('DOMContentLoaded', onReady)
        window.addEventListener('load', onReady)
      }
    })
  }

  let markdownText = ''
  let isMarkdown = isMdFile
  const childNodes = document.body?.childNodes || []

  const pre = document.querySelector('pre')
  if (pre && pre.textContent && (isMdFile || isTxtFile || (document.body?.children?.length ?? 0) <= 2)) {
    markdownText = pre.textContent || ''
    isMarkdown = true
  } else if (childNodes.length === 1 && childNodes[0]) {
    const node = childNodes[0]
    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PRE')) {
      markdownText = node.textContent || ''
      isMarkdown = true
    }
  } else if ((isMdFile || isTxtFile) && (document.body?.innerText || document.body?.textContent)) {
    markdownText = document.body.innerText || document.body.textContent || ''
    isMarkdown = true
  }

  if (!isMarkdown || !document.body) {
    return
  }

  // Pre-cache markdown content into local storage
  if (markdownText) {
    try {
      await chrome.storage?.local?.set?.({
        ['file_content_' + window.location.href]: markdownText,
      })
    } catch (e) {
      console.warn('Failed to cache file content:', e)
    }
  }

  // If "Always open app" is enabled (default: true), attempt redirect
  if (alwaysOpenApp && isMdFile) {
    let redirected = false
    try {
      chrome.runtime?.sendMessage?.({
        action: 'openApp',
        fileUrl: window.location.href,
        content: markdownText,
        replace: true,
      })
    } catch (e) {
      console.warn('MD Reader worker message failed:', e)
    }

    try {
      const targetAppUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(window.location.href))
      if (typeof window.location.replace === 'function') {
        window.location.replace(targetAppUrl)
        redirected = true
      } else {
        window.location.href = targetAppUrl
        redirected = true
      }
    } catch (e) {
      // Chrome blocks direct navigation to chrome-extension:// from file:///
    }

    if (redirected) {
      return
    }
  }

  // Mount the floating widget (when alwaysOpenApp is false, or if navigation didn't unload page)
  if (document.getElementById('md-reader-root')) {
    return
  }

  const rootEl = document.createElement('div')
  rootEl.id = 'md-reader-root'
  rootEl.style.cssText =
    'all: initial !important; position: fixed !important; bottom: 24px !important; right: 24px !important; z-index: 2147483647 !important; display: block !important; width: auto !important; height: auto !important;'
  document.body.appendChild(rootEl)

  const shadow = rootEl.attachShadow({ mode: 'open' })

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('app.css')
  shadow.appendChild(link)

  const restore = () => {
    rootEl.remove()
  }

  try {
    const root = createRoot(shadow)
    root.render(
      React.createElement(
        ErrorBoundary,
        { onError: restore },
        React.createElement(ContentApp, { markdown: markdownText })
      )
    )
  } catch (error) {
    console.error('Failed to render MD Reader content:', error)
    restore()
  }
})()
