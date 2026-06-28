import React from "react"
import { render, screen } from "@testing-library/react"
import { SGD, USD, makePortfolio } from "@test-fixtures/beancounter"
import LinkCompositeDialog from "@components/features/portfolios/LinkCompositeDialog"
import type { StandaloneCompositeConfig } from "@hooks/useStandaloneCompositeAssets"

let mockPortfolios = [
  makePortfolio({ id: "pf-1", code: "MAIN", name: "Main", currency: SGD }),
]
jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => ({ portfolios: mockPortfolios }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: null }),
}))

const config: StandaloneCompositeConfig = {
  assetId: "cpf-1",
  assetName: "CPF",
  assetCode: "CPF",
  currency: "SGD",
  policyType: "CPF",
  total: 350,
  subAccounts: [{ code: "OA", balance: 350, liquid: true }],
}

describe("LinkCompositeDialog zen-awareness", () => {
  it("hides the picker and auto-targets the sole portfolio in zen mode", () => {
    mockPortfolios = [
      makePortfolio({ id: "pf-1", code: "MAIN", name: "Main", currency: SGD }),
    ]
    render(<LinkCompositeDialog config={config} onClose={jest.fn()} />)

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByText("MAIN — Main")).toBeInTheDocument()
  })

  it("shows the picker dropdown when the user has several portfolios", () => {
    mockPortfolios = [
      makePortfolio({ id: "pf-1", code: "MAIN", name: "Main", currency: SGD }),
      makePortfolio({
        id: "pf-2",
        code: "USD",
        name: "Dollars",
        currency: USD,
      }),
    ]
    render(<LinkCompositeDialog config={config} onClose={jest.fn()} />)

    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /MAIN/ })).toBeInTheDocument()
  })
})
