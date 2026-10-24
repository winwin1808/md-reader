import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from './Icon'
import type { Slide } from '@md-reader/core'
import { ThemeProvider, useResolvedTheme } from '../theme/ThemeProvider'
import { MermaidBlock } from './MermaidBlock'
import { createRoot } from 'react-dom/client'

export interface PresentationSettings {
  slideBgColor?: string
  slideTextColor?: string
  slideHeadingColor?: string
  slideAccentColor?: string
  slideFont?: string
  slideBgImage?: string
  slideImageOpacity?: number // 0 - 100
}

export interface DeckProps {
  slides: Slide[]
  initialSlide?: number
  initialIndex?: number
  onClose?: () => void
  onSlideChange?: (index: number) => void
  onIndexChange?: (index: number) => void
  onOpenSpeakerView?: () => void
  onOpenSpeaker?: () => void
  mode?: 'light' | 'dark' | 'system'
  presentationSettings?: PresentationSettings
  mermaid?: boolean
}

export const SLIDE_W = 1280
export const SLIDE_H = 720

export function fitScale(stageW: number, stageH: number, slideW = SLIDE_W, slideH = SLIDE_H): number {
  if (!(stageW > 0) || !(stageH > 0)) return 1
  return Math.min(stageW / slideW, stageH / slideH)
}

export function SlideContent({ html, mermaid }: { html: string; mermaid: boolean }): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const theme = useResolvedTheme() === 'dark' ? 'dark' : 'default'
  useEffect(() => {
    if (!mermaid) return
    const container = ref.current
    if (!container) return
    const items: { root: ReturnType<typeof createRoot>; node: HTMLDivElement; pre: HTMLElement }[] = []
    container.querySelectorAll('code.language-mermaid').forEach((codeEl) => {
      const pre = codeEl.parentElement
      if (!pre || pre.tagName.toLowerCase() !== 'pre') return
      const node = document.createElement('div')
      pre.parentNode?.insertBefore(node, pre.nextSibling)
      pre.style.display = 'none'
      const root = createRoot(node)
      root.render(<MermaidBlock code={codeEl.textContent || ''} theme={theme} />)
      items.push({ root, node, pre })
    })
    return () => {
      items.forEach(({ root, node, pre }) => {
        setTimeout(() => root.unmount(), 0)
        node.remove()
        pre.style.display = ''
      })
    }
  }, [html, mermaid, theme])
  return <div ref={ref} className="md-viewer deck-slide-content" dangerouslySetInnerHTML={{ __html: html }} />
}

export function Deck(props: DeckProps): React.JSX.Element {
  const {
    slides,
    initialSlide,
    initialIndex,
    onClose,
    onSlideChange,
    onIndexChange,
    onOpenSpeakerView,
    onOpenSpeaker,
    presentationSettings,
  } = props

  const totalSlides = slides.length
  const startingIndex = initialIndex ?? initialSlide ?? 0

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (slides.length === 0) return 0
    return Math.max(0, Math.min(slides.length - 1, startingIndex))
  })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      const w = rect?.width ?? el.clientWidth
      const h = rect?.height ?? el.clientHeight
      setScale(fitScale(w, h))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2000)
  }, [])
  useEffect(() => {
    revealControls()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [revealControls])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    stageRef.current?.focus()
    return () => {
      if (previous && typeof previous.focus === 'function' && previous.isConnected) previous.focus()
    }
  }, [])

  useEffect(() => {
    const start = props.initialIndex ?? props.initialSlide
    if (start !== undefined && slides.length > 0) {
      const clamped = Math.max(0, Math.min(slides.length - 1, start))
      setCurrentIndex(clamped)
    }
  }, [props.initialIndex, props.initialSlide, slides.length])

  const goToSlide = useCallback(
    (nextIndex: number) => {
      if (slides.length === 0) return
      const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex))
      if (clamped !== currentIndex) {
        setCurrentIndex(clamped)
        onSlideChange?.(clamped)
        onIndexChange?.(clamped)
      }
    },
    [slides.length, currentIndex, onSlideChange, onIndexChange]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      revealControls()
      const target = e.target as HTMLElement | null
      let onButton = false
      if (target && typeof target.closest === 'function') {
        const tagName = target.tagName?.toLowerCase()
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          target.isContentEditable ||
          target.closest('input') ||
          target.closest('textarea')
        ) {
          return
        }
        onButton = tagName === 'button' || Boolean(target.closest('button'))
      }

      if (e.key === 'Tab') {
        const root = stageRef.current
        if (!root) return
        const btns = Array.from(
          root.querySelectorAll<HTMLButtonElement>('.deck-controls button:not(:disabled)')
        )
        e.preventDefault()
        if (btns.length === 0) {
          root.focus()
          return
        }
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        let next: number
        if (i === -1) next = e.shiftKey ? btns.length - 1 : 0
        else next = (i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length
        btns[next]?.focus()
        return
      }

      const isSpace = e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar' || e.code === 'Space'
      if (onButton && (isSpace || e.key === 'Enter')) return

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        isSpace
      ) {
        e.preventDefault()
        goToSlide(currentIndex + 1)
      } else if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'PageUp' ||
        e.key === 'Backspace'
      ) {
        e.preventDefault()
        goToSlide(currentIndex - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goToSlide(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goToSlide(slides.length - 1)
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentIndex, slides.length, goToSlide, onClose, revealControls])

  const handleOpenSpeaker = () => {
    onOpenSpeaker?.()
    onOpenSpeakerView?.()
  }

  const currentSlide = slides[currentIndex]
  const progressPercent = totalSlides > 0 ? ((currentIndex + 1) / totalSlides) * 100 : 0
  const counterText = totalSlides > 0 ? `Trang ${currentIndex + 1} / ${totalSlides}` : 'Trang 0 / 0'

  const overlayStyle: React.CSSProperties & Record<string, string | undefined> = {
    '--slide-custom-heading': presentationSettings?.slideHeadingColor,
    '--slide-custom-accent': presentationSettings?.slideAccentColor,
  }
  const frameVars: Record<string, string | undefined> = {
    '--slide-bg': presentationSettings?.slideBgColor || undefined,
    '--slide-fg': presentationSettings?.slideTextColor || undefined,
    '--slide-font': presentationSettings?.slideFont || undefined,
  }

  return (
    <ThemeProvider mode={props.mode ?? 'system'}>
      <div
        className="deck-overlay"
        style={overlayStyle}
        ref={stageRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Trình chiếu"
        onMouseMove={revealControls}
        onFocus={revealControls}
      >
        <div
          className="deck-slide-box"
          style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
        >
          <div
            className="deck-slide deck-slide-frame deck-slide-container"
            style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, ...frameVars }}
          >
            {Boolean(presentationSettings?.slideBgImage) && (
              <div
                className="deck-custom-bg-image"
                style={{
                  backgroundImage: `url(${presentationSettings!.slideBgImage})`,
                  opacity: (presentationSettings?.slideImageOpacity ?? 100) / 100,
                }}
                aria-hidden="true"
              />
            )}
            <SlideContent html={currentSlide?.html ?? ''} mermaid={props.mermaid !== false} />
          </div>
        </div>

        <div className={`deck-controls${controlsVisible ? '' : ' deck-controls-hidden'}`}>
          <span className="deck-counter">{counterText}</span>
          <button
            type="button"
            aria-label="Trang trước" title="Trang trước"
            disabled={totalSlides === 0 || currentIndex <= 0}
            onClick={() => goToSlide(currentIndex - 1)}
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <button
            type="button"
            aria-label="Trang sau" title="Trang sau"
            disabled={totalSlides === 0 || currentIndex >= totalSlides - 1}
            onClick={() => goToSlide(currentIndex + 1)}
          >
            <Icon name="chevron-right" size={20} />
          </button>
          <button
            type="button"
            aria-label="Cửa sổ diễn giả"
            title="Cửa sổ diễn giả"
            onClick={handleOpenSpeaker}
          >
            <Icon name="speaker" size={20} />
          </button>
          <button
            type="button"
            aria-label="Thoát trình chiếu"
            title="Thoát (Esc)"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div
          className="deck-progress-bar deck-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </ThemeProvider>
  )
}
