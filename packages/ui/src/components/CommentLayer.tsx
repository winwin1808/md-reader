import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import {
  parseSourcePos,
  selectionToSourceRange,
  COMMENT_BODY_MAX,
  COMMENT_AUTHOR_MAX,
  type CommentThread,
  type SourceBlock,
} from '@md-reader/core'
import { useT } from '../i18n'

export interface CommentLayerProps {
  container: HTMLElement | null
  source: string
  threads: CommentThread[]
  activeId: string | null
  enabled: boolean
  onCreate(range: { from: number; to: number }, body: string, author?: string): void
  onSelect(id: string): void
  askName: boolean
}

function blockOf(node: Node | null, container: HTMLElement): { el: Element; block: SourceBlock } | null {
  let n: Node | null = node
  while (n && n !== container) {
    if (n.nodeType === 1) {
      const el = n as Element
      if (el.hasAttribute('data-sp')) {
        const block = parseSourcePos(el.getAttribute('data-sp'))
        return block ? { el, block } : null
      }
    }
    n = n.parentNode
  }
  return null
}

function countBefore(hay: string, needle: string): number {
  if (!needle) return 0
  let c = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    c++
    i = hay.indexOf(needle, i + needle.length)
  }
  return c
}

function computeRange(
  range: Range,
  container: HTMLElement,
  source: string,
): { from: number; to: number } | null {
  const a = blockOf(range.startContainer, container)
  const b = blockOf(range.endContainer, container)
  if (!a || !b) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(a.el)
  pre.setEnd(range.startContainer, range.startOffset)
  const before = pre.toString()
  let text: string
  if (a.el === b.el) {
    text = range.toString()
  } else {
    const head = range.cloneRange()
    head.selectNodeContents(a.el)
    head.setStart(range.startContainer, range.startOffset)
    text = head.toString()
  }
  if (!text.trim()) return null
  const m = selectionToSourceRange(source, a.block, text, countBefore(before, text))
  const from = m.from
  const to = a.el === b.el ? m.to : b.block.end
  return from < to ? { from, to } : null
}

export function CommentLayer(props: CommentLayerProps): JSX.Element | null {
  const { container, source, enabled, onCreate, askName } = props
  const t = useT()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [composer, setComposer] = useState<{ range: { from: number; to: number }; top: number; left: number } | null>(null)
  const [body, setBody] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!enabled || !container) {
      setPos(null)
      return
    }
    const doc = container.ownerDocument
    const onChange = () => {
      const sel = doc.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return setPos(null)
      const r = sel.getRangeAt(0)
      if (!container.contains(r.startContainer) || !container.contains(r.endContainer)) return setPos(null)
      if (!computeRange(r, container, source)) return setPos(null)
      const rect = r.getBoundingClientRect?.()
      setPos({ top: (rect?.bottom ?? 0) + 6, left: rect?.left ?? 0 })
    }
    doc.addEventListener('selectionchange', onChange)
    return () => doc.removeEventListener('selectionchange', onChange)
  }, [enabled, container, source])

  const open = useCallback(() => {
    if (!container) return
    const sel = container.ownerDocument.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    const range = computeRange(r, container, source)
    if (!range) return
    const rect = r.getBoundingClientRect?.()
    setComposer({ range, top: (rect?.bottom ?? 0) + 6, left: rect?.left ?? 0 })
    setBody('')
    setName('')
  }, [container, source])

  if (!enabled || !container) return null
  const host = container.ownerDocument.body
  const close = () => setComposer(null)
  const send = () => {
    if (!composer || !body.trim()) return
    onCreate(composer.range, body, askName ? name.trim() || undefined : undefined)
    close()
  }

  return createPortal(
    <>
      {pos && !composer && (
        <button
          type="button"
          className="comment-add-btn"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={open}
        >
          {t('comments.add')}
        </button>
      )}
      {composer && (
        <div
          className="comment-composer"
          style={{ position: 'fixed', top: composer.top, left: composer.left, zIndex: 1000 }}
        >
          {askName && (
            <input
              aria-label={t('comments.yourName')}
              maxLength={COMMENT_AUTHOR_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <textarea
            autoFocus
            aria-label={t('comments.add')}
            maxLength={COMMENT_BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                close()
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                send()
              }
            }}
          />
          <div className="comment-composer-actions">
            <button type="button" onClick={send}>{t('comments.send')}</button>
            <button type="button" onClick={close}>{t('comments.cancel')}</button>
          </div>
        </div>
      )}
    </>,
    host,
  )
}
