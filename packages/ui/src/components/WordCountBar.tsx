import React, { useEffect, useState, useMemo } from 'react'
import { useT, useLocale } from '../i18n'

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
  const t = useT()
  const locale = useLocale()
  const [isHidden, setIsHidden] = useState(false)

  const { words, readingTime } = useMemo(() => {
    const trimmed = text ? text.trim() : ''
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, readingTime }
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

  const formattedText = t('settings.wordcount', { words: new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(words), minutes: readingTime })

  return (
    <div
      className={classNames}
      role="status"
      aria-live="polite"
      style={{ fontFamily: 'var(--font-ui)', color: 'var(--pencil)', fontVariantNumeric: 'tabular-nums' }}
    >
      {formattedText}
    </div>
  )
}
