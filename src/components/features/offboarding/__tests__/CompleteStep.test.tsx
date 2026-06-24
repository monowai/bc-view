import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CompleteStep from "../steps/CompleteStep"
import { OffboardingResult } from "types/beancounter"
import { forceLogout } from "@utils/offboarding"

// next/link mocked globally in jest.setup.js
jest.mock("@utils/offboarding")

const mockForceLogout = forceLogout as jest.Mock

describe("CompleteStep", () => {
  const mockResults: OffboardingResult[] = [
    { success: true, deletedCount: 3, type: "portfolios" },
    { success: true, deletedCount: 2, type: "assets" },
  ]

  beforeEach(() => {
    mockForceLogout.mockClear()
  })

  it("renders completion title", () => {
    render(<CompleteStep results={mockResults} accountDeleted={false} />)

    expect(screen.getByText("Deletion Complete")).toBeInTheDocument()
  })

  it("displays deletion results for each type", () => {
    render(<CompleteStep results={mockResults} accountDeleted={false} />)

    expect(screen.getByText("portfolios")).toBeInTheDocument()
    expect(screen.getByText("assets")).toBeInTheDocument()
    expect(screen.getByText("3 deleted")).toBeInTheDocument()
    expect(screen.getByText("2 deleted")).toBeInTheDocument()
  })

  it("shows logout button when account is deleted", () => {
    render(<CompleteStep results={mockResults} accountDeleted={true} />)

    expect(screen.getByText("Log Out Now")).toBeInTheDocument()
    expect(screen.getByText(/Your account has been closed/)).toBeInTheDocument()
  })

  it("forces logout shortly after the account is closed", () => {
    jest.useFakeTimers()
    render(<CompleteStep results={mockResults} accountDeleted={true} />)

    expect(mockForceLogout).not.toHaveBeenCalled()
    jest.advanceTimersByTime(3000)
    expect(mockForceLogout).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  it("does not force logout when the account was not closed", () => {
    jest.useFakeTimers()
    render(<CompleteStep results={mockResults} accountDeleted={false} />)

    jest.advanceTimersByTime(5000)
    expect(mockForceLogout).not.toHaveBeenCalled()

    jest.useRealTimers()
  })

  it("shows return home button when account is not deleted", () => {
    render(<CompleteStep results={mockResults} accountDeleted={false} />)

    expect(screen.getByText("Return Home")).toBeInTheDocument()
  })

  it("handles empty results", () => {
    render(<CompleteStep results={[]} accountDeleted={false} />)

    expect(screen.getByText("Deletion Complete")).toBeInTheDocument()
    expect(screen.getByText("Return Home")).toBeInTheDocument()
  })
})
