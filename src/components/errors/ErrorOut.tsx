import React, { ReactElement, useState } from "react"
import { useRouter } from "next/router"
import { detectErrorType, ErrorType } from "./errorDetector"

export interface ErrorOutProps {
  message?: string
  error: Error | any
  type?: ErrorType | "404" | "500" | "network" | "generic"
  showRetry?: boolean
  showHome?: boolean
  showLogin?: boolean
  onRetry?: () => void
  autoDetect?: boolean
  eventId?: string | null
}

// Backward compatibility: support old function signature errorOut(key: string, error: Error)
export function errorOut(key: string, error: Error): ReactElement {
  return <ErrorOut message={key} error={error} autoDetect={true} />
}

export default function ErrorOut({
  message,
  error,
  type,
  showRetry,
  showHome,
  showLogin,
  onRetry,
  autoDetect = true,
  eventId,
}: ErrorOutProps): ReactElement {
  const router = useRouter()
  const [showDetails, setShowDetails] = useState(false)
  const isProduction = process.env.NODE_ENV === "production"

  // Auto-detect error type if enabled
  const detectedError = autoDetect ? detectErrorType(error) : null
  const errorType = type || detectedError?.type || "generic"
  const errorTitle = detectedError?.title || "An Error Occurred"
  const errorMessage =
    message || detectedError?.message || "An unexpected error occurred"
  const suggestedAction = detectedError?.suggestedAction
  const canRetry =
    detectedError?.canRetry !== undefined ? detectedError.canRetry : true

  // Determine which buttons to show
  const shouldShowRetry = showRetry !== undefined ? showRetry : canRetry
  const shouldShowHome = showHome !== undefined ? showHome : true
  const shouldShowLogin =
    showLogin !== undefined ? showLogin : errorType === "auth"

  const handleRetry = (): void => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  const handleGoHome = (): void => {
    router.push("/")
  }

  const handleLogin = (): void => {
    router.push("/api/auth/login")
  }

  const getErrorIcon = (): ReactElement => {
    // Different icons for different error types
    if (errorType === "auth") {
      return (
        <svg
          data-testid="error-icon"
          aria-hidden="true"
          className="w-16 h-16 text-yellow-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )
    }

    if (errorType === "backend") {
      return (
        <svg
          data-testid="error-icon"
          aria-hidden="true"
          className="w-16 h-16 text-orange-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      )
    }

    // Default error icon (red)
    return (
      <svg
        data-testid="error-icon"
        aria-hidden="true"
        className="w-16 h-16 text-red-500 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    )
  }

  const getStatusCode = (): string | null => {
    switch (errorType) {
      case "404":
        return "404"
      case "500":
        return "500"
      default:
        return null
    }
  }

  const getErrorTypeDisplay = (): string => {
    switch (errorType) {
      case "auth":
        return errorTitle
      case "backend":
        return errorTitle
      case "404":
        return "Page Not Found"
      case "500":
        return "Server Error"
      case "network":
        return "Network Error"
      default:
        return "Oops! Something went wrong"
    }
  }

  return (
    <main
      role="main"
      className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-12"
    >
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">{getErrorIcon()}</div>

        {/* Status Code */}
        {getStatusCode() && (
          <h1 className="text-6xl font-bold text-gray-800 mb-4">
            {getStatusCode()}
          </h1>
        )}

        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {getErrorTypeDisplay()}
        </h2>

        {/* User-Friendly Message */}
        <p className="text-gray-600 mb-4">{errorMessage}</p>

        {/* Suggested Action */}
        {suggestedAction && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
            <strong>💡 Tip:</strong> {suggestedAction}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          {shouldShowLogin && (
            <button
              onClick={handleLogin}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Log In
            </button>
          )}
          {shouldShowRetry && !shouldShowLogin && (
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Try Again
            </button>
          )}
          {shouldShowHome && (
            <button
              onClick={handleGoHome}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Go Home
            </button>
          )}
        </div>

        {/* Technical Details Toggle (Only in Development) */}
        {!isProduction && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showDetails ? "Hide" : "Show"} Technical Details
            </button>

            {showDetails && (
              <div className="mt-4 text-left bg-gray-100 rounded p-4">
                <div className="text-sm mb-2">
                  <strong className="text-gray-700">Error:</strong>
                  <p className="text-gray-600 font-mono text-xs mt-1">
                    {error.message}
                  </p>
                </div>

                {error.stack && (
                  <div className="text-sm">
                    <strong className="text-gray-700">Stack Trace:</strong>
                    <pre className="text-gray-600 font-mono text-xs mt-1 overflow-x-auto whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Support Message with Event ID */}
        <div className="text-xs text-gray-500 mt-4">
          <p>If this problem persists, please contact support</p>
          {eventId && (
            <p className="mt-2 font-mono text-gray-400">Reference: {eventId}</p>
          )}
        </div>
      </div>
    </main>
  )
}
