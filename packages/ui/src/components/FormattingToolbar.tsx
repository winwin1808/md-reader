import React, { useRef, useState } from 'react'
import { Icon } from './Icon'
import '../theme/formatting-toolbar.css'

export type FormatAction =
  | 'bold' | 'italic' | 'strike'
  | 'h1' | 'h2' | 'h3'
  | 'bullet' | 'number' | 'task'
  | 'quote' | 'code' | 'codeblock'
  | 'math' | 'link' | 'table'

export interface FormattingToolbarProps {
  onAction: (action: FormatAction) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  className?: string
}

interface ActionButtonDef {
  action: FormatAction
  title: string
  label: React.ReactNode
}

const ACTION_GROUPS: ActionButtonDef[][] = [
  [
    { action: 'bold', title: 'Đậm (⌘B)', label: <strong>B</strong> },
    { action: 'italic', title: 'Nghiêng (⌘I)', label: <em>I</em> },
    { action: 'strike', title: 'Gạch ngang', label: <span style={{ textDecoration: 'line-through' }}>S</span> },
    { action: 'code', title: 'Mã trong dòng', label: <span>`</span> },
    { action: 'math', title: 'Công thức', label: <span>&Sigma;</span> },
  ],
  [
    { action: 'h1', title: 'Tiêu đề 1', label: <span>H1</span> },
    { action: 'h2', title: 'Tiêu đề 2', label: <span>H2</span> },
    { action: 'h3', title: 'Tiêu đề 3', label: <span>H3</span> },
  ],
  [
    { action: 'bullet', title: 'Danh sách', label: <Icon name="toc" size={16} /> },
    { action: 'number', title: 'Danh sách số', label: <span>1.</span> },
    { action: 'task', title: 'Danh sách việc', label: <Icon name="check" size={16} /> },
    { action: 'quote', title: 'Trích dẫn', label: <span>&ldquo;&rdquo;</span> },
  ],
  [
    { action: 'link', title: 'Liên kết (⌘K)', label: <span>[ ]</span> },
    { action: 'codeblock', title: 'Khối mã', label: <span>```</span> },
    { action: 'table', title: 'Bảng', label: <span>|||</span> },
  ],
]

export function FormattingToolbar({
  onAction,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  className = '',
}: FormattingToolbarProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const enabledKeys: string[] = []
  if (onUndo || onRedo) {
    if (canUndo) enabledKeys.push('undo')
    if (canRedo) enabledKeys.push('redo')
  }
  ACTION_GROUPS.forEach((g) => g.forEach((b) => enabledKeys.push(b.action)))
  const current: string = activeKey && enabledKeys.includes(activeKey) ? activeKey : (enabledKeys[0] ?? '')
  const tab = (key: string) => (key === current ? 0 : -1)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = enabledKeys.indexOf(current)
    const n = enabledKeys.length
    const next = enabledKeys[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n] ?? current
    e.preventDefault()
    setActiveKey(next)
    ref.current?.querySelector<HTMLButtonElement>(`[data-action="${next}"]`)?.focus()
  }

  return (
    <div
      ref={ref}
      className={`md-formatting-toolbar ${className}`.trim()}
      role="toolbar"
      aria-label="Định dạng"
      onKeyDown={onKeyDown}
    >
      {(onUndo || onRedo) && (
        <div className="toolbar-group toolbar-history-group">
          <button
            type="button"
            className="toolbar-btn"
            title="Hoàn tác (⌘Z)"
            aria-label="Hoàn tác (⌘Z)"
            data-action="undo"
            tabIndex={tab('undo')}
            disabled={!canUndo}
            onFocus={() => setActiveKey('undo')}
            onClick={onUndo}
          >
            <Icon name="undo" size={16} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Làm lại (⇧⌘Z)"
            aria-label="Làm lại (⇧⌘Z)"
            data-action="redo"
            tabIndex={tab('redo')}
            disabled={!canRedo}
            onFocus={() => setActiveKey('redo')}
            onClick={onRedo}
          >
            <Icon name="redo" size={16} />
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
        </div>
      )}

      {ACTION_GROUPS.map((group, groupIdx) => (
        <React.Fragment key={groupIdx}>
          <div className="toolbar-group">
            {group.map((btn) => (
              <button
                key={btn.action}
                type="button"
                className="toolbar-btn"
                title={btn.title}
                aria-label={btn.title}
                data-action={btn.action}
                tabIndex={tab(btn.action)}
                onFocus={() => setActiveKey(btn.action)}
                onClick={() => onAction(btn.action)}
              >
                {btn.label}
              </button>
            ))}
          </div>
          {groupIdx < ACTION_GROUPS.length - 1 && (
            <span className="toolbar-divider" aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
