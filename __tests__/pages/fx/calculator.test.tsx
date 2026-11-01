import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSWR from "swr"
import { useRouter } from "next/router"
import FxCalculator from "@pages/fx/calculator"

const CalculatorPage = FxCalculator as React.ComponentType<any>

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}))

const STORAGE_KEY = "bc:fx-calculator:pair"

const currencies = [
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "MYR", name: "Ringgit", symbol: "RM" },
  { code: "SGD", name: "Dollar", symbol: "$" },
  { code: "USD", name: "Dollar", symbol: "$" },
]

const storedPair = (): unknown =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")

describe("FX Calculator page", () => {
  const back = jest.fn()

  beforeEach(() => {
    window.localStorage.clear()
    back.mockReset()
    ;(useRouter as jest.Mock).mockReturnValue({ back })
    ;(useSWR as jest.Mock).mockImplementation((key: unknown) =>
      Array.isArray(key)
        ? { data: undefined, isLoading: false }
        : { data: { data: currencies }, isLoading: false },
    )
  })

  it("defaults to USD and EUR without storing a choice", () => {
    render(<CalculatorPage />)

    expect(screen.getByText("USD - Dollar")).toBeInTheDocument()
    expect(screen.getByText("EUR - Euro")).toBeInTheDocument()
    expect(storedPair()).toBeNull()
  })

  it("restores the remembered pair", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ from: "SGD", to: "MYR" }),
    )

    render(<CalculatorPage />)

    expect(screen.getByText("SGD - Dollar")).toBeInTheDocument()
    expect(screen.getByText("MYR - Ringgit")).toBeInTheDocument()
  })

  it("falls back to the default for a remembered currency no longer offered", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ from: "XXX", to: "MYR" }),
    )

    render(<CalculatorPage />)

    expect(screen.getByText("USD - Dollar")).toBeInTheDocument()
    expect(screen.getByText("MYR - Ringgit")).toBeInTheDocument()
  })

  it("selects a currency typed by name and remembers it", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    await user.type(screen.getByLabelText("To"), "ringgit{Enter}")

    await waitFor(() =>
      expect(storedPair()).toEqual({ from: "USD", to: "MYR" }),
    )
    expect(screen.getByText("MYR - Ringgit")).toBeInTheDocument()
  })

  it("selects a currency typed by code", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    await user.type(screen.getByLabelText("From"), "sgd{Enter}")

    await waitFor(() =>
      expect(storedPair()).toEqual({ from: "SGD", to: "EUR" }),
    )
  })

  it("remembers the pair after a swap", () => {
    render(<CalculatorPage />)

    fireEvent.click(screen.getByRole("button", { name: "Swap currencies" }))

    expect(storedPair()).toEqual({ from: "EUR", to: "USD" })
  })

  it("keeps the calculator open when Escape dismisses the currency list", async () => {
    jest.useFakeTimers()
    render(<CalculatorPage />)
    jest.advanceTimersByTime(150)
    jest.useRealTimers()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("From"), "dollar")
    await user.keyboard("{Escape}")

    expect(back).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")

    expect(back).toHaveBeenCalledTimes(1)
  })
})
