const key = (room: string) => `mdr.links.${room}`

export async function getLinkTokens(room: string): Promise<Record<string, string>> {
  try {
    const out = await chrome.storage.local.get(key(room))
    const v = out?.[key(room)]
    return v && typeof v === 'object' ? { ...(v as Record<string, string>) } : {}
  } catch {
    return {}
  }
}

export async function saveLinkToken(room: string, prefix: string, token: string): Promise<void> {
  try {
    const cur = await getLinkTokens(room)
    cur[prefix] = token
    await chrome.storage.local.set({ [key(room)]: cur })
  } catch { /* best effort */ }
}

export async function forgetLinkToken(room: string, prefix: string): Promise<void> {
  try {
    const cur = await getLinkTokens(room)
    delete cur[prefix]
    await chrome.storage.local.set({ [key(room)]: cur })
  } catch { /* best effort */ }
}

export async function forgetRoomTokens(room: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key(room))
  } catch { /* best effort */ }
}
