import React, { useEffect, useState, useMemo } from 'react'

export interface WordCountBarProps {
  text: string
  visible?: boolean
  autoHide?: boolean
  className?: string
}

export function WordCountBar({
  text,
  visible = true,
  autoHide = false,
  className,
}: WordCountBarProps): React.JSX.Element | null {
  const [isHidden, setIsHidden] = useState(false)

  const { words, chars, readingTime } = useMemo(() => {
    const trimmed = text ? text.trim() : ''
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
    const chars = text ? text.length : 0
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, chars, readingTime }
  }, [text])

  useEffect(() => {
    if (!autoHide) {
      setIsHidden(false)
      return
    }

    const handleScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY
      const docHeight = document.documentElement.scrollHeight
      if (scrollBottom >= docHeight - 120) {
        setIsHidden(true)
      } else {
        setIsHidden(false)
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [autoHide])

  if (!visible) {
    return null
  }

  const classNames = [
    'word-count-bar',
    isHidden ? 'is-hidden' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  const formattedText = `${words.toLocaleString()} từ · ${chars.toLocaleString()} ký tự · ~${readingTime} phút đọc`

  return (
    <div className={classNames} role="status" aria-live="polite">
      {formattedText}
    </div>
  )
}
