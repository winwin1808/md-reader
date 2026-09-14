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
  const settings = await chrome.storage.sync.get(['autoFormatMd', 'alwaysOpenApp'])
  if (settings.autoFormatMd === false) {
    return
  }

  const isFileMatch = window.location.pathname.match(/\.(md|markdown|txt)$/i)
  if (!isFileMatch && window.location.protocol === 'file:') {
    return
  }

  let markdownText = ''
  let isMarkdown = false
  const childNodes = document.body.childNodes

  const pre = document.querySelector('pre')
  if (pre && pre.textContent && (isFileMatch || document.body.children.length <= 2)) {
    markdownText = pre.textContent || ''
    isMarkdown = true
  } else if (childNodes.length === 1 && childNodes[0]) {
    const node = childNodes[0]
    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PRE')) {
      markdownText = node.textContent || ''
      isMarkdown = true
    }
  } else if (isFileMatch && document.body.innerText) {
    markdownText = document.body.innerText
    isMarkdown = true
  }

  if (!isMarkdown) {
    return
  }

  // If "Always open app" is enabled (default: true), immediately redirect to MD Reader app
  const isMdFile = Boolean(window.location.pathname.match(/\.(md|markdown)$/i))
  const isAlwaysOpen = settings.alwaysOpenApp !== false
  if (isAlwaysOpen && (isMdFile || isFileMatch)) {
    try {
      await chrome.storage?.local?.set?.({
        ['file_content_' + window.location.href]: markdownText,
      })
    } catch (e) {
      console.warn('Failed to cache file content:', e)
    }
    const targetAppUrl = chrome.runtime.getURL('app.html?file=' + encodeURIComponent(window.location.href))
    if (typeof window.location.replace === 'function') {
      window.location.replace(targetAppUrl)
    } else {
      window.location.href = targetAppUrl
    }
    return
  }

  // Do not clear document.body, just overlay the button!
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
