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

;(function () {
  const isFileMatch = window.location.pathname.match(/\.(md|markdown|txt)$/i)
  if (!isFileMatch && window.location.protocol === 'file:') {
    return
  }

  const childNodes = document.body.childNodes
  let markdownText = ''
  let isMarkdown = false

  if (childNodes.length === 1) {
    const node = childNodes[0]
    if (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdownText = node.textContent || ''
        isMarkdown = true
      } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PRE') {
        markdownText = node.textContent || ''
        isMarkdown = true
      }
    }
  }

  if (!isMarkdown) {
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
