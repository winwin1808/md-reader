/** SHA-256 hex qua globalThis.crypto.subtle. Chạy cả Node 18+ và browser. */
export async function hashText(text: string): Promise<string> {
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
