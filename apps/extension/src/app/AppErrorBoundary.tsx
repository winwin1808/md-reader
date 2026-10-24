import React from 'react'

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error(error)
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div role="alert" className="app-error-boundary">
          <h1>Có lỗi khi hiển thị tài liệu.</h1>
          <pre>{error.message}</pre>
          <button onClick={() => location.reload()}>Tải lại</button>
        </div>
      )
    }
    return this.props.children
  }
}
