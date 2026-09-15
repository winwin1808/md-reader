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
  let settings: any = {}
  try {
    settings = (await chrome.storage?.sync?.get(['autoFormatMd', 'alwaysOpenApp'])) || {}
  } catch (err) {
    console.warn('MD Reader: Failed to read settings:', err)
  }

  if (settings.autoFormatMd === false) {
    return
  }

  const isFileMatch = Boolean(window.location.pathname.match(/\.(md|markdown|txt)$/i))
  if (!isFileMatch && window.location.protocol === 'file:') {
    return
  }

  let markdownText = ''
  let isMarkdown = false
  const childNodes = document.body?.childNodes || []

  const pre = document.querySelector('pre')
  if (pre && pre.textContent && (isFileMatch || (document.body?.children?.length ?? 0) <= 2)) {
    markdownText = pre.textContent || ''
    isMarkdown = true
  } else if (childNodes.length === 1 && childNodes[0]) {
    const node = childNodes[0]
    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PRE')) {
      markdownText = node.textContent || ''
      isMarkdown = true
    }
  } else if (isFileMatch && (document.body?.innerText || document.body?.textContent)) {
    markdownText = document.body.innerText || document.body.textContent || ''
    isMarkdown = true
  }

  if (!isMarkdown || !document.body) {
    return
  }

  // Pre-cache markdown content into local storage
  try {
    await chrome.storage?.local?.set?.({
      ['file_content_' + window.location.href]: markdownText,
    })
  } catch (e) {
    console.warn('Failed to cache file content:', e)
  }

  // If "Always open app" is enabled (default: true), attempt background redirect
  const isMdFile = Boolean(window.location.pathname.match(/\.(md|markdown)$/i))
  const isAlwaysOpen = settings.alwaysOpenApp !== false
  if (isAlwaysOpen && (isMdFile || isFileMatch)) {
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
      } else {
        window.location.href = targetAppUrl
      }
    } catch (e) {
      // Chrome blocks direct navigation to chrome-extension:// from file:///
    }
  }

  // Always mount the floating widget!
  if (document.getElementById('md-reader-root')) {
    return
  }

  const rootEl = document.createElement('div')
  rootEl.id = 'md-reader-root'
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
      React.createElement(ErrorBoundary, { onError: restore },
        React.createElement(ContentApp, { markdown: markdownText })
      )
    )
  } catch (error) {
    console.error('Failed to render MD Reader content:', error)
    restore()
  }
})()
