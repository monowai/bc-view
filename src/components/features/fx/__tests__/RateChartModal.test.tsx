import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import RateChartModal from "@components/features/fx/RateChartModal"

let mockHistory: Record<string, unknown>
jest.mock("@hooks/useFxHistory", () => ({
  useFxHistory: () => mockHistory,
}))

beforeEach(() => {
  mockHistory = {
    chartData: [],
    stats: null,
    isLoading: false,
    error: undefined,
    months: 1,
    setMonths: jest.fn(),
    isInverted: false,
    setIsInverted: jest.fn(),
  }
})

describe("RateChartModal", () => {
  it("says so when the range has no rate history", () => {
    render(<RateChartModal from="NZD" to="SGD" onClose={jest.fn()} />)

    expect(screen.getByText(/no rate history/i)).toBeInTheDocument()
  })

  it("closes on Escape", () => {
    const onClose = jest.fn()
    render(<RateChartModal from="NZD" to="SGD" onClose={onClose} />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).toHaveBeenCalled()
  })

  it("never submits an enclosing form", () => {
    render(<RateChartModal from="NZD" to="SGD" onClose={jest.fn()} />)

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button")
    }
  })
})
