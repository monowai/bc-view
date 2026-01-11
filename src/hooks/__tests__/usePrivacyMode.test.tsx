import React, { ReactNode } from "react"
import { renderHook, act } from "@testing-library/react"
import { usePrivacyMode, PrivacyModeProvider } from "../usePrivacyMode"

// Create a mock preferences value
let mockPreferences: { hideValues?: boolean } | null = null

// Mock the UserPreferencesContext module
jest.mock("../../contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: mockPreferences,
    isLoading: false,
    updatePreferences: jest.fn(),
  }),
}))

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {}
const sessionStorageMock = {
  getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockSessionStorage[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    delete mockSessionStorage[key]
  }),
  clear: jest.fn(() => {
    Object.keys(mockSessionStorage).forEach(
      (key) => delete mockSessionStorage[key],
    )
  }),
}

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
})

const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
  <PrivacyModeProvider>{children}</PrivacyModeProvider>
)

describe("usePrivacyMode", () => {
  beforeEach(() => {
    mockPreferences = null
    sessionStorageMock.clear()
    jest.clearAllMocks()
  })

  describe("default state", () => {
    it("returns hideValues as false when no preferences set", () => {
      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(false)
    })

    it("returns hideValues from preferences when set to true", () => {
      mockPreferences = { hideValues: true }

      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(true)
    })

    it("returns hideValues from preferences when set to false", () => {
      mockPreferences = { hideValues: false }

      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(false)
    })
  })

  describe("toggle behavior", () => {
    it("toggles from false to true", () => {
      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(false)

      act(() => {
        result.current.toggleHideValues()
      })

      expect(result.current.hideValues).toBe(true)
    })

    it("toggles from true to false", () => {
      mockPreferences = { hideValues: true }

      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(true)

      act(() => {
        result.current.toggleHideValues()
      })

      expect(result.current.hideValues).toBe(false)
    })

    it("toggles multiple times correctly", () => {
      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(false)

      act(() => {
        result.current.toggleHideValues()
      })
      expect(result.current.hideValues).toBe(true)

      act(() => {
        result.current.toggleHideValues()
      })
      expect(result.current.hideValues).toBe(false)

      act(() => {
        result.current.toggleHideValues()
      })
      expect(result.current.hideValues).toBe(true)
    })

    it("local override takes precedence over preferences", () => {
      mockPreferences = { hideValues: true }

      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      // Initially uses preference
      expect(result.current.hideValues).toBe(true)

      // Toggle to local override (false)
      act(() => {
        result.current.toggleHideValues()
      })

      expect(result.current.hideValues).toBe(false)

      // Toggle again to local override (true)
      act(() => {
        result.current.toggleHideValues()
      })

      expect(result.current.hideValues).toBe(true)
    })
  })

  describe("session storage persistence", () => {
    it("persists toggle state to sessionStorage", () => {
      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      act(() => {
        result.current.toggleHideValues()
      })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        "bc:hideValues",
        "true",
      )
    })

    it("reads initial state from sessionStorage", () => {
      mockSessionStorage["bc:hideValues"] = "true"

      const { result } = renderHook(() => usePrivacyMode(), { wrapper })

      expect(result.current.hideValues).toBe(true)
    })
  })

  describe("without provider", () => {
    it("returns default values when used outside provider", () => {
      const { result } = renderHook(() => usePrivacyMode())

      expect(result.current.hideValues).toBe(false)
      expect(typeof result.current.toggleHideValues).toBe("function")
    })
  })
})
