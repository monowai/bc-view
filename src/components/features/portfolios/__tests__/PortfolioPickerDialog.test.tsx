import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { makePortfolio, USD, SGD } from "@test-fixtures/beancounter"
import PortfolioPickerDialog from "@components/features/portfolios/PortfolioPickerDialog"

describe("PortfolioPickerDialog", () => {
  const portfolios = [
    makePortfolio({ id: "p-1", code: "MAIN", name: "Main", currency: USD }),
    makePortfolio({ id: "p-2", code: "CPF", name: "CPF Fund", currency: SGD }),
  ]

  it("renders title, prompt and one button per portfolio", () => {
    render(
      <PortfolioPickerDialog
        title="Choose portfolio"
        prompt="Which portfolio?"
        portfolios={portfolios}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    )

    expect(screen.getByText("Choose portfolio")).toBeInTheDocument()
    expect(screen.getByText("Which portfolio?")).toBeInTheDocument()
    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.getByText("CPF Fund")).toBeInTheDocument()
  })

  it("fires onSelect with the clicked portfolio", () => {
    const onSelect = jest.fn()
    render(
      <PortfolioPickerDialog
        title="Choose portfolio"
        prompt="Which portfolio?"
        portfolios={portfolios}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByText("CPF Fund"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p-2" }),
    )
  })
})
