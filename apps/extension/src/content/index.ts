import React from 'react'
import { createRoot } from 'react-dom/client'
import { ContentApp } from './ContentApp'

;(function () {
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

  const originalBodyNodes = Array.from(childNodes)
  document.body.innerHTML = ''

  const rootEl = document.createElement('div')
  rootEl.id = 'md-reader-root'
  document.body.appendChild(rootEl)

  const shadow = rootEl.attachShadow({ mode: 'open' })

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('app.css')
  shadow.appendChild(link)

  try {
    const root = createRoot(shadow)
    root.render(React.createElement(ContentApp, { markdown: markdownText }))
  } catch (error) {
    console.error('Failed to render MD Reader content:', error)
    document.body.innerHTML = ''
    originalBodyNodes.forEach(node => document.body.appendChild(node))
  }
})()
