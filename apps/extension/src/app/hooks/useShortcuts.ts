import { useEffect } from 'react'

export function useShortcuts(map: {
  onSearch(): void
  onCloseSearch(): void
  isSearchOpen: boolean
  onToggleMindmap(): void
  onPresent(): void
  presentEnabled: boolean
}): void {
  const { onSearch, onCloseSearch, isSearchOpen, onToggleMindmap, onPresent, presentEnabled } = map

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (
        (e.key === 'p' || e.key === 'P') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isInput &&
        presentEnabled
      ) {
        e.preventDefault()
        onPresent()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [presentEnabled, onPresent])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        onSearch()
      } else if (e.key === 'Escape' && isSearchOpen) {
        onCloseSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen, onSearch, onCloseSearch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        onToggleMindmap()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleMindmap])
}
