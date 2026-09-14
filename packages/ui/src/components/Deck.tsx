import React, { useState, useEffect, useCallback } from 'react'
import type { Slide } from '@md-reader/core'
import { ThemeProvider, type ColorTheme } from '../theme/ThemeProvider'

export interface DeckProps {
  slides: Slide[]
  initialSlide?: number
  onClose?: () => void
  onSlideChange?: (index: number) => void
  onOpenSpeakerView?: () => void
  colorTheme?: ColorTheme
  mode?: 'light' | 'dark' | 'system'
}

export function Deck(props: DeckProps): React.JSX.Element {
  const {
    slides,
    initialSlide = 0,
    onClose,
    onSlideChange,
    onOpenSpeakerView,
  } = props

  const totalSlides = slides.length

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (slides.length === 0) return 0
    return Math.max(0, Math.min(slides.length - 1, initialSlide))
  })

  useEffect(() => {
    if (props.initialSlide !== undefined && slides.length > 0) {
      const clamped = Math.max(0, Math.min(slides.length - 1, props.initialSlide))
      setCurrentIndex(clamped)
    }
  }, [props.initialSlide, slides.length])

  const goToSlide = useCallback(
    (nextIndex: number) => {
      if (slides.length === 0) return
      const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex))
      if (clamped !== currentIndex) {
        setCurrentIndex(clamped)
        onSlideChange?.(clamped)
      }
    },
    [slides.length, currentIndex, onSlideChange]
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

  const currentSlide = slides[currentIndex]
  const progressPercent = totalSlides > 0 ? ((currentIndex + 1) / totalSlides) * 100 : 0
  const counterText = totalSlides > 0 ? `Slide ${currentIndex + 1} / ${totalSlides}` : 'Slide 0 / 0'

  return (
    <ThemeProvider mode={props.mode ?? 'system'} colorTheme={props.colorTheme}>
      <div className="deck-overlay">
        <div className="deck-slide">
          <div
            className="md-viewer"
            dangerouslySetInnerHTML={{ __html: currentSlide?.html ?? '' }}
          />
        </div>

        <div className="deck-controls">
          <span className="deck-counter">{counterText}</span>
          <button
            type="button"
            aria-label="Slide trước"
            disabled={totalSlides === 0 || currentIndex <= 0}
            onClick={() => goToSlide(currentIndex - 1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Slide kế tiếp"
            disabled={totalSlides === 0 || currentIndex >= totalSlides - 1}
            onClick={() => goToSlide(currentIndex + 1)}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Giao diện diễn giả"
            title="Mở chế độ diễn giả"
            onClick={onOpenSpeakerView}
          >
            🎙
          </button>
          <button
            type="button"
            aria-label="Thoát trình chiếu"
            title="Thoát (Esc)"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          className="deck-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </ThemeProvider>
  )
}
