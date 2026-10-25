import { API_PATHS, type UploadAssetResponse } from '@md-reader/core'
import { toDataUrl } from '@md-reader/ui'
import type { ImageSaver } from '@md-reader/ui'

export interface ImageSaverCtx {
  serverUrl: string
  room?: string
  ownerToken?: string
  dirHandle?: FileSystemDirectoryHandle
  docName: string
}

const MSG_TOO_LARGE = 'Ảnh quá 2 MB.'
const MSG_QUOTA = 'Tài liệu đã dùng hết 50 MB ảnh.'
const MSG_NET = 'Không tải được ảnh lên máy chủ.'
const NOTE_INLINE = 'Ảnh được nhúng thẳng vào file — file .md sẽ nặng hơn.'

export async function uploadImage(serverUrl: string, room: string, token: string, file: File): Promise<UploadAssetResponse> {
  let res: Response
  try {
    res = await fetch(serverUrl.replace(/\/+$/, '') + API_PATHS.assets(room), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': file.type },
      body: file,
    })
  } catch {
    throw new Error(MSG_NET)
  }
  if (res.status === 413) {
    let code = ''
    try { code = ((await res.json()) as { error?: string }).error ?? '' } catch { /* ignore */ }
    throw new Error(code === 'quota' ? MSG_QUOTA : MSG_TOO_LARGE)
  }
  if (!res.ok) throw new Error(MSG_NET)
  try { return (await res.json()) as UploadAssetResponse } catch { throw new Error(MSG_NET) }
}

const pad = (n: number) => String(n).padStart(2, '0')
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}
function slug(name: string): string {
  const s = name.replace(/\.[^.]*$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'image'
}
function ext(file: File): string {
  const m = /^image\/(png|jpeg|gif|webp)$/.exec(file.type)
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]!) : 'png'
}
async function exists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try { await dir.getFileHandle(name); return true } catch { return false }
}

export function createImageSaver(ctx: ImageSaverCtx): ImageSaver {
  let noted = false
  return async (file: File) => {
    if (ctx.room && ctx.ownerToken) {
      const res = await uploadImage(ctx.serverUrl, ctx.room, ctx.ownerToken, file)
      return { src: res.url }
    }
    if (ctx.dirHandle) {
      const assets = await ctx.dirHandle.getDirectoryHandle('assets', { create: true })
      const base = `${slug(ctx.docName)}-${stamp(new Date())}`
      const e = ext(file)
      let name = `${base}.${e}`
      for (let n = 1; await exists(assets, name); n++) name = `${base}-${n}.${e}`
      const fh = await assets.getFileHandle(name, { create: true })
      const w = await fh.createWritable()
      await w.write(file)
      await w.close()
      return { src: `assets/${name}` }
    }
    const src = await toDataUrl(file, 1_000_000)
    if (noted) return { src }
    noted = true
    return { src, note: NOTE_INLINE }
  }
}
