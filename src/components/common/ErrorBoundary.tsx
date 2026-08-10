import { Component, type ReactNode } from 'react'
import { WarningCircle } from '@phosphor-icons/react'

interface Props {
  children: ReactNode
  fallbackLabel?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{this.props.fallbackLabel ?? 'Something went wrong rendering this.'}</p>
            <p className="mt-0.5 text-xs opacity-80">{this.state.error.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
