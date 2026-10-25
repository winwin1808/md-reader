import { EditorView } from '@codemirror/view'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { ASSET_MIME } from '@md-reader/core'
import { translateFacet, defaultTranslate } from './i18n-facet'
import type { TFunction } from '../i18n'

export type ImageSaver = (file: File) => Promise<{ src: string; note?: string }>


function imageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const out: File[] = []
  for (const f of Array.from(dt.files ?? [])) {
    if ((ASSET_MIME as readonly string[]).includes(f.type)) out.push(f)
  }
  return out
}

const addPh = StateEffect.define<{ id: number; from: number; to: number }>()
const delPh = StateEffect.define<number>()
const phField = StateField.define<Map<number, { from: number; to: number }>>({
  create: () => new Map(),
  update(v, tr) {
    const n = new Map<number, { from: number; to: number }>()
    for (const [id, r] of v) n.set(id, { from: tr.changes.mapPos(r.from, 1), to: tr.changes.mapPos(r.to, -1) })
    for (const e of tr.effects) {
      if (e.is(addPh)) n.set(e.value.id, { from: e.value.from, to: e.value.to })
      else if (e.is(delPh)) n.delete(e.value)
    }
    return n
  },
})

export function pasteImages(
  save: ImageSaver,
  opts?: { onError?(message: string): void; onNote?(message: string): void },
): Extension {
  let counter = 0
  const handle = (files: File[], view: EditorView, pos: number) => {
    for (const file of files) {
      const id = ++counter
      const ph = `![${view.state.facet(translateFacet)('live.image.uploading')}]()`
      view.dispatch({
        changes: { from: pos, insert: ph },
        selection: { anchor: pos + ph.length },
        userEvent: 'input.image',
        effects: addPh.of({ id, from: pos, to: pos + ph.length }),
      })
      pos += ph.length
      const name = file.name.replace(/\.[^.]+$/, '') || 'image'
      const replace = (insert: string) => {
        const r = view.state.field(phField).get(id)
        if (!r) return
        view.dispatch({ changes: { from: r.from, to: r.to, insert }, effects: delPh.of(id) })
      }
      save(file).then(
        (r) => {
          replace(`![${name}](${r.src})`)
          if (r.note) opts?.onNote?.(r.note)
        },
        (e) => {
          replace('')
          opts?.onError?.(e instanceof Error ? e.message : String(e))
        },
      )
    }
  }
  return [phField, EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFiles((event as ClipboardEvent).clipboardData)
      if (!files.length) return false
      event.preventDefault()
      handle(files, view, view.state.selection.main.head)
      return true
    },
    drop(event, view) {
      const files = imageFiles((event as DragEvent).dataTransfer)
      if (!files.length) return false
      event.preventDefault()
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head
      handle(files, view, pos)
      return true
    },
  })]
}

function readAsDataUrl(blob: Blob, t: TFunction = defaultTranslate): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error(t('live.image.readError')))
    r.readAsDataURL(blob)
  })
}

export async function toDataUrl(file: File, maxBytes = 1_000_000, t: TFunction = defaultTranslate): Promise<string> {
  if (file.size <= maxBytes) return readAsDataUrl(file, t)
  const bmp = await createImageBitmap(file)
  let w = bmp.width
  let h = bmp.height
  for (let i = 0; i < 4; i++) {
    w = Math.max(1, Math.floor(w / 2))
    h = Math.max(1, Math.floor(h / 2))
    let blob: Blob | null
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h)
      ;(c.getContext('2d') as OffscreenCanvasRenderingContext2D).drawImage(bmp, 0, 0, w, h)
      blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    } else {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
      blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
    }
    if (blob && blob.size <= maxBytes) {
      bmp.close?.()
      return readAsDataUrl(blob, t)
    }
  }
  bmp.close?.()
  throw new Error(t('live.image.tooLarge'))
}
