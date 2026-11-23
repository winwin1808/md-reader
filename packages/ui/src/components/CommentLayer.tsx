import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
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
  let b = blockOf(range.endContainer, container)
  if (!a || !b) return null
  let work = range
  if (a.el !== b.el) {
    const tail = range.cloneRange()
    tail.selectNodeContents(b.el)
    tail.setEnd(range.endContainer, range.endOffset)
    if (!tail.toString().trim()) {
      // End point sits at the start of the last block (triple-click): step back.
      const endEl = b.el
      const cands = Array.from(container.querySelectorAll('[data-sp]')).filter(
        (el) => el !== endEl && !endEl.contains(el) && !el.contains(endEl) && range.intersectsNode(el),
      )
      const prev = cands[cands.length - 1]
      const pb = prev ? blockOf(prev, container) : null
      b = pb ?? a
      work = range.cloneRange()
      work.setEnd(b.el, b.el.childNodes.length)
    }
  }
  const pre = work.cloneRange()
  pre.selectNodeContents(a.el)
  pre.setEnd(work.startContainer, work.startOffset)
  const before = pre.toString()
  let text: string
  if (a.el === b.el) {
    text = work === range ? work.toString() : work.toString().trimEnd()
  } else {
    const head = work.cloneRange()
    head.selectNodeContents(a.el)
    head.setStart(work.startContainer, work.startOffset)
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

type HighlightRegistry = { get(k: string): unknown; set(k: string, v: unknown): unknown; delete(k: string): unknown }
type HighlightCtor = new () => { add(r: Range): unknown }

function getHighlights(): { reg: HighlightRegistry; Ctor: HighlightCtor } | null {
  const g = globalThis as unknown as { CSS?: { highlights?: HighlightRegistry }; Highlight?: HighlightCtor }
  const reg = g.CSS?.highlights
  const Ctor = g.Highlight
  return reg && Ctor ? { reg, Ctor } : null
}

export interface CommentComposerProps {
  askName: boolean
  onSubmit(body: string, author?: string): void
  onCancel(): void
  style?: CSSProperties
}

export function CommentComposer(props: CommentComposerProps): JSX.Element {
  const { askName, onSubmit, onCancel, style } = props
  const t = useT()
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const send = () => {
    if (!body.trim()) return
    onSubmit(body, askName ? name.trim() || undefined : undefined)
  }
  return (
    <div className="comment-composer" style={style}>
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
            onCancel()
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            send()
          }
        }}
      />
      <div className="comment-composer-actions">
        <button type="button" onClick={send}>{t('comments.send')}</button>
        <button type="button" onClick={onCancel}>{t('comments.cancel')}</button>
      </div>
    </div>
  )
}

export function CommentLayer(props: CommentLayerProps): JSX.Element | null {
  const { container, source, enabled, onCreate, askName, threads, activeId, onSelect } = props
  const t = useT()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [composer, setComposer] = useState<{ range: { from: number; to: number }; top: number; left: number } | null>(null)
  const [markers, setMarkers] = useState<MarkerInfo[]>([])
  const openCount = useRef(0)
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
    let setNormal: unknown = null
    let setActive: unknown = null
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
      if (nNormal) { hl.reg.set('mdr-comment', normal); setNormal = normal }
      if (nActive) { hl.reg.set('mdr-comment-active', active); setActive = active }
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
      if (h && setNormal && h.reg.get('mdr-comment') === setNormal) h.reg.delete('mdr-comment')
      if (h && setActive && h.reg.get('mdr-comment-active') === setActive) h.reg.delete('mdr-comment-active')
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

  useEffect(() => {
    setComposer(null)
  }, [source, enabled, container])

  const open = useCallback(() => {
    if (!container) return
    const sel = container.ownerDocument.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    const range = computeRange(r, container, source)
    if (!range) return
    const rect = r.getBoundingClientRect?.()
    openCount.current += 1
    setComposer({ range, top: (rect?.bottom ?? 0) + 6, left: rect?.left ?? 0 })
  }, [container, source])

  if (!enabled || !container) return null
  const host = container.ownerDocument.body
  const close = () => setComposer(null)

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
        <CommentComposer
          key={openCount.current}
          askName={askName}
          style={{ position: 'fixed', top: composer.top, left: composer.left, zIndex: 1000 }}
          onSubmit={(body, author) => {
            onCreate(composer.range, body, author)
            close()
          }}
          onCancel={close}
        />
      )}
        </>,
        host,
      )}
    </>
  )
}
