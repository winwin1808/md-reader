export function printDocument(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print()
  }
}
