import React from "react"
import { render, screen } from "@testing-library/react"
import StaleVersionBanner from "../StaleVersionBanner"
import { useBuildVersion } from "@hooks/useBuildVersion"

jest.mock("@hooks/useBuildVersion")
const mockUseBuildVersion = useBuildVersion as jest.MockedFunction<
  typeof useBuildVersion
>

describe("StaleVersionBanner", () => {
  beforeEach(() => {
    mockUseBuildVersion.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders nothing when build is fresh", () => {
    mockUseBuildVersion.mockReturnValue({
      info: { branch: "main", commit: "abc", build: "100" },
      initialBuild: "100",
      isStale: false,
    })
    const { container } = render(<StaleVersionBanner />)
    expect(container.firstChild).toBeNull()
  })

  it("renders banner with both build numbers when stale", () => {
    mockUseBuildVersion.mockReturnValue({
      info: { branch: "main", commit: "def", build: "101" },
      initialBuild: "100",
      isStale: true,
    })
    render(<StaleVersionBanner />)
    expect(screen.getByText(/New version available/i)).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
    expect(screen.getByText(/101/)).toBeInTheDocument()
  })

  it("exposes a Reload button when stale", () => {
    mockUseBuildVersion.mockReturnValue({
      info: { branch: "main", commit: "def", build: "101" },
      initialBuild: "100",
      isStale: true,
    })
    render(<StaleVersionBanner />)
    const button = screen.getByRole("button", { name: /reload/i })
    expect(button).toBeInTheDocument()
    // Wired to reloadPage helper (window.location.reload); the helper is
    // intentionally not exercised here — jsdom's location is read-only.
  })
})
