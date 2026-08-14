import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import ModelPortfolioForm from "../ModelPortfolioForm"
import { ccyKey, portfoliosKey } from "@utils/api/fetchHelper"
import { makePortfolio } from "@test-fixtures/beancounter"
import { ModelDto } from "types/rebalance"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

jest.mock("@components/features/shares/ClientSelector", () => ({
  __esModule: true,
  default: (): React.ReactElement => <div data-testid="client-selector" />,
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))
const mockedUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
]

function swrReturn(data: unknown): ReturnType<typeof useSWR> {
  return {
    data,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useSWR>
}

function mockSwrData(portfolios: ReturnType<typeof makePortfolio>[]): void {
  mockedUseSWR.mockImplementation((key: unknown) => {
    if (key === ccyKey) return swrReturn({ data: CURRENCIES })
    if (key === portfoliosKey) return swrReturn({ data: portfolios })
    return swrReturn(undefined)
  })
}

describe("ModelPortfolioForm base-currency default (#1156)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("defaults a brand-new model's base currency to the first portfolio's report currency, not a hard-coded country default", () => {
    mockSwrData([
      makePortfolio({
        id: "p1",
        currency: { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
      }),
      makePortfolio({
        id: "p2",
        currency: { code: "EUR", name: "Euro", symbol: "€" },
      }),
    ])
    render(<ModelPortfolioForm />)

    const select = screen.getByLabelText("Base Currency") as HTMLSelectElement
    expect(select.value).toBe("SGD")
  })

  it("keeps an existing model's own base currency when editing, regardless of the portfolio list", () => {
    mockSwrData([
      makePortfolio({
        id: "p1",
        currency: { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
      }),
    ])
    const model: ModelDto = {
      id: "model-1",
      name: "Existing Model",
      baseCurrency: "EUR",
      risk: 3,
      shared: false,
      isOwner: true,
      planCount: 0,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }
    render(<ModelPortfolioForm model={model} />)

    const select = screen.getByLabelText("Base Currency") as HTMLSelectElement
    expect(select.value).toBe("EUR")
  })

  it("shows a real placeholder (not a silently-selected hard-coded currency) when creating a model with no portfolios yet", () => {
    mockSwrData([])
    render(<ModelPortfolioForm />)

    const select = screen.getByLabelText("Base Currency") as HTMLSelectElement
    expect(select.value).toBe("")
    expect(screen.getByText("Select a currency...")).toBeInTheDocument()
  })

  describe("submit gating on a resolved base currency", () => {
    it("keeps submit disabled when no currency can be resolved yet, even with a valid name", () => {
      mockSwrData([]) // no portfolios -> resolvedBaseCurrency stays ""
      render(<ModelPortfolioForm />)

      fireEvent.change(screen.getByLabelText(/Model Name/), {
        target: { value: "New Model" },
      })

      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    })

    it("enables submit once a currency is derived from the portfolios list", () => {
      mockSwrData([
        makePortfolio({
          id: "p1",
          currency: { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
        }),
      ])
      render(<ModelPortfolioForm />)

      fireEvent.change(screen.getByLabelText(/Model Name/), {
        target: { value: "New Model" },
      })

      expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled()
    })

    it("enables submit once the user explicitly picks a currency, even with no portfolios", () => {
      mockSwrData([])
      render(<ModelPortfolioForm />)

      fireEvent.change(screen.getByLabelText(/Model Name/), {
        target: { value: "New Model" },
      })
      fireEvent.change(screen.getByLabelText("Base Currency"), {
        target: { value: "EUR" },
      })

      expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled()
    })
  })
})
