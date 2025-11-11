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
}

/**
 * React Error Boundary to catch rendering errors
 * Integrates with Sentry for error reporting
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", error, errorInfo)
    }

    // Report to Sentry in production
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
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
          onRetry={() => {
            // Reset error boundary state and reload
            this.setState({ hasError: false, error: null })
            window.location.reload()
          }}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
