import { listRecent, getHandle, createRecord, writeDocText, storeHandle } from '../doc-registry'

export interface StoredFileEntry {
  id: string
  name: string
  handle: FileSystemFileHandle
  lastModified: number
}

const MARKDOWN_PICKER_TYPES = [
  {
    description: 'Markdown Files',
    accept: {
      'text/markdown': ['.md', '.markdown'],
    },
  },
]

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

export async function openLocalFile(): Promise<{
  handle: FileSystemFileHandle
  file: File
  content: string
} | null> {
  if (!isFileSystemAccessSupported()) {
    return null
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: MARKDOWN_PICKER_TYPES,
      multiple: false,
    })

    if (!handle) {
      return null
    }

    const file = await handle.getFile()
    const content = await file.text()

    return { handle, file, content }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function saveToHandle(
  handle: FileSystemFileHandle,
  content: string
): Promise<number> {
  const writable = await (handle as any).createWritable()
  await writable.write(content)
  await writable.close()

  const file = await handle.getFile()
  return file.lastModified
}

export async function saveFileAs(
  suggestedName: string,
  content: string
): Promise<{ handle: FileSystemFileHandle; file: File } | null> {
  if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
    return null
  }

  try {
    const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: MARKDOWN_PICKER_TYPES,
    })

    if (!handle) {
      return null
    }

    const writable = await (handle as any).createWritable()
    await writable.write(content)
    await writable.close()

    const file = await handle.getFile()
    return { handle, file }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function verifyHandlePermission(
  handle: FileSystemFileHandle,
  readWrite: boolean = true
): Promise<boolean> {
  const mode: 'readwrite' | 'read' = readWrite ? 'readwrite' : 'read'
  try {
    const queryResult = await (handle as any).queryPermission({ mode })
    if (queryResult === 'granted') {
      return true
    }

    const requestResult = await (handle as any).requestPermission({ mode })
    return requestResult === 'granted'
  } catch {
    return false
  }
}

export async function openLocalFileAsDoc(): Promise<{ docId: string; kept: boolean } | null> {
  const opened = await openLocalFile()
  if (!opened) return null
  const { handle, content } = opened
  let record = null as Awaited<ReturnType<typeof createRecord>> | null
  for (const r of await listRecent(100_000)) {
    if (!r.hasHandle) continue
    try {
      const h = await getHandle(r.docId)
      if (h && (await h.isSameEntry(handle))) {
        record = r
        break
      }
    } catch (err) {
      console.warn('Skipping unreadable handle for', r.docId, err)
    }
  }
  if (!record) {
    record = await createRecord({ title: handle.name, originKind: 'file', originPath: `file:${handle.name}` })
  }
  const result = await writeDocText(record, content, 'if-clean')
  await storeHandle(record.docId, handle)
  return { docId: record.docId, kept: result === 'kept' }
}
