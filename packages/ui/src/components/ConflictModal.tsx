import React, { useEffect, useMemo } from 'react'
import { computeLineDiff } from '@md-reader/core'
import '../theme/conflict.css'

export interface ConflictModalProps {
  isOpen: boolean
  fileName: string
  localContent: string
  diskContent: string
  baseContent?: string
  onKeepLocal: () => void
  onRevertToDisk: () => void
  onClose: () => void
}

export interface SideBySideDiffLine {
  num: number | null
  text: string
  type: 'same' | 'added' | 'removed' | 'empty'
}

export function computeSideBySideDiff(diskText: string, localText: string): {
  localDiff: SideBySideDiffLine[]
  diskDiff: SideBySideDiffLine[]
} {
  const diffs = computeLineDiff(diskText, localText)
  const localDiff: SideBySideDiffLine[] = []
  const diskDiff: SideBySideDiffLine[] = []

  let diskNum = 1
  let localNum = 1

  for (const item of diffs) {
    if (item.type === 'same') {
      diskDiff.push({ num: diskNum++, text: item.text, type: 'same' })
      localDiff.push({ num: localNum++, text: item.text, type: 'same' })
    } else if (item.type === 'removed') {
      diskDiff.push({ num: diskNum++, text: item.text, type: 'removed' })
      localDiff.push({ num: null, text: '', type: 'empty' })
    } else if (item.type === 'added') {
      diskDiff.push({ num: null, text: '', type: 'empty' })
      localDiff.push({ num: localNum++, text: item.text, type: 'added' })
    }
  }

  return { localDiff, diskDiff }
}

export function ConflictModal({
  isOpen,
  fileName,
  localContent,
  diskContent,
  baseContent,
  onKeepLocal,
  onRevertToDisk,
  onClose,
}: ConflictModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const { localDiff, diskDiff } = useMemo(
    () => computeSideBySideDiff(diskContent, localContent),
    [diskContent, localContent]
  )

  const threeWay = useMemo(() => {
    if (baseContent === undefined) return null
    return {
      disk: computeLineDiff(baseContent, diskContent),
      mine: computeLineDiff(baseContent, localContent),
    }
  }, [baseContent, diskContent, localContent])

  if (!isOpen) return null

  const renderUnified = (title: string, diff: ReturnType<typeof computeLineDiff>) => {
    const added = diff.filter((d) => d.type === 'added').length
    const removed = diff.filter((d) => d.type === 'removed').length
    return (
      <div className="conflict-pane">
        <div className="conflict-pane-header">
          {title}{' '}
          <span className="conflict-diff-counts">{`+${added} −${removed}`}</span>
        </div>
        <div className="conflict-diff-content">
          {diff.map((line, idx) => (
            <div key={idx} className={`conflict-diff-line ${line.type}`}>
              <span className="conflict-diff-line-text">{line.text || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="conflict-modal-overlay" role="dialog" aria-modal="true">
      <div className="conflict-modal-container">
        <div className="conflict-modal-header">
          <h2>
            <span>⚠️</span>
            <span>Phát hiện xung đột tập tin ngoài đĩa</span>
          </h2>
          <span className="conflict-modal-filename">{fileName}</span>
        </div>

        <div className="conflict-modal-body">
          {threeWay ? (
            <>
              {renderUnified('Thay đổi trên đĩa', threeWay.disk)}
              {renderUnified('Thay đổi của bạn', threeWay.mine)}
            </>
          ) : (
            <>
          <div className="conflict-pane">
            <div className="conflict-pane-header">Bản sửa cục bộ</div>
            <div className="conflict-diff-content">
              {localDiff.map((line, idx) => (
                <div key={idx} className={`conflict-diff-line ${line.type}`}>
                  <span className="conflict-diff-line-number">
                    {line.num !== null ? line.num : ''}
                  </span>
                  <span className="conflict-diff-line-text">{line.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="conflict-pane">
            <div className="conflict-pane-header">Bản trên đĩa</div>
            <div className="conflict-diff-content">
              {diskDiff.map((line, idx) => (
                <div key={idx} className={`conflict-diff-line ${line.type}`}>
                  <span className="conflict-diff-line-number">
                    {line.num !== null ? line.num : ''}
                  </span>
                  <span className="conflict-diff-line-text">{line.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
        </div>

        <div className="conflict-modal-footer">
          <button
            type="button"
            className="conflict-btn conflict-btn-keep"
            onClick={onKeepLocal}
          >
            Giữ bản sửa của tôi (Ghi đè)
          </button>
          <button
            type="button"
            className="conflict-btn conflict-btn-revert"
            onClick={onRevertToDisk}
          >
            Tải lại từ đĩa (Bỏ thay đổi)
          </button>
          <button
            type="button"
            className="conflict-btn conflict-btn-close"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
