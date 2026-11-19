import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SpendDialog from "../SpendDialog"
import type { PlanExpense, SpendEntry } from "types/independence"

const budget = (
  categoryLabelId: string,
  categoryName: string,
  monthlyAmount: number,
): PlanExpense => ({
  id: categoryLabelId,
  planId: "p1",
  categoryLabelId,
  categoryName,
  monthlyAmount,
  currency: "SGD",
  sortOrder: 0,
})

const budgets = [
  budget("housing", "Housing", 2000),
  budget("travel", "Travel", 1000),
]

const entries: SpendEntry[] = [
  {
    month: "2026-11",
    categoryLabelId: "housing",
    categoryName: "Housing",
    projected: 1900,
    actual: 2100,
    currency: "SGD",
  },
]

const renderDialog = (onSaved = jest.fn()): void => {
  render(
    <SpendDialog
      budgets={budgets}
      entries={entries}
      currency="SGD"
      currencySymbol="S$"
      initialMonth="2026-11"
      historyMonths={["2026-10", "2026-11"]}
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  )
}

describe("SpendDialog", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }) as jest.Mock
  })

  it("lists each plan category with its budget and the month's recorded figures", () => {
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
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe("/api/independence/spend/2026-11")
    expect(init.method).toBe("PUT")
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
    })
  })

  it("explains when the plan has no retirement budget to record against", () => {
    render(
      <SpendDialog
        budgets={[]}
        entries={[]}
        currency="SGD"
        currencySymbol="S$"
        initialMonth="2026-11"
        historyMonths={["2026-10", "2026-11"]}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    )
    expect(
      screen.getByText(
        "This plan has no retirement expenses yet. Add them in the plan to record spend against them.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
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
})
