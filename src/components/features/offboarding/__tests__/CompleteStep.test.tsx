import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CompleteStep from "../steps/CompleteStep"
import { OffboardingResult } from "types/beancounter"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "complete.title": "Deletion Complete",
        "complete.description": "The selected data has been removed.",
        "complete.deleted": "deleted",
        "complete.accountDeleted": "Your account has been deleted.",
        "complete.logout": "Log Out",
        "complete.returnHome": "Return Home",
      }
      return translations[key] || key
    },
  }),
}))

// Mock next/link
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }): React.ReactElement => <a href={href}>{children}</a>
  MockLink.displayName = "MockLink"
  return MockLink
})

describe("CompleteStep", () => {
  const mockResults: OffboardingResult[] = [
    { success: true, deletedCount: 3, type: "portfolios" },
    { success: true, deletedCount: 2, type: "assets" },
  ]

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

    expect(screen.getByText("Log Out")).toBeInTheDocument()
    expect(
      screen.getByText("Your account has been deleted."),
    ).toBeInTheDocument()
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
