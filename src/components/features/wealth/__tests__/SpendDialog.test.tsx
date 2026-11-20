import React from "react"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SWRConfig } from "swr"
import "@testing-library/jest-dom"
import SpendDialog from "../SpendDialog"
import type { SpendDebit, SpendEntry } from "types/independence"

const categories = [
  { categoryLabelId: "housing", categoryName: "Housing" },
  { categoryLabelId: "travel", categoryName: "Travel" },
]

const budgets = { housing: 2000, travel: 1000 }

const entries: SpendEntry[] = [
  {
    month: "2026-11",
    categoryLabelId: "housing",
    categoryName: "Housing",
    projected: 1900,
    actual: 2100,
    currency: "SGD",
    estimated: false,
  },
]

const accounts = [
  { id: "dbs", name: "DBS Savings" },
  { id: "ocbc", name: "OCBC" },
]

const debit = (
  month: string,
  cashAssetId: string,
  portfolioId = "p1",
): SpendDebit => ({
  month,
  portfolioId,
  cashAssetId,
  trnId: `t-${month}`,
  amount: 100,
  currency: "SGD",
})

// Portfolios holding each account, served by the asset positions endpoint.
let holders: Record<string, Array<{ id: string; code: string }>> = {}

const renderDialog = (
  onSaved = jest.fn(),
  overrides: Partial<React.ComponentProps<typeof SpendDialog>> = {},
): void => {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SpendDialog
        categories={categories}
        budgets={budgets}
        entries={entries}
        currency="SGD"
        currencySymbol="S$"
        initialMonth="2026-11"
        historyMonths={["2026-10", "2026-11"]}
        planCurrency="SGD"
        budgetsUnavailable={false}
        categoriesUnavailable={false}
        accounts={accounts}
        debits={[]}
        onClose={jest.fn()}
        onSaved={onSaved}
        {...overrides}
      />
    </SWRConfig>,
  )
}

describe("SpendDialog", () => {
  beforeEach(() => {
    holders = { dbs: [{ id: "p1", code: "MAIN" }] }
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const held = /assets\/([^/]+)\/positions/.exec(url)?.[1]
      const data = held
        ? (holders[held] ?? []).map((portfolio) => ({ portfolio }))
        : []
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data }),
      })
    }) as jest.Mock
  })

  const savedBody = (): {
    entries: Array<{ categoryLabelId: string }>
    debit: { portfolioId: string; cashAssetId: string } | null
  } => {
    const call = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => init?.method === "PUT",
    )
    return JSON.parse(call[1].body)
  }

  it("lists each expense category with its budget and the month's recorded figures", () => {
    renderDialog()
    expect(screen.getByText("November 2026")).toBeInTheDocument()
    expect(screen.getByText("Housing")).toBeInTheDocument()
    expect(screen.getByText("S$2,000")).toBeInTheDocument()
    expect(screen.getByLabelText("Housing actual")).toHaveValue(2100)
    expect(screen.getByLabelText("Travel actual")).toHaveValue(null)
  })

  it("totals budget, projected and actual, with the variance against the budget of the categories filled in", () => {
    renderDialog()
    expect(screen.getByText("S$3,000")).toBeInTheDocument()
    expect(screen.getByTestId("total-actual")).toHaveTextContent("S$2,100")
    // Only housing has an actual: 2,100 against its 2,000 budget.
    expect(screen.getByTestId("total-variance")).toHaveTextContent("S$100")
  })

  it("offers a system estimate as a placeholder, not a value", () => {
    render(
      <SpendDialog
        categories={categories}
        budgets={budgets}
        entries={[
          {
            month: "2026-10",
            categoryLabelId: "housing",
            categoryName: "Housing",
            projected: null,
            actual: 2000,
            currency: "SGD",
            estimated: true,
          },
        ]}
        currency="SGD"
        currencySymbol="S$"
        planCurrency="SGD"
        budgetsUnavailable={false}
        categoriesUnavailable={false}
        initialMonth="2026-10"
        historyMonths={["2026-10"]}
        accounts={[]}
        debits={[]}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    )
    const actual = screen.getByLabelText("Housing actual")
    expect(actual).toHaveValue(null)
    expect(actual).toHaveAttribute("placeholder", "est. 2000")
    expect(
      screen.getByText("Estimated — enter what you spent to replace it"),
    ).toBeInTheDocument()
  })

  it("starts a month with nothing recorded empty", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }))
    expect(screen.getByText("October 2026")).toBeInTheDocument()
    expect(screen.getByLabelText("Housing actual")).toHaveValue(null)
  })

  it("saves the month's entries, leaving out categories with nothing entered", async () => {
    const onSaved = jest.fn()
    renderDialog(onSaved)
    fireEvent.change(screen.getByLabelText("Housing projected"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Travel actual"), {
      target: { value: "450" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, init] = (global.fetch as jest.Mock).mock.calls.find(
      ([, i]) => i?.method === "PUT",
    )
    expect(url).toBe("/api/independence/spend/2026-11")
    expect(JSON.parse(init.body)).toEqual({
      currency: "SGD",
      entries: [
        {
          categoryLabelId: "housing",
          categoryName: "Housing",
          projected: null,
          actual: 2100,
        },
        {
          categoryLabelId: "travel",
          categoryName: "Travel",
          projected: null,
          actual: 450,
        },
      ],
      debit: null,
    })
  })

  it("explains when there are no expense categories to record against", () => {
    renderDialog(jest.fn(), { categories: [], entries: [] })
    expect(screen.getByText("No expense categories yet.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("records spend with no plan budget, showing no budget or variance", () => {
    renderDialog(jest.fn(), { budgets: {}, planCurrency: null })
    expect(screen.getByLabelText("Housing actual")).toHaveValue(2100)
    expect(screen.getByTestId("budget-housing")).toHaveTextContent("—")
    expect(screen.queryByTestId("total-variance")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("keeps a category already recorded for the month even when it is no longer listed", async () => {
    const onSaved = jest.fn()
    renderDialog(onSaved, {
      entries: [
        ...entries,
        {
          month: "2026-11",
          categoryLabelId: "gone",
          categoryName: "Old category",
          projected: null,
          actual: 75,
          currency: "SGD",
          estimated: false,
        },
      ],
    })
    expect(screen.getByLabelText("Old category actual")).toHaveValue(75)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const body = savedBody()
    expect(
      body.entries.map((e: { categoryLabelId: string }) => e.categoryLabelId),
    ).toEqual(["housing", "gone"])
  })

  it("says the categories failed to load", () => {
    renderDialog(jest.fn(), { categories: [], categoriesUnavailable: true })
    expect(
      screen.getByText(
        "Could not load your expense categories. Try again later.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("No expense categories yet."),
    ).not.toBeInTheDocument()
  })

  it("charts recorded months on the History tab", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("tab", { name: "History" }))
    expect(screen.getByRole("list", { name: "Legend" })).toHaveTextContent(
      "Housing",
    )
    expect(screen.queryByLabelText("Housing actual")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument()
  })

  it("shows the service's reason when it refuses the save", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          message: "Spend is recorded in SGD; NZD cannot be mixed in",
        }),
    })
    renderDialog(jest.fn())
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText(
        "Spend is recorded in SGD; NZD cannot be mixed in",
      ),
    ).toBeInTheDocument()
  })

  it("says the plan's budget failed to load", () => {
    renderDialog(jest.fn(), { budgets: {}, budgetsUnavailable: true })
    expect(
      screen.getByText("Could not load your plan's budget. Try again later."),
    ).toBeInTheDocument()
  })

  it("does not set spend logged in another currency against the budget", () => {
    renderDialog(jest.fn(), { currency: "USD" })
    expect(
      screen.getByText(
        "Spend is logged in USD, so it is not compared with your plan's SGD budget.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId("budget-housing")).toHaveTextContent("—")
    expect(screen.queryByTestId("total-variance")).not.toBeInTheDocument()
  })

  it("shows the error and stays open when the save fails", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 })
    const onSaved = jest.fn()
    renderDialog(onSaved)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText("Could not save spend for November 2026"),
    ).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("debits the account the month was debited from, in the portfolio that holds it", async () => {
    const onSaved = jest.fn()
    renderDialog(onSaved, { debits: [debit("2026-11", "dbs")] })
    expect(screen.getByLabelText("Debit from")).toHaveValue("dbs")
    await screen.findByText(/one withdrawal of S\$2,100/)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(savedBody().debit).toEqual({ portfolioId: "p1", cashAssetId: "dbs" })
  })

  it("offers the last account debited for a month not yet debited", () => {
    renderDialog(jest.fn(), {
      debits: [debit("2026-09", "ocbc"), debit("2026-10", "dbs")],
    })
    expect(screen.getByLabelText("Debit from")).toHaveValue("dbs")
  })

  it("debits nothing when no account is chosen", async () => {
    const onSaved = jest.fn()
    renderDialog(onSaved, { debits: [debit("2026-11", "dbs")] })
    fireEvent.change(screen.getByLabelText("Debit from"), {
      target: { value: "" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(savedBody().debit).toBeNull()
  })

  it("will not save against an account no portfolio holds", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText("Debit from"), {
      target: { value: "ocbc" },
    })
    expect(
      await screen.findByText(
        "OCBC is not held in a portfolio, so it cannot be debited.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("asks which portfolio when more than one holds the account", async () => {
    holders = {
      dbs: [
        { id: "p1", code: "MAIN" },
        { id: "p2", code: "JOINT" },
      ],
    }
    const onSaved = jest.fn()
    renderDialog(onSaved)
    fireEvent.change(screen.getByLabelText("Debit from"), {
      target: { value: "dbs" },
    })
    const portfolio = await screen.findByLabelText("Portfolio")
    expect(within(portfolio).getAllByRole("option")).toHaveLength(2)
    fireEvent.change(portfolio, { target: { value: "p2" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(savedBody().debit).toEqual({ portfolioId: "p2", cashAssetId: "dbs" })
  })
})
