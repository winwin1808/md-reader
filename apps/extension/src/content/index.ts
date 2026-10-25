import React from 'react'
import { createRoot } from 'react-dom/client'
import { ContentApp, openInApp, FAIL_TEXT } from './ContentApp'
import css from './content.css?inline'
import { isMarkdownUrl } from '../shared/md-url'
import { requestPageRender } from './render'

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
  let alwaysOpenApp = false

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
  const isMdFile = isMarkdownUrl(window.location.href)
  const isTxtFile = Boolean(cleanPath.match(/\.txt$/i))
  const isFileProtocol = window.location.protocol === 'file:'

  if (isFileProtocol && !isMdFile && !isTxtFile) {
    return
  }

  // A real web app page (GitLab/Bitbucket editors, docs sites…) whose URL ends in .md is HTML, not raw markdown.
  if (!isFileProtocol && document.contentType === 'text/html') {
    return
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => {
        const onReady = () => {
          window.removeEventListener('DOMContentLoaded', onReady)
          resolve()
        }
        window.addEventListener('DOMContentLoaded', onReady)
        setTimeout(resolve, 1000)
      })
    }
  }

  const targetContainer = document.body || document.documentElement
  if (!targetContainer) {
    return
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

  if (!isMarkdown) {
    return
  }

  // If "Always open app" is enabled (default: false), hand off via the worker.
  // app.html is not web-accessible, so the content script never navigates there itself.
  let initialError: string | null = null
  if (alwaysOpenApp && isMdFile) {
    if (await openInApp(markdownText, true)) return
    initialError = FAIL_TEXT
  }

  // Mount the floating widget (when alwaysOpenApp is false)
  if (document.getElementById('md-reader-root')) {
    return
  }

  const render = await requestPageRender(markdownText)
  // Another run may have mounted while we awaited the worker.
  if (document.getElementById('md-reader-root')) {
    return
  }

  const rootEl = document.createElement('div')
  rootEl.id = 'md-reader-root'
  targetContainer.appendChild(rootEl)

  const shadow = rootEl.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)
  const mount = document.createElement('div')
  shadow.appendChild(mount)

  // Source nodes hidden in reader mode, with their previous inline display.
  const hidden: Array<{ el: HTMLElement; display: string }> = []
  const hideSource = () => {
    if (hidden.length === 0) {
      const els: HTMLElement[] =
        pre && pre.textContent && document.body?.contains(pre)
          ? [pre]
          : Array.from(document.body?.children ?? []).filter((c): c is HTMLElement => c !== rootEl && c instanceof HTMLElement)
      for (const el of els) hidden.push({ el, display: el.style.display })
    }
    for (const h of hidden) h.el.style.display = 'none'
  }
  const showSource = () => {
    for (const h of hidden) h.el.style.display = h.display
  }
  const restore = () => {
    showSource()
    rootEl.remove()
  }
  if (render) {
    rootEl.setAttribute('data-mode', 'read')
    hideSource()
  }
  const onShowRaw = (raw: boolean) => {
    if (raw) showSource()
    else hideSource()
    rootEl.setAttribute('data-mode', raw ? 'raw' : 'read')
  }

  try {
    const root = createRoot(mount)
    root.render(
      React.createElement(
        ErrorBoundary,
        { onError: restore },
        React.createElement(ContentApp, { markdown: markdownText, initialError, render, onShowRaw })
      )
    )
  } catch (error) {
    console.error('Failed to render MD Reader content:', error)
    restore()
  }

  window.addEventListener('popstate', () => {
    if (!isMarkdownUrl(window.location.href)) {
      document.getElementById('md-reader-root')?.remove()
    }
  })
})()
