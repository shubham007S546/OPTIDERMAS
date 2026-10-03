'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // We do not send crash telemetry to external servers to preserve zero data tracking
    if (process.env.NODE_ENV === 'development') {
      console.error('OptiDerma caught error:', error, errorInfo)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="p-6 my-6 rounded-2xl border border-destructive/40 bg-destructive/10 text-foreground space-y-4 max-w-xl mx-auto"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/20 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {this.props.fallbackTitle || 'Component Encountered an Unexpected State'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The application prevented a full crash. No sensitive data was transmitted.
              </p>
            </div>
          </div>

          {this.state.error?.message && (
            <pre className="p-3 rounded-lg bg-black/10 dark:bg-black/40 text-[11px] font-mono text-muted-foreground overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
