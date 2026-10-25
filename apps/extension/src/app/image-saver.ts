import { API_PATHS, type UploadAssetResponse } from '@md-reader/core'
import { createT } from '@md-reader/ui'
import type { ImageSaver, TFunction } from '@md-reader/ui'

export interface ImageSaverCtx {
  serverUrl: string
  room?: string
  ownerToken?: string
  dirHandle?: FileSystemDirectoryHandle
  docName: string
  hasFileHandle?: boolean
  requestDir?: () => Promise<FileSystemDirectoryHandle | null>
  t?: TFunction
}

export const INLINE_IMAGE_MAX_BYTES = 600_000

function readDataUrl(file: File, t: TFunction): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error(t('ext.image.net')))
    r.readAsDataURL(file)
  })
}

export async function uploadImage(serverUrl: string, room: string, token: string, file: File, t: TFunction = createT('vi')): Promise<UploadAssetResponse> {
  const MSG_NET = t('ext.image.net')
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
    throw new Error(code === 'quota' ? t('ext.image.quota') : t('ext.image.tooLarge'))
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

async function saveToDir(dir: FileSystemDirectoryHandle, docName: string, file: File) {
  const assets = await dir.getDirectoryHandle('assets', { create: true })
  const base = `${slug(docName)}-${stamp(new Date())}`
  const e = ext(file)
  let name = `${base}.${e}`
  for (let n = 1; await exists(assets, name); n++) name = `${base}-${n}.${e}`
  const fh = await assets.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(file)
  await w.close()
  return { src: `assets/${name}` }
}

export function createImageSaver(ctx: ImageSaverCtx): ImageSaver {
  const t = ctx.t ?? createT('vi')
  return async (file: File) => {
    if (ctx.room && ctx.ownerToken) {
      const res = await uploadImage(ctx.serverUrl, ctx.room, ctx.ownerToken, file, t)
      return { src: res.url }
    }
    if (ctx.dirHandle) return saveToDir(ctx.dirHandle, ctx.docName, file)
    if (file.size <= INLINE_IMAGE_MAX_BYTES) return { src: await readDataUrl(file, t) }
    if (ctx.hasFileHandle) {
      const dir = ctx.requestDir ? await ctx.requestDir() : null
      if (!dir) throw new Error(t('ext.image.declined'))
      return saveToDir(dir, ctx.docName, file)
    }
    throw new Error(t('ext.image.noFile'))
  }
}
