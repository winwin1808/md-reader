import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from './Icon'
import type { Slide } from '@md-reader/core'
import { ThemeProvider } from '../theme/ThemeProvider'

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
}

export const SLIDE_W = 1280
export const SLIDE_H = 720

export function fitScale(stageW: number, stageH: number, slideW = SLIDE_W, slideH = SLIDE_H): number {
  if (!(stageW > 0) || !(stageH > 0)) return 1
  return Math.min(stageW / slideW, stageH / slideH)
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
      const target = e.target as HTMLElement | null
      if (target && typeof target.closest === 'function') {
        const tagName = target.tagName?.toLowerCase()
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'button' ||
          target.isContentEditable ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('textarea')
        ) {
          return
        }
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        e.key === ' ' ||
        e.key === 'Space' ||
        e.key === 'Spacebar' ||
        e.code === 'Space'
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
  }, [currentIndex, slides.length, goToSlide, onClose])

  const handleOpenSpeaker = () => {
    onOpenSpeaker?.()
    onOpenSpeakerView?.()
  }

  const currentSlide = slides[currentIndex]
  const progressPercent = totalSlides > 0 ? ((currentIndex + 1) / totalSlides) * 100 : 0
  const counterText = totalSlides > 0 ? `Trang ${currentIndex + 1} / ${totalSlides}` : 'Trang 0 / 0'

  const overlayStyle: React.CSSProperties & Record<string, string | undefined> = {
    backgroundColor: presentationSettings?.slideBgColor || undefined,
    color: presentationSettings?.slideTextColor || undefined,
    fontFamily: presentationSettings?.slideFont || undefined,
    '--slide-bg': presentationSettings?.slideBgColor,
    '--slide-fg': presentationSettings?.slideTextColor,
    '--slide-font': presentationSettings?.slideFont,
    '--slide-custom-heading': presentationSettings?.slideHeadingColor,
    '--slide-custom-accent': presentationSettings?.slideAccentColor,
  }

  return (
    <ThemeProvider mode={props.mode ?? 'system'}>
      <div
        className="deck-overlay"
        style={overlayStyle}
        ref={stageRef}
        onMouseMove={revealControls}
        onFocus={revealControls}
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
        <div
          className="deck-slide-box"
          style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
        >
          <div
            className="deck-slide deck-slide-frame deck-slide-container deck-slide-content"
            style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
          >
            <div
              className="md-viewer deck-slide-content"
              dangerouslySetInnerHTML={{ __html: currentSlide?.html ?? '' }}
            />
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
