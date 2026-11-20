import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import SpendLogDialog from "../SpendLogDialog"

let log: Record<string, unknown>

jest.mock("../useSpendLog", () => ({
  useSpendLog: () => log,
}))
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}))
jest.mock("../SpendDialog", () => ({
  __esModule: true,
  default: () => <div>spend form</div>,
}))

describe("SpendLogDialog", () => {
  beforeEach(() => {
    log = {
      isLoading: false,
      spendUnavailable: false,
      categories: [],
      budgets: {},
      entries: [],
      debits: [],
      accounts: [],
      rememberedAccount: null,
      currency: "SGD",
      planCurrency: null,
      historyMonths: [],
      budgetsUnavailable: false,
      categoriesUnavailable: false,
      refresh: jest.fn(),
    }
  })

  it("opens the form once the spend log has loaded", () => {
    render(<SpendLogDialog onClose={jest.fn()} />)
    expect(screen.getByText("spend form")).toBeInTheDocument()
  })

  it("offers no form when the spend log failed to load, so a save cannot wipe a month", () => {
    log.spendUnavailable = true
    render(<SpendLogDialog onClose={jest.fn()} />)
    expect(screen.queryByText("spend form")).not.toBeInTheDocument()
    expect(
      screen.getByText("Could not load your spend. Try again later."),
    ).toBeInTheDocument()
  })
})
