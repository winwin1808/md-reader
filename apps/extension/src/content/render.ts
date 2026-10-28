export interface PageRender {
  html: string
  title: string | null
}

/** Ask our own worker to render markdown. Resolves null on any failure or timeout. */
export function requestPageRender(markdown: string, timeoutMs = 4000, alertLang: 'vi' | 'en' = 'en'): Promise<PageRender | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: PageRender | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    try {
      if (!chrome.runtime?.sendMessage) return finish(null)
      const r: any = chrome.runtime.sendMessage({ action: 'renderMd', markdown, alertLang }, (res: any) => {
        if (chrome.runtime.lastError || !res || res.ok !== true || typeof res.html !== 'string') return finish(null)
        finish({ html: res.html, title: typeof res.title === 'string' ? res.title : null })
      })
      if (r && typeof r.catch === 'function') r.catch(() => finish(null))
    } catch {
      finish(null)
    }
  })
}
