import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PortfolioModeChooser from "../PortfolioModeChooser"

describe("PortfolioModeChooser", () => {
  it("renders both options (Zen first) and the net-worth reassurance", () => {
    render(
      <PortfolioModeChooser
        mode="existing"
        onSelect={jest.fn()}
        existingDisabled={false}
      />,
    )
    expect(screen.getByRole("radio", { name: /Zen Mode/i })).toBeChecked()
    expect(
      screen.getByRole("radio", { name: /Master Mode/i }),
    ).not.toBeChecked()
    expect(
      screen.getByText(/totals your net worth across every portfolio/i),
    ).toBeInTheDocument()
  })

  it("fires onSelect when a different option is chosen", () => {
    const onSelect = jest.fn()
    render(
      <PortfolioModeChooser
        mode="existing"
        onSelect={onSelect}
        existingDisabled={false}
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: /Master Mode/i }))
    expect(onSelect).toHaveBeenCalledWith("new")
  })

  it("disables the Zen (existing) option when there is nothing to attach to", () => {
    render(
      <PortfolioModeChooser mode="new" onSelect={jest.fn()} existingDisabled />,
    )
    expect(screen.getByRole("radio", { name: /Zen Mode/i })).toBeDisabled()
    expect(screen.getByText(/\(none yet\)/i)).toBeInTheDocument()
  })
})
