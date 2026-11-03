import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FxMatrix from "@pages/fx"

const Page = FxMatrix as React.ComponentType<any>

const perms = { admin: false }
jest.mock("@hooks/usePermissions", () => ({ usePermissions: () => perms }))

const matrix: any = {}
const mockUseFxMatrix = jest.fn()
jest.mock("@hooks/useFxMatrix", () => ({
  useFxMatrix: (...a: unknown[]) => mockUseFxMatrix(...a),
}))
jest.mock("@components/features/fx/RateChartModal", () => ({
  __esModule: true,
  default: (p: { from: string; to: string; onClose: () => void }) => (
    <button onClick={p.onClose}>{`chart:${p.from}>${p.to}`}</button>
  ),
}))

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "E" },
  { code: "JPY", name: "Yen", symbol: "Y" },
]
const rates = {
  "USD:EUR": { rate: 0.9, date: "2026-01-01" },
  "EUR:USD": { rate: 1.1111, date: "2026-01-01" },
  "USD:JPY": { rate: 150, date: "2026-01-01" },
}
const rates1 = {
  "USD:EUR": { rate: 0.92, date: "d" },
  "EUR:USD": { rate: 1.08, date: "d" },
}
const rates2 = {
  "USD:EUR": { rate: 0.9, date: "d" },
  "EUR:USD": { rate: 1.08, date: "d" },
}

function setMatrix(over: Record<string, unknown> = {}): void {
  Object.assign(matrix, {
    currencies,
    rates,
    compareRates1: rates1,
    compareRates2: rates2,
    providers: [],
    isLoading: false,
    error: undefined,
    rateDates: {
      rateDate: "2026-01-01",
      rateDate1: "2026-01-02",
      rateDate2: "2026-01-03",
    },
    ...over,
  })
  mockUseFxMatrix.mockReturnValue(matrix)
}

const fromUsd = (): HTMLElement =>
  screen.getByText(
    (_, el) => el?.tagName === "BUTTON" && el.textContent === "$USD",
  )

describe("FX matrix page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    perms.admin = false
    setMatrix()
  })

  it("shows an error state", () => {
    setMatrix({ error: new Error("fx broke") })
    render(<Page />)
    expect(screen.getByText(/Error loading FX rates/)).toBeInTheDocument()
  })

  it("shows a loading indicator and no rates while loading", () => {
    setMatrix({ isLoading: true })
    render(<Page />)
    expect(screen.getByText("Loading rates...")).toBeInTheDocument()
    expect(screen.queryByText("0.9000")).not.toBeInTheDocument()
  })

  it("shows the rate date, or the generic subtitle when there is none", () => {
    const { unmount } = render(<Page />)
    expect(screen.getByText(/As of 2026-01-01/)).toBeInTheDocument()
    unmount()
    setMatrix({ rateDates: {} })
    render(<Page />)
    expect(
      screen.getAllByText(/Cross rates between supported currencies/).length,
    ).toBeGreaterThan(0)
  })

  it("renders the matrix with parity on the diagonal and dashes for unknown pairs", () => {
    render(<Page />)
    expect(screen.getAllByText("1.0000")).toHaveLength(3)
    expect(
      screen.getAllByTitle("Click to view USD/EUR history")[0],
    ).toHaveTextContent("0.9000")
    expect(
      screen.getAllByTitle("Click to view USD/JPY history")[0],
    ).toHaveTextContent("150.0000")
    // JPY:USD is missing
    expect(
      screen.getAllByTitle("Click to view JPY/USD history")[0],
    ).toHaveTextContent("-")
  })

  it("opens the history chart for a clicked rate and closes it", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getAllByTitle("Click to view USD/EUR history")[0])
    await user.click(screen.getByText("chart:USD>EUR"))
    expect(screen.queryByText("chart:USD>EUR")).not.toBeInTheDocument()
  })

  it("mobile: picks a source currency to list its conversions, and toggles it off", async () => {
    const user = userEvent.setup()
    render(<Page />)
    expect(screen.getByText(/Select a currency above/)).toBeInTheDocument()
    await user.click(fromUsd())
    expect(
      screen.queryByText(/Select a currency above/),
    ).not.toBeInTheDocument()
    expect(screen.getByText("1.1111 USD")).toBeInTheDocument()
    await user.click(screen.getByText("1.1111 USD"))
    expect(screen.getByText("chart:EUR>USD")).toBeInTheDocument()
    await user.click(screen.getByText("chart:EUR>USD"))
    await user.click(fromUsd())
    expect(screen.getByText(/Select a currency above/)).toBeInTheDocument()
  })

  it("hides provider controls from non-admins", () => {
    setMatrix({ providers: ["FRANKFURTER", "EXCHANGE_RATES_API"] })
    render(<Page />)
    expect(screen.queryByText("Auto (Cached)")).not.toBeInTheDocument()
    expect(screen.queryByText("Compare Providers")).not.toBeInTheDocument()
  })

  describe("as admin", () => {
    beforeEach(() => {
      perms.admin = true
      setMatrix({ providers: ["FRANKFURTER", "EXCHANGE_RATES_API"] })
    })

    it("selects a provider and refetches for it", async () => {
      const user = userEvent.setup()
      render(<Page />)
      await user.selectOptions(screen.getByRole("combobox"), "FRANKFURTER")
      const last =
        mockUseFxMatrix.mock.calls[mockUseFxMatrix.mock.calls.length - 1]
      expect(last).toEqual(["FRANKFURTER", false])
      await user.selectOptions(screen.getByRole("combobox"), "")
      const again =
        mockUseFxMatrix.mock.calls[mockUseFxMatrix.mock.calls.length - 1]
      expect(again[0]).toBeUndefined()
    })

    it("compares providers: legend, both rates and the percentage difference", async () => {
      const user = userEvent.setup()
      render(<Page />)
      await user.selectOptions(screen.getByRole("combobox"), "FRANKFURTER")
      await user.click(
        screen.getByRole("button", { name: /Compare Providers/ }),
      )
      const last =
        mockUseFxMatrix.mock.calls[mockUseFxMatrix.mock.calls.length - 1]
      expect(last).toEqual([undefined, true])

      expect(screen.getByText("Frankfurter")).toBeInTheDocument()
      expect(screen.getByText("ExchangeRates")).toBeInTheDocument()
      expect(screen.getByText("(2026-01-02)")).toBeInTheDocument()
      expect(screen.getByText("(2026-01-03)")).toBeInTheDocument()
      expect(
        screen.getByText(/Differences show which provider/),
      ).toBeInTheDocument()
      expect(screen.queryByText("Rate colors:")).not.toBeInTheDocument()
      // 0.92 vs 0.90 => +2.222%
      expect(screen.getAllByText("+2.222%").length).toBeGreaterThan(0)

      // mobile compare cards
      await user.click(fromUsd())
      expect(screen.getAllByText("+2.222%").length).toBeGreaterThan(1)

      await user.click(
        screen.getByRole("button", { name: /Compare Providers/ }),
      )
      expect(screen.getByText("Rate colors:")).toBeInTheDocument()
    })

    it("falls back to the raw provider code when it has no display name", () => {
      setMatrix({ providers: ["OTHER_A", "OTHER_B"] })
      render(<Page />)
      expect(
        within(screen.getByRole("combobox")).getByText("OTHER_A"),
      ).toBeInTheDocument()
    })
  })
})
