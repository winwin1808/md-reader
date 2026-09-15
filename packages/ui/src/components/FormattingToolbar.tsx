import React from 'react'
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
    { action: 'bold', title: 'Bold', label: <strong>B</strong> },
    { action: 'italic', title: 'Italic', label: <em>I</em> },
    { action: 'strike', title: 'Strikethrough', label: <span style={{ textDecoration: 'line-through' }}>S</span> },
    { action: 'code', title: 'Inline Code', label: <code>&lt;/&gt;</code> },
    { action: 'math', title: 'Math', label: <span>&Sigma;</span> },
  ],
  [
    { action: 'h1', title: 'Heading 1', label: <span>H1</span> },
    { action: 'h2', title: 'Heading 2', label: <span>H2</span> },
    { action: 'h3', title: 'Heading 3', label: <span>H3</span> },
  ],
  [
    { action: 'bullet', title: 'Bullet List', label: <span>&bull;</span> },
    { action: 'number', title: 'Numbered List', label: <span>1.</span> },
    { action: 'task', title: 'Task List', label: <span>&#x2611;</span> },
    { action: 'quote', title: 'Quote', label: <span>&ldquo;</span> },
  ],
  [
    { action: 'link', title: 'Link', label: <span>&#x1F517;</span> },
    { action: 'codeblock', title: 'Code Block', label: <span>{'{ }'}</span> },
    { action: 'table', title: 'Table', label: <span>&#x229E;</span> },
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
  return (
    <div
      className={`md-formatting-toolbar ${className}`.trim()}
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      {(onUndo || onRedo) && (
        <div className="toolbar-group toolbar-history-group">
          <button
            type="button"
            className="toolbar-btn"
            title="Undo"
            aria-label="Undo"
            data-action="undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            &#x21B6;
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Redo"
            aria-label="Redo"
            data-action="redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            &#x21B7;
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
