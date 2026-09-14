import React, { useEffect, useMemo } from 'react'
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

export interface DiffLine {
  num: number | null
  text: string
  type: 'same' | 'added' | 'removed' | 'empty'
}

export function computeSideBySideDiff(diskText: string, localText: string): {
  localDiff: DiffLine[]
  diskDiff: DiffLine[]
} {
  const diskLines = diskText.split('\n')
  const localLines = localText.split('\n')

  const m = diskLines.length
  const n = localLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))

  for (let i = 0; i < m; i++) {
    const diskLine = diskLines[i] ?? ''
    const rowPrev = dp[i] ?? []
    const rowCurr = dp[i + 1] ?? []
    for (let j = 0; j < n; j++) {
      const localLine = localLines[j] ?? ''
      if (diskLine === localLine) {
        rowCurr[j + 1] = (rowPrev[j] ?? 0) + 1
      } else {
        rowCurr[j + 1] = Math.max(rowCurr[j] ?? 0, rowPrev[j + 1] ?? 0)
      }
    }
  }

  let i = m
  let j = n
  const aligned: {
    disk: { num: number; text: string; type: 'same' | 'removed' } | null
    local: { num: number; text: string; type: 'same' | 'added' } | null
  }[] = []

  while (i > 0 || j > 0) {
    const diskLine = (i > 0 ? diskLines[i - 1] : undefined) ?? ''
    const localLine = (j > 0 ? localLines[j - 1] : undefined) ?? ''
    const prevDiskVal = i > 0 && j > 0 ? (dp[i - 1]?.[j] ?? 0) : 0
    const prevLocalVal = i > 0 && j > 0 ? (dp[i]?.[j - 1] ?? 0) : 0

    if (i > 0 && j > 0 && diskLine === localLine) {
      aligned.push({
        disk: { num: i, text: diskLine, type: 'same' },
        local: { num: j, text: localLine, type: 'same' },
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || prevLocalVal >= prevDiskVal)) {
      aligned.push({
        disk: null,
        local: { num: j, text: localLine, type: 'added' },
      })
      j--
    } else if (i > 0 && (j === 0 || prevLocalVal < prevDiskVal)) {
      aligned.push({
        disk: { num: i, text: diskLine, type: 'removed' },
        local: null,
      })
      i--
    }
  }

  aligned.reverse()

  const localDiff: DiffLine[] = []
  const diskDiff: DiffLine[] = []

  for (const row of aligned) {
    if (row.local) {
      localDiff.push({
        num: row.local.num,
        text: row.local.text,
        type: row.local.type,
      })
    } else {
      localDiff.push({
        num: null,
        text: '',
        type: 'empty',
      })
    }

    if (row.disk) {
      diskDiff.push({
        num: row.disk.num,
        text: row.disk.text,
        type: row.disk.type,
      })
    } else {
      diskDiff.push({
        num: null,
        text: '',
        type: 'empty',
      })
    }
  }

  return { localDiff, diskDiff }
}

export function ConflictModal({
  isOpen,
  fileName,
  localContent,
  diskContent,
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

  if (!isOpen) return null

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
