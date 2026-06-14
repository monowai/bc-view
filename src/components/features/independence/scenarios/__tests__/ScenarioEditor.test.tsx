import React from "react"
import { render, screen } from "@testing-library/react"
import ScenarioEditor from "../ScenarioEditor"
import { WorkScenario } from "types/independence"

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({ settings: undefined }),
}))

// ScenarioContributions fetches the user's pension assets via SWR; stub it so
// the editor renders standalone.
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: undefined, error: undefined, mutate: jest.fn() }),
}))

const scenario: WorkScenario = {
  id: "ws1",
  ownerId: "u1",
  name: "My Job",
  isCurrent: true,
  workingIncomeMonthly: 7500,
  workingExpensesMonthly: 5100,
  taxesMonthly: 700,
  bonusMonthly: 300,
  investmentAllocationPercent: 0.8,
  currency: "SGD",
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
  computedMonthlyContribution: 1460,
}

const noop = async (): Promise<void> => {}

describe("ScenarioEditor", () => {
  it("hydrates the form from the scenario on first open (not zeros)", () => {
    render(
      <ScenarioEditor scenario={scenario} onSave={noop} onClose={() => {}} />,
    )
    expect(screen.getByDisplayValue("7500")).toBeInTheDocument()
    expect(screen.getByDisplayValue("5100")).toBeInTheDocument()
    expect(screen.getByDisplayValue("700")).toBeInTheDocument()
    expect(screen.getByDisplayValue("300")).toBeInTheDocument()
    // allocation stored as fraction, edited as percent
    expect(screen.getByDisplayValue("80")).toBeInTheDocument()
  })

  it("renders Currency as a dropdown set to the scenario currency", () => {
    render(
      <ScenarioEditor scenario={scenario} onSave={noop} onClose={() => {}} />,
    )
    const currency = screen.getByRole("combobox", { name: /currency/i })
    expect(currency).toHaveValue("SGD")
  })

  it("defaults a new scenario currency to the supplied plan currency", () => {
    render(
      <ScenarioEditor
        scenario={null}
        defaultCurrency="SGD"
        onSave={noop}
        onClose={() => {}}
      />,
    )
    const currency = screen.getByRole("combobox", { name: /currency/i })
    expect(currency).toHaveValue("SGD")
  })
})
