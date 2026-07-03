import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceMetrics from "@components/features/wealth/IndependenceMetrics"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined })),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("@utils/api/fetchHelper", () => ({
  simpleFetcher: () => jest.fn(),
}))

jest.mock("@utils/independence/headlineGauge", () => ({
  pickHeadlineGauge: () => ({
    label: "FI Progress",
    display: "42%",
    fillPercent: 42,
    byline: "42% of the way",
  }),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}))

const props = {
  primaryPlan: {
    id: "plan1",
    workingIncomeMonthly: 5000,
    bonusMonthly: 0,
    workingExpensesMonthly: 3000,
    taxesMonthly: 1000,
    investmentAllocationPercent: 0.8,
  } as any,
  projectionData: null,
  projectionLoading: false,
  monthlyInvestmentData: {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    totalInvested: 0,
  },
  displayCurrency: { code: "USD", symbol: "$" } as any,
  collapsed: false,
  onToggle: jest.fn(),
}

describe("IndependenceMetrics", () => {
  it("renders without crashing", () => {
    render(<IndependenceMetrics {...props} />)
    expect(screen.getByText("Independence Metrics")).toBeInTheDocument()
  })

  it("shows the investment modal when the monthly investment button is clicked", () => {
    render(<IndependenceMetrics {...props} />)
    // Click the monthly investment amount button
    const investBtn = screen.getByRole("button", { name: /\$0/i })
    fireEvent.click(investBtn)
    expect(
      screen.getByText("Monthly Investment Transactions"),
    ).toBeInTheDocument()
  })

  it("closes the modal on Escape", () => {
    render(<IndependenceMetrics {...props} />)
    const investBtn = screen.getByRole("button", { name: /\$0/i })
    fireEvent.click(investBtn)
    expect(
      screen.getByText("Monthly Investment Transactions"),
    ).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(
      screen.queryByText("Monthly Investment Transactions"),
    ).not.toBeInTheDocument()
  })
})
