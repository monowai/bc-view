/**
 * Error detection utilities to identify common error scenarios
 */

export type ErrorType =
  | "auth"
  | "backend"
  | "network"
  | "404"
  | "500"
  | "generic"

export interface DetectedError {
  type: ErrorType
  title: string
  message: string
  canRetry: boolean
  suggestedAction?: string
}

/**
 * Extract HTTP status code from various error object structures
 */
function getStatusCode(error: Error | any): number | undefined {
  // Check multiple possible locations for status code
  return (
    error?.response?.status ||
    error?.status ||
    error?.statusCode ||
    error?.response?.statusCode ||
    undefined
  )
}

/**
 * Detect if error is authentication-related
 * ONLY returns true for 401/403 status codes
 */
export function isAuthError(error: Error | any): boolean {
  const errorStatus = getStatusCode(error)

  // ONLY 401 and 403 are auth errors
  // Do NOT check message content for auth errors to prevent false positives
  return errorStatus === 401 || errorStatus === 403
}

/**
 * Detect if backend service is not started/unavailable
 */
export function isBackendError(error: Error | any): boolean {
  const errorMessage = error?.message?.toLowerCase() || ""
  const errorStatus = getStatusCode(error)
  const errorCode = error?.code?.toLowerCase() || ""

  // Don't treat auth status codes as backend errors, even if there are connection issues
  if (errorStatus === 401 || errorStatus === 403) {
    return false
  }

  // Don't treat 500 as backend error - that's a server error
  // Backend errors are 502, 503, 504 (proxy/gateway errors)
  if (errorStatus === 500) {
    return false
  }

  // Check for common backend unavailable patterns
  return (
    errorStatus === 503 ||
    errorStatus === 502 ||
    errorStatus === 504 ||
    errorCode === "econnrefused" ||
    errorCode === "enotfound" ||
    errorCode === "etimedout" ||
    errorMessage.includes("network error") ||
    errorMessage.includes("failed to fetch") ||
    errorMessage.includes("service unavailable") ||
    errorMessage.includes("connection refused") ||
    errorMessage.includes("cannot connect") ||
    errorMessage.includes("backend") ||
    (errorMessage.includes("timeout") && !errorMessage.includes("auth"))
  )
}

/**
 * Detect if error is a 404 Not Found
 */
export function is404Error(error: Error | any): boolean {
  const errorStatus = getStatusCode(error)
  return errorStatus === 404
}

/**
 * Detect if error is a 500 Server Error
 */
export function is500Error(error: Error | any): boolean {
  const errorStatus = getStatusCode(error)
  return errorStatus === 500
}

/**
 * Main error detector that categorizes errors
 * Priority: HTTP Status Codes > Error Codes > Message Content
 */
export function detectErrorType(error: Error | any): DetectedError {
  // Log error for debugging (development only)
  if (process.env.NODE_ENV === "development") {
    console.log("[ErrorDetector] Analyzing error:", {
      status: getStatusCode(error),
      message: error?.message,
      code: error?.code,
      error,
    })
  }

  // Check HTTP status codes FIRST (before checking message content)
  // This prevents 500 errors with "auth" in message from being misclassified

  // Check for 401/403 authentication errors (MOST SPECIFIC)
  if (isAuthError(error)) {
    return {
      type: "auth",
      title: "Authentication Required",
      message:
        "Your session has expired or you need to log in. Please authenticate to continue.",
      canRetry: false,
      suggestedAction: "Please log in again to continue using the application.",
    }
  }

  // Check for 404
  if (is404Error(error)) {
    return {
      type: "404",
      title: "Not Found",
      message: "The requested resource could not be found.",
      canRetry: false,
    }
  }

  // Check for 500 (before backend errors, since 500 is more specific than generic backend)
  if (is500Error(error)) {
    return {
      type: "500",
      title: "Server Error",
      message:
        "An internal server error occurred. The backend service may be experiencing issues.",
      canRetry: true,
      suggestedAction:
        "Please check if the backend service is running and try again. If the problem persists, contact your system administrator.",
    }
  }

  // Check backend availability (includes 503, 502, 504, ECONNREFUSED)
  if (isBackendError(error)) {
    return {
      type: "backend",
      title: "Service Unavailable",
      message:
        "Unable to connect to the backend service. The server may be offline or experiencing issues.",
      canRetry: true,
      suggestedAction:
        "Please ensure the backend service is running. Try starting it with 'yarn start' or contact your system administrator.",
    }
  }

  // Network errors (general)
  const errorMessage = error?.message?.toLowerCase() || ""
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection")
  ) {
    return {
      type: "network",
      title: "Network Error",
      message:
        "Unable to connect to the server. Please check your internet connection.",
      canRetry: true,
    }
  }

  // Generic error fallback
  return {
    type: "generic",
    title: "An Error Occurred",
    message:
      error?.message || "An unexpected error occurred. Please try again.",
    canRetry: true,
  }
}
