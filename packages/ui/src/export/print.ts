export function printDocument(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print()
  }
}

export function printSlides(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  document.body.classList.add('print-slides')
  
  const cleanup = () => {
    document.body.classList.remove('print-slides')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)

  if (typeof window.print === 'function') {
    window.print()
  }

  // Fallback in case afterprint does not fire
  setTimeout(cleanup, 1000)
}
