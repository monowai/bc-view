import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PortfolioModeChooser from "../PortfolioModeChooser"

describe("PortfolioModeChooser", () => {
  it("renders both options and the net-worth reassurance", () => {
    render(
      <PortfolioModeChooser
        mode="new"
        onSelect={jest.fn()}
        existingDisabled={false}
      />,
    )
    expect(
      screen.getByRole("radio", {
        name: /Create a new portfolio for this brokerage/i,
      }),
    ).toBeChecked()
    expect(
      screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
    ).not.toBeChecked()
    expect(
      screen.getByText(/totals your net worth across every portfolio/i),
    ).toBeInTheDocument()
  })

  it("fires onSelect when a different option is chosen", () => {
    const onSelect = jest.fn()
    render(
      <PortfolioModeChooser
        mode="new"
        onSelect={onSelect}
        existingDisabled={false}
      />,
    )
    fireEvent.click(
      screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
    )
    expect(onSelect).toHaveBeenCalledWith("existing")
  })

  it("disables the existing option when there is nothing to attach to", () => {
    render(
      <PortfolioModeChooser mode="new" onSelect={jest.fn()} existingDisabled />,
    )
    expect(
      screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
    ).toBeDisabled()
    expect(screen.getByText(/\(none yet\)/i)).toBeInTheDocument()
  })
})
