import React, { useEffect, useState } from 'react'

export interface ReadingProgressProps {
  color?: string
  className?: string
}

export function ReadingProgress(props?: ReadingProgressProps): React.JSX.Element {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false
    let rafId: number | null = null

    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
      const scrollHeight = document.documentElement.scrollHeight || 0
      const clientHeight = document.documentElement.clientHeight || window.innerHeight || 0
      const totalHeight = scrollHeight - clientHeight
      const current = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / totalHeight) * 100)) : 0
      setProgress(current)
      ticking = false
    }

    const handleScroll = () => {
      if (!ticking) {
        rafId = window.requestAnimationFrame(updateProgress)
        ticking = true
      }
    }

    updateProgress()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={props?.className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        zIndex: 9999,
        transition: 'width 0.1s ease-out',
        width: `${progress}%`,
        backgroundColor: props?.color || 'var(--md-accent, #3b82f6)',
      }}
    />
  )
}
