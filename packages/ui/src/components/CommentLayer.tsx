import { useCallback, useEffect, useRef, useState } from 'react'
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

interface MarkerInfo { top: number; n: number; active: boolean; firstId: string }

function findTextRange(block: Element, quote: string): Range | null {
  if (!quote) return null
  const doc = block.ownerDocument
  const nodes: Text[] = []
  let full = ''
  const walker = doc.createTreeWalker(block, 4 /* SHOW_TEXT */)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text)
    full += (n as Text).data
  }
  const idx = full.indexOf(quote)
  if (idx === -1) return null
  const end = idx + quote.length
  let acc = 0
  const r = doc.createRange()
  let started = false
  for (const tn of nodes) {
    const len = tn.data.length
    if (!started && idx < acc + len) {
      r.setStart(tn, idx - acc)
      started = true
    }
    if (started && end <= acc + len) {
      r.setEnd(tn, end - acc)
      return r
    }
    acc += len
  }
  return null
}

type HighlightRegistry = { set(k: string, v: unknown): unknown; delete(k: string): unknown }
type HighlightCtor = new () => { add(r: Range): unknown }

function getHighlights(): { reg: HighlightRegistry; Ctor: HighlightCtor } | null {
  const g = globalThis as unknown as { CSS?: { highlights?: HighlightRegistry }; Highlight?: HighlightCtor }
  const reg = g.CSS?.highlights
  const Ctor = g.Highlight
  return reg && Ctor ? { reg, Ctor } : null
}

export function CommentLayer(props: CommentLayerProps): JSX.Element | null {
  const { container, source, enabled, onCreate, askName, threads, activeId, onSelect } = props
  const t = useT()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [composer, setComposer] = useState<{ range: { from: number; to: number }; top: number; left: number } | null>(null)
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [markers, setMarkers] = useState<MarkerInfo[]>([])
  const targetsRef = useRef<Map<Element, string[]>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    targetsRef.current = new Map()
    if (!enabled || !container) {
      setMarkers([])
      return
    }
    const blocks = Array.from(container.querySelectorAll('[data-sp]')).flatMap((el) => {
      const b = parseSourcePos(el.getAttribute('data-sp'))
      return b ? [{ el, b }] : []
    })
    const targets = new Map<Element, string[]>()
    const marked: Element[] = []
    const activeEls: Element[] = []
    const hl = getHighlights()
    const normal = hl ? new hl.Ctor() : null
    const active = hl ? new hl.Ctor() : null
    let nNormal = 0
    let nActive = 0
    for (const th of threads) {
      if (th.resolved || th.deleted || !th.range) continue
      const { from, to } = th.range
      const hit = blocks.filter(({ b }) => b.start < to && from < b.end)
      const deepest = hit.find((x) => !hit.some((y) => y !== x && x.el.contains(y.el)))
      if (!deepest) continue
      const el = deepest.el
      const ids = targets.get(el) ?? []
      ids.push(th.id)
      targets.set(el, ids)
      const isActive = th.id === activeId
      const range = hl ? findTextRange(el, th.quote) : null
      if (range && normal && active) {
        if (isActive) { active.add(range); nActive++ } else { normal.add(range); nNormal++ }
      } else {
        el.classList.add('comment-block-marked')
        marked.push(el)
        if (isActive) {
          el.setAttribute('data-comment-active', '')
          activeEls.push(el)
        }
      }
    }
    if (hl) {
      if (nNormal) hl.reg.set('mdr-comment', normal)
      if (nActive) hl.reg.set('mdr-comment-active', active)
    }
    targetsRef.current = targets
    const measure = () => {
      setMarkers(
        Array.from(targets.entries()).map(([el, ids]) => ({
          top: (el as HTMLElement).offsetTop,
          n: ids.length,
          active: activeId !== null && ids.includes(activeId),
          firstId: ids[0]!,
        })),
      )
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(container)
    return () => {
      ro?.disconnect()
      const h = getHighlights()
      h?.reg.delete('mdr-comment')
      h?.reg.delete('mdr-comment-active')
      for (const el of marked) el.classList.remove('comment-block-marked')
      for (const el of activeEls) el.removeAttribute('data-comment-active')
      setMarkers([])
    }
  }, [threads, activeId, enabled, container, source])

  useEffect(() => {
    if (!enabled || !container) return
    const onClick = (e: MouseEvent) => {
      const sel = container.ownerDocument.getSelection()
      if (sel && !sel.isCollapsed) return
      const hit = blockOf(e.target as Node, container)
      if (!hit) return
      const ids = targetsRef.current.get(hit.el)
      if (ids && ids.length) onSelectRef.current(ids[0]!)
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [enabled, container])

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

  return (
    <>
      {createPortal(
        <div className="comment-markers" aria-hidden="false">
          {markers.map((m) => (
            <button
              key={m.firstId}
              type="button"
              className="comment-marker"
              aria-label={`${t('comments.title')}: ${m.n}`}
              style={{ top: m.top }}
              {...(m.active ? { 'data-active': '' } : {})}
              onClick={() => onSelect(m.firstId)}
            >
              {m.n}
            </button>
          ))}
        </div>,
        container,
      )}
      {createPortal(
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
      )}
    </>
  )
}
