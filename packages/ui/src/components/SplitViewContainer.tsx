import React, { useRef, useEffect, useCallback } from 'react'

export type ViewMode = 'reading' | 'editor' | 'split'

export interface SplitViewContainerProps {
  mode: ViewMode
  editor: React.ReactNode
  preview: React.ReactNode
  onSyncScroll?: (source: 'editor' | 'preview', ratio: number) => void
  className?: string
}

export function SplitViewContainer(props: SplitViewContainerProps): React.JSX.Element {
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const syncingTargetRef = useRef<'editor' | 'preview' | null>(null)
  const activeSourceRef = useRef<'editor' | 'preview' | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const rafResetIdRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      if (rafResetIdRef.current) cancelAnimationFrame(rafResetIdRef.current)
    }
  }, [])

  const handleScroll = useCallback(
    (source: 'editor' | 'preview') => {
      if (props.mode !== 'split') return
      if (syncingTargetRef.current === source) {
        syncingTargetRef.current = null
        return
      }

      const sourcePane = source === 'editor' ? editorPaneRef.current : previewPaneRef.current
      const targetPane = source === 'editor' ? previewPaneRef.current : editorPaneRef.current

      if (!sourcePane || !targetPane) return

      const isSourceHovered =
        activeSourceRef.current === source ||
        Boolean(sourcePane.matches?.(':hover')) ||
        (!activeSourceRef.current && !targetPane.matches?.(':hover'))

      if (!isSourceHovered) return

      const sourceMaxScroll = Math.max(1, sourcePane.scrollHeight - sourcePane.clientHeight)
      const ratio = Math.max(0, Math.min(1, sourcePane.scrollTop / sourceMaxScroll))

      props.onSyncScroll?.(source, ratio)

      const target = source === 'editor' ? 'preview' : 'editor'
      syncingTargetRef.current = target

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      if (rafResetIdRef.current) cancelAnimationFrame(rafResetIdRef.current)

      rafIdRef.current = requestAnimationFrame(() => {
        const targetMaxScroll = Math.max(0, targetPane.scrollHeight - targetPane.clientHeight)
        targetPane.scrollTop = ratio * targetMaxScroll

        rafResetIdRef.current = requestAnimationFrame(() => {
          syncingTargetRef.current = null
          rafResetIdRef.current = null
        })
        rafIdRef.current = null
      })
    },
    [props.mode, props.onSyncScroll]
  )

  const containerClassName = [
    'split-view-container',
    `mode-${props.mode}`,
    props.className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName} data-testid="split-view-container">
      {(props.mode === 'editor' || props.mode === 'split') && (
        <div
          ref={editorPaneRef}
          className="split-view-pane split-view-pane-editor"
          data-testid="split-view-editor-pane"
          onMouseEnter={() => {
            activeSourceRef.current = 'editor'
          }}
          onMouseLeave={() => {
            if (activeSourceRef.current === 'editor') {
              activeSourceRef.current = null
            }
          }}
          onScroll={() => handleScroll('editor')}
        >
          {props.editor}
        </div>
      )}

      {(props.mode === 'reading' || props.mode === 'split') && (
        <div
          ref={previewPaneRef}
          className="split-view-pane split-view-pane-preview"
          data-testid="split-view-preview-pane"
          onMouseEnter={() => {
            activeSourceRef.current = 'preview'
          }}
          onMouseLeave={() => {
            if (activeSourceRef.current === 'preview') {
              activeSourceRef.current = null
            }
          }}
          onScroll={() => handleScroll('preview')}
        >
          {props.preview}
        </div>
      )}
    </div>
  )
}
