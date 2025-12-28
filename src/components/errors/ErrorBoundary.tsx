import React, { Component, ReactNode } from "react"
import * as Sentry from "@sentry/nextjs"
import ErrorOut from "./ErrorOut"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  eventId: string | null
}

/**
 * React Error Boundary to catch rendering errors
 * Integrates with Sentry for error reporting
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, eventId: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Get trace context before capturing
    const span = Sentry.getActiveSpan()
    const traceId = span ? Sentry.spanToTraceHeader(span).split("-")[0] : null
    const spanId = span ? Sentry.spanToTraceHeader(span).split("-")[1] : null

    // Log error with trace context
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", error, errorInfo)
      if (traceId) {
        console.error(`[Sentry] traceId: ${traceId}, spanId: ${spanId}`)
      }
    }

    // Report to Sentry and capture the event ID
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
        trace:
          traceId && spanId
            ? {
                trace_id: traceId,
                span_id: spanId,
              }
            : undefined,
      },
    })

    // Store event ID for display
    this.setState({ eventId })

    // Log event ID for support
    console.error(`[Sentry] Error reported with eventId: ${eventId}`)
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Use default error page
      return (
        <ErrorOut
          error={this.state.error}
          message="A rendering error occurred. The application encountered an unexpected problem."
          autoDetect={true}
          eventId={this.state.eventId}
          onRetry={() => {
            // Reset error boundary state and reload
            this.setState({ hasError: false, error: null, eventId: null })
            window.location.reload()
          }}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
