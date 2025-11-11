import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ErrorOut from "../ErrorOut"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Mock next/router
const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe("ErrorOut Component (TDD)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Auto-Detection of Common Errors", () => {
    it("should auto-detect and display authentication errors", () => {
      const error = { response: { status: 401 } }

      render(<ErrorOut error={error} autoDetect={true} />)

      expect(screen.getByText("Authentication Required")).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /log in/i }),
      ).toBeInTheDocument()
      // Should not show retry for auth errors
      expect(
        screen.queryByRole("button", { name: /try again/i }),
      ).not.toBeInTheDocument()
    })

    it("should auto-detect and display backend unavailable errors", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" }

      render(<ErrorOut error={error} autoDetect={true} />)

      expect(screen.getByText("Service Unavailable")).toBeInTheDocument()
      expect(
        screen.getByText(/unable to connect to the backend service/i),
      ).toBeInTheDocument()
      // Should show retry for backend errors
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument()
    })

    it("should show suggested action for backend errors", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" }

      render(<ErrorOut error={error} autoDetect={true} />)

      expect(screen.getByText(/Tip:/i)).toBeInTheDocument()
      expect(
        screen.getByText(/backend service is running/i),
      ).toBeInTheDocument()
    })

    it("should show different icon for auth errors", () => {
      const error = { response: { status: 401 } }
      render(<ErrorOut error={error} autoDetect={true} />)

      const icon = screen.getByTestId("error-icon")
      expect(icon).toBeInTheDocument()
      // Auth icon should be yellow (lock icon)
      expect(icon).toHaveClass("text-yellow-500")
    })

    it("should show different icon for backend errors", () => {
      const error = { code: "ECONNREFUSED" }
      render(<ErrorOut error={error} autoDetect={true} />)

      const icon = screen.getByTestId("error-icon")
      expect(icon).toBeInTheDocument()
      // Backend icon should be orange (server icon)
      expect(icon).toHaveClass("text-orange-500")
    })
  })

  describe("Error Display", () => {
    it("should display user-friendly error message instead of raw JSON", () => {
      const error = new Error("Network request failed")
      const message = "Failed to load holdings"

      render(<ErrorOut message={message} error={error} />)

      // Should show user-friendly message
      expect(screen.getByText(message)).toBeInTheDocument()

      // Should NOT show raw JSON in main display
      const container = screen.getByRole("main")
      expect(container).not.toHaveTextContent(JSON.stringify(error))
    })

    it("should display error icon for better visual feedback", () => {
      const error = new Error("Test error")
      const message = "Something went wrong"

      render(<ErrorOut message={message} error={error} />)

      // Should have an error icon (could be SVG or font icon)
      const errorIcon = screen.getByTestId("error-icon")
      expect(errorIcon).toBeInTheDocument()
    })

    it("should show different error types with appropriate styling", () => {
      const error = new Error("Not found")

      const { container: container404 } = render(
        <ErrorOut message="Resource not found" error={error} type="404" />,
      )
      expect(container404).toHaveTextContent("404")

      const { container: container500 } = render(
        <ErrorOut message="Server error" error={error} type="500" />,
      )
      expect(container500).toHaveTextContent("500")
    })
  })

  describe("Action Buttons", () => {
    it("should provide a retry button with custom handler", () => {
      const error = new Error("Network timeout")
      const message = "Failed to load data"
      const onRetry = jest.fn()

      render(
        <ErrorOut
          message={message}
          error={error}
          showRetry={true}
          onRetry={onRetry}
        />,
      )

      const retryButton = screen.getByRole("button", {
        name: /retry|try again/i,
      })
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)

      // Should call the retry handler
      expect(onRetry).toHaveBeenCalled()
    })

    it("should provide a home button that navigates to homepage", () => {
      const error = new Error("Resource not found")
      const message = "Page not found"

      render(<ErrorOut message={message} error={error} showHome={true} />)

      const homeButton = screen.getByRole("button", { name: /home|go home/i })
      expect(homeButton).toBeInTheDocument()

      fireEvent.click(homeButton)

      // Should navigate to home
      expect(mockPush).toHaveBeenCalledWith("/")
    })

    it("should allow custom retry handler", () => {
      const error = new Error("Custom error")
      const message = "Custom error message"
      const customRetry = jest.fn()

      render(
        <ErrorOut
          message={message}
          error={error}
          showRetry={true}
          onRetry={customRetry}
        />,
      )

      const retryButton = screen.getByRole("button", {
        name: /retry|try again/i,
      })
      fireEvent.click(retryButton)

      // Should call custom retry handler
      expect(customRetry).toHaveBeenCalled()
    })
  })

  describe("Error Details Toggle", () => {
    it("should hide technical error details by default", () => {
      const error = new Error("Detailed error message")
      error.stack = "Error stack trace..."
      const message = "User-friendly message"

      render(<ErrorOut message={message} error={error} />)

      // Technical details should not be visible initially
      // The details toggle button should exist, but the details themselves should not
      expect(
        screen.getByRole("button", { name: /show technical details/i }),
      ).toBeInTheDocument()
      expect(screen.queryByText("Error stack trace...")).not.toBeInTheDocument()
    })

    it("should show technical details when toggle is clicked", () => {
      const error = new Error("Detailed error message")
      error.stack = "Error stack trace..."
      const message = "User-friendly message"

      render(<ErrorOut message={message} error={error} />)

      // Click the details toggle
      const detailsToggle = screen.getByRole("button", {
        name: /details|show details|technical/i,
      })
      fireEvent.click(detailsToggle)

      // Technical details should now be visible
      expect(screen.getByText("Detailed error message")).toBeVisible()
    })

    it("should not show details toggle in production mode", () => {
      // Temporarily override NODE_ENV
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        writable: true,
        configurable: true,
      })

      const error = new Error("Production error")
      const message = "Error occurred"

      render(<ErrorOut message={message} error={error} />)

      // Details toggle should not exist in production
      const detailsToggle = screen.queryByRole("button", {
        name: /details|show details|technical/i,
      })
      expect(detailsToggle).not.toBeInTheDocument()

      // Restore original env
      Object.defineProperty(process.env, "NODE_ENV", {
        value: originalEnv,
        writable: true,
        configurable: true,
      })
    })
  })

  describe("Responsive Design", () => {
    it("should be mobile-friendly with proper styling", () => {
      const error = new Error("Mobile error")
      const message = "Error on mobile"

      const { container } = render(<ErrorOut message={message} error={error} />)

      // Should have responsive container
      const mainContainer = container.querySelector("[role='main']")
      expect(mainContainer).toHaveClass(/min-h-screen|h-screen/)
      expect(mainContainer).toHaveClass(/flex|grid/)
    })
  })

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      const error = new Error("Accessibility test")
      const message = "Error message"

      render(<ErrorOut message={message} error={error} />)

      // Should have main role
      expect(screen.getByRole("main")).toBeInTheDocument()

      // Should have proper heading structure
      const heading = screen.getByRole("heading")
      expect(heading).toBeInTheDocument()
    })

    it("should have accessible error icon", () => {
      const error = new Error("Icon test")
      const message = "Error occurred"

      render(<ErrorOut message={message} error={error} />)

      const icon = screen.getByTestId("error-icon")
      expect(icon).toHaveAttribute("aria-hidden", "true")
    })
  })
})
