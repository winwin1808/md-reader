export const NAME_KEY = 'mdr.displayName'

export function readName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function writeName(v: string): void {
  try {
    localStorage.setItem(NAME_KEY, v.trim())
  } catch {
    /* ignore */
  }
}
