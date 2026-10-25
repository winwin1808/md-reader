import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Slide } from '@md-reader/core'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { fitScale, SLIDE_W, SLIDE_H, SlideContent } from './Deck'

export interface SpeakerViewProps {
  slides: Slide[]
  currentSlideIndex: number
  onSlideChange: (index: number) => void
  elapsedSeconds?: number
  onResetTimer?: () => void
  mermaid?: boolean
}

function formatClock(date: Date): string {
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = String(hours % 12 || 12).padStart(2, '0')
  return `${displayHours}:${minutes}:${seconds} ${ampm}`
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

function ScaledSlide({ html, className = '', mermaid }: { html: string; className?: string; mermaid: boolean }): React.JSX.Element {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = paneRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      setScale(fitScale(rect?.width ?? el.clientWidth, rect?.height ?? el.clientHeight))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className={`speaker-slide-frame ${className}`.trim()} ref={paneRef}>
      <div className="speaker-slide-box" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
        <div
          className="speaker-slide-canvas"
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        >
          <SlideContent html={html} mermaid={mermaid} />
        </div>
      </div>
    </div>
  )
}

export function SpeakerView({
  slides,
  currentSlideIndex,
  onSlideChange,
  elapsedSeconds,
  onResetTimer,
  mermaid,
}: SpeakerViewProps): React.JSX.Element {
  const t = useT()
  const totalSlides = slides.length
  const currentSlide = slides[currentSlideIndex]
  const hasNext = currentSlideIndex < totalSlides - 1
  const hasPrev = currentSlideIndex > 0
  const nextSlide = hasNext ? slides[currentSlideIndex + 1] : null

  // Local clock state
  const [currentTime, setCurrentTime] = useState<string>(() => formatClock(new Date()))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatClock(new Date()))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Timer state
  const [internalElapsed, setInternalElapsed] = useState<number>(0)
  const [isRunning, setIsRunning] = useState<boolean>(true)

  useEffect(() => {
    if (elapsedSeconds !== undefined || !isRunning) return

    const interval = setInterval(() => {
      setInternalElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [elapsedSeconds, isRunning])

  const currentElapsed = elapsedSeconds !== undefined ? elapsedSeconds : internalElapsed

  const handleToggleTimer = () => {
    setIsRunning((prev) => !prev)
  }

  const handleResetTimer = () => {
    if (onResetTimer) {
      onResetTimer()
    }
    setInternalElapsed(0)
  }

  const goToNext = useCallback(() => {
    if (hasNext) {
      onSlideChange(currentSlideIndex + 1)
    }
  }, [hasNext, onSlideChange, currentSlideIndex])

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onSlideChange(currentSlideIndex - 1)
    }
  }, [hasPrev, onSlideChange, currentSlideIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName?.toLowerCase()
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'button' ||
          tagName === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        goToNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace' || e.key === 'PageUp') {
        e.preventDefault()
        goToPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goToNext, goToPrev])

  return (
    <div className="speaker-view-container">
      <header className="speaker-view-header">
        <div className="speaker-view-header-left">
          <div className="speaker-slide-counter">
            {t('present.slideCounter', { i: totalSlides > 0 ? currentSlideIndex + 1 : 0, n: totalSlides })}
          </div>
          <button
            type="button"
            className="speaker-btn"
            onClick={goToPrev}
            disabled={!hasPrev}
          >
            <Icon name="chevron-left" size={16} /> {t('present.prev')}
          </button>
          <button
            type="button"
            className="speaker-btn"
            onClick={goToNext}
            disabled={!hasNext}
          >
            {t('present.next')} <Icon name="chevron-right" size={16} />
          </button>
        </div>

        <div className="speaker-view-header-center">
          <div className="speaker-timer-group">
            <span className="speaker-timer-label">{t('present.elapsed')}</span>
            <span className="speaker-timer-display">{formatElapsed(currentElapsed)}</span>
            <button
              type="button"
              className="speaker-btn"
              onClick={handleToggleTimer}
            >
              {isRunning ? t('present.pause') : t('present.resume')}
            </button>
            <button
              type="button"
              className="speaker-btn"
              onClick={handleResetTimer}
            >
              {t('present.reset')}
            </button>
          </div>
        </div>

        <div className="speaker-view-header-right">
          <span className="speaker-clock-display" data-testid="speaker-clock">
            {currentTime}
          </span>
        </div>
      </header>

      <main className="speaker-view-body">
        <section className="speaker-current-slide-wrapper">
          <div className="speaker-section-label">{t('present.currentSlide')}</div>
          <ScaledSlide html={currentSlide?.html || ''} mermaid={mermaid !== false} />
        </section>

        <section className="speaker-sidebar-wrapper">
          <div className="speaker-next-slide-wrapper">
            <div className="speaker-section-label">{t('present.nextSlideLabel')}</div>
            {nextSlide ? (
              <ScaledSlide html={nextSlide.html || ''} mermaid={mermaid !== false} />
            ) : (
              <div className="speaker-slide-frame speaker-slide-empty">
                <span>{t('present.lastSlide')}</span>
              </div>
            )}
          </div>

          <div className="speaker-notes-wrapper">
            <div className="speaker-section-label">{t('present.notes')}</div>
            <div className="speaker-notes-box">
              {currentSlide?.notes && currentSlide.notes.length > 0 ? (
                currentSlide.notes.map((note, idx) => <p key={idx}>{note}</p>)
              ) : (
                <div className="speaker-notes-empty">{t('present.noNotes')}</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
