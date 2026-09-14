const DB_NAME = 'md_reader_fs'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const KEY = 'active_file'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(handle, KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(KEY)

    request.onsuccess = () => {
      resolve(request.result ?? null)
    }
    request.onerror = () => reject(request.error)
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearStoredFileHandle(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.onerror = () => reject(tx.error)
  })
}
