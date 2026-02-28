import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import FxConverter from "../FxConverter"

// Mock MathInput to be a simple controlled input
jest.mock("@components/ui/MathInput", () => {
  const MockMathInput = ({
    value,
    onChange,
    className,
    placeholder,
  }: {
    value: number | string | undefined
    onChange: (value: number) => void
    className?: string
    placeholder?: string
  }): React.ReactElement => (
    <input
      data-testid="math-input"
      type="text"
      value={value ?? ""}
      onChange={(e) => {
        const num = parseFloat(e.target.value)
        if (!isNaN(num)) onChange(num)
      }}
      className={className}
      placeholder={placeholder}
    />
  )
  MockMathInput.displayName = "MockMathInput"
  return { __esModule: true, default: MockMathInput }
})

describe("FxConverter", () => {
  describe("Compact mode", () => {
    it("renders Quick Convert label and input", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} compact={true} />,
      )

      expect(screen.getByText("Quick Convert")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument()
    })

    it("displays converted amount with tilde prefix", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} compact={true} />,
      )

      const input = screen.getByTestId("math-input")
      fireEvent.change(input, { target: { value: "1000" } })

      expect(screen.getByText(/~850\.00/)).toBeInTheDocument()
    })

    it("does not render combobox", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} compact={true} />,
      )

      const comboboxes = screen.queryAllByRole("combobox")
      expect(comboboxes).toHaveLength(0)
    })
  })

  describe("Full mode", () => {
    it("renders swap button when onSwap provided", () => {
      const onSwap = jest.fn()
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} onSwap={onSwap} />,
      )

      const swapButton = screen.getByRole("button", { name: /swap/i })
      expect(swapButton).toBeInTheDocument()
    })

    it("calls onSwap when swap button clicked", () => {
      const onSwap = jest.fn()
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} onSwap={onSwap} />,
      )

      const swapButton = screen.getByRole("button", { name: /swap/i })
      fireEvent.click(swapButton)

      expect(onSwap).toHaveBeenCalledTimes(1)
    })

    it("shows from and to currency labels", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} />,
      )

      expect(screen.getByText("USD")).toBeInTheDocument()
      expect(screen.getByText("EUR")).toBeInTheDocument()
    })

    it("shows current rate formatted to 4 decimals", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} />,
      )

      expect(screen.getByText(/1 USD = 0\.8500 EUR/)).toBeInTheDocument()
    })

    it("displays dash when no amount entered", () => {
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} />,
      )

      expect(screen.getByText("-")).toBeInTheDocument()
    })
  })
})
