/** SHA-256 hex qua (globalThis as unknown as SubtleLike).crypto.subtle. Chạy cả Node 18+ và browser. */
type SubtleLike = { crypto: { subtle: { digest(algo: string, data: Uint8Array): Promise<ArrayBuffer> } } }

export async function hashText(text: string): Promise<string> {
  const buffer = await (globalThis as unknown as SubtleLike).crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
