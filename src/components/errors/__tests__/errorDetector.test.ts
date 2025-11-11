import {
  isAuthError,
  isBackendError,
  is404Error,
  is500Error,
  detectErrorType,
} from "../errorDetector"

describe("Error Detector (TDD)", () => {
  describe("Authentication Error Detection", () => {
    it("should detect 401 status as auth error", () => {
      const error = { response: { status: 401 } }
      expect(isAuthError(error)).toBe(true)
    })

    it("should detect 403 status as auth error", () => {
      const error = { response: { status: 403 } }
      expect(isAuthError(error)).toBe(true)
    })

    it("should detect 401 in status field (not nested)", () => {
      const error = { status: 401 }
      expect(isAuthError(error)).toBe(true)
    })

    it("should detect 401 in statusCode field", () => {
      const error = { statusCode: 401 }
      expect(isAuthError(error)).toBe(true)
    })

    it("should NOT detect auth based on message content alone", () => {
      // Without 401/403 status, message content should not trigger auth error
      const error = new Error("Unauthorized access")
      expect(isAuthError(error)).toBe(false)
    })

    it("should NOT detect error with 'authentication' in message as auth error if status is 500", () => {
      const error = { status: 500, message: "Authentication failed" }
      expect(isAuthError(error)).toBe(false)
    })

    it("should NOT detect 'auth0' message as auth error without 401/403", () => {
      const error = new Error("Auth0 token expired")
      expect(isAuthError(error)).toBe(false)
    })

    it("should not detect network error as auth error", () => {
      const error = new Error("Network connection failed")
      expect(isAuthError(error)).toBe(false)
    })
  })

  describe("Backend Unavailable Error Detection", () => {
    it("should detect 503 status as backend error", () => {
      const error = { response: { status: 503 } }
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect 502 status as backend error", () => {
      const error = { response: { status: 502 } }
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect ECONNREFUSED as backend error", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" }
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect ETIMEDOUT as backend error", () => {
      const error = { code: "ETIMEDOUT", message: "Timeout" }
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect 'failed to fetch' as backend error", () => {
      const error = new Error("Failed to fetch")
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect 'service unavailable' as backend error", () => {
      const error = new Error("Service unavailable")
      expect(isBackendError(error)).toBe(true)
    })

    it("should detect 'backend' in message as backend error", () => {
      const error = new Error("Cannot connect to backend")
      expect(isBackendError(error)).toBe(true)
    })

    it("should not detect auth timeout as backend error", () => {
      const error = new Error("Auth timeout occurred")
      // This should be caught by auth detector first
      expect(isBackendError(error)).toBe(false)
    })
  })

  describe("404 Error Detection", () => {
    it("should detect 404 status", () => {
      const error = { response: { status: 404 } }
      expect(is404Error(error)).toBe(true)
    })

    it("should not detect 500 as 404", () => {
      const error = { response: { status: 500 } }
      expect(is404Error(error)).toBe(false)
    })
  })

  describe("500 Error Detection", () => {
    it("should detect 500 status", () => {
      const error = { response: { status: 500 } }
      expect(is500Error(error)).toBe(true)
    })

    it("should not detect 404 as 500", () => {
      const error = { response: { status: 404 } }
      expect(is500Error(error)).toBe(false)
    })
  })

  describe("Error Type Detection", () => {
    it("should detect 500 error as server error, not auth error", () => {
      // Bug reproduction: 500 errors should be server errors, not auth
      const error = {
        response: { status: 500 },
        message: "Internal Server Error",
      }
      const result = detectErrorType(error)

      expect(result.type).toBe("500")
      expect(result.type).not.toBe("auth")
      expect(result.title).toBe("Server Error")
      expect(result.canRetry).toBe(true)
    })

    it("should detect 503 from stopped backend as backend error, not auth", () => {
      // When backend service is stopped, we get 503
      const error = {
        response: { status: 503 },
        message: "Service Unavailable",
      }
      const result = detectErrorType(error)

      expect(result.type).toBe("backend")
      expect(result.type).not.toBe("auth")
      expect(result.title).toBe("Service Unavailable")
      expect(result.canRetry).toBe(true)
    })

    it("should detect and categorize auth error with proper details", () => {
      const error = { response: { status: 401 } }
      const result = detectErrorType(error)

      expect(result.type).toBe("auth")
      expect(result.title).toBe("Authentication Required")
      expect(result.canRetry).toBe(false)
      expect(result.suggestedAction).toContain("log in")
    })

    it("should detect and categorize backend error with proper details", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" }
      const result = detectErrorType(error)

      expect(result.type).toBe("backend")
      expect(result.title).toBe("Service Unavailable")
      expect(result.canRetry).toBe(true)
      expect(result.suggestedAction).toContain("backend service")
    })

    it("should detect and categorize 404 error", () => {
      const error = { response: { status: 404 } }
      const result = detectErrorType(error)

      expect(result.type).toBe("404")
      expect(result.title).toBe("Not Found")
      expect(result.canRetry).toBe(false)
    })

    it("should detect and categorize 500 error", () => {
      const error = { response: { status: 500 } }
      const result = detectErrorType(error)

      expect(result.type).toBe("500")
      expect(result.title).toBe("Server Error")
      expect(result.canRetry).toBe(true)
    })

    it("should detect network errors", () => {
      const error = new Error("Network request failed")
      const result = detectErrorType(error)

      expect(result.type).toBe("network")
      expect(result.title).toBe("Network Error")
      expect(result.canRetry).toBe(true)
    })

    it("should handle generic errors", () => {
      const error = new Error("Something weird happened")
      const result = detectErrorType(error)

      expect(result.type).toBe("generic")
      expect(result.title).toBe("An Error Occurred")
      expect(result.canRetry).toBe(true)
    })

    it("should prioritize HTTP status codes over error message content", () => {
      // 500 error with "auth" in the message should still be detected as 500
      const error = {
        response: { status: 500 },
        message: "Authentication service is currently unavailable",
      }
      const result = detectErrorType(error)

      // Should be 500, not auth (status code takes priority)
      expect(result.type).toBe("500")
      expect(result.type).not.toBe("auth")
    })

    it("should only treat 401/403 as auth errors, not other statuses with auth text", () => {
      // 500 error should be server error even if auth service is down
      const error = {
        status: 500,
        message: "Auth0 service unavailable",
      }
      const result = detectErrorType(error)

      expect(result.type).toBe("500")
      expect(result.type).not.toBe("auth")
    })

    it("should prioritize auth errors only for 401/403 status codes", () => {
      // Error could be interpreted as both auth and backend
      const error = {
        response: { status: 401 },
        code: "ECONNREFUSED",
      }
      const result = detectErrorType(error)

      // Auth should take priority for 401/403
      expect(result.type).toBe("auth")
    })
  })
})
