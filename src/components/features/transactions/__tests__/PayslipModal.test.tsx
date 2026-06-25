import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import PayslipModal from "../PayslipModal"
import { SGD, makePortfolio } from "@test-fixtures/beancounter"

// Two portfolios by default → "master" mode where the Portfolio selector is
// shown. Zen mode (a single portfolio, selector hidden) is exercised below by
// overriding this to one entry.
const masterPortfolios = {
  data: [
    makePortfolio({ id: "pf-1", code: "MAIN", name: "Main", base: SGD }),
    makePortfolio({ id: "pf-2", code: "SECOND", name: "Second", base: SGD }),
  ],
}
const zenPortfolios = {
  data: [makePortfolio({ id: "pf-1", code: "MAIN", name: "Main", base: SGD })],
}
let mockPortfolios: typeof masterPortfolios = masterPortfolios
const mockCash = {
  data: [
    {
      id: "cash-sgd",
      code: "SGD",
      name: "SGD Cash",
      assetCategory: { id: "CASH", name: "Cash" },
      market: { code: "CASH" },
    },
  ],
}
const mockTradeAccounts = {
  data: [
    {
      id: "wise-usd",
      code: "WISE",
      name: "Wise USD",
      priceSymbol: "USD",
      market: { code: "US", currency: { code: "USD" } },
    },
  ],
}
const mockBankAccounts = {
  data: [
    {
      id: "dbs-sgd",
      code: "DBS",
      name: "DBS Savings",
      priceSymbol: "SGD",
      market: { code: "SG", currency: { code: "SGD" } },
    },
  ],
}

let mockPlans: { data: Array<{ workingIncomeMonthly?: number }> } = { data: [] }
let mockScenarios: {
  data: Array<{ isCurrent: boolean; workingIncomeMonthly?: number }>
} = { data: [] }
const mockMutate = jest.fn()

// Synchronous SWR: route by key substring.
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (!key) return { data: undefined, error: undefined, isLoading: false }
    // CPF "where held" lookup → the CPF asset lives in pf-1.
    if (key.includes("/positions"))
      return { data: "pf-1", error: undefined, isLoading: false }
    if (key.includes("work-scenarios"))
      return { data: mockScenarios, error: undefined, isLoading: false }
    if (key.includes("independence/plans"))
      return { data: mockPlans, error: undefined, isLoading: false }
    if (key.includes("portfolios"))
      return { data: mockPortfolios, error: undefined, isLoading: false }
    if (key.includes("category=TRADE"))
      return { data: mockTradeAccounts, error: undefined, isLoading: false }
    if (key.includes("category=ACCOUNT"))
      return { data: mockBankAccounts, error: undefined, isLoading: false }
    if (key.includes("cash"))
      return { data: mockCash, error: undefined, isLoading: false }
    return { data: { data: [] }, error: undefined, isLoading: false }
  },
  mutate: (...args: unknown[]) => mockMutate(...args),
}))

const mockPreferences = {
  preferences: {
    id: "u1",
    yearOfBirth: 1985,
    reportingCurrencyCode: "USD",
    defaultPayslipPortfolioId: "pf-1",
    defaultPayslipCashAssetId: "cash-sgd",
  } as Record<string, unknown>,
  isLoading: false,
  refetch: jest.fn(),
}
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => mockPreferences,
}))

let mockConfigs: Array<{ assetId: string; policyType: string }> = []
jest.mock("@lib/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({ configs: mockConfigs }),
}))

let mockDc:
  | {
      employeeContribution: number
      employerContribution: number
      employeeRate: number
      cappedSalary: number
      hasDefinedContribution: boolean
      buckets?: { code: string; amount: number }[]
    }
  | undefined
jest.mock("@components/features/independence/useDefinedContribution", () => ({
  useDefinedContribution: () => ({ data: mockDc }),
}))

describe("PayslipModal", () => {
  beforeEach(() => {
    mockPortfolios = masterPortfolios
    mockConfigs = []
    mockDc = undefined
    mockPlans = { data: [] }
    mockScenarios = { data: [] }
    mockMutate.mockClear()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch
  })

  it("renders the core fields", () => {
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(screen.getByText("Enter Payslip")).toBeInTheDocument()
    expect(screen.getByLabelText("Gross salary")).toBeInTheDocument()
    expect(screen.getByLabelText("Portfolio")).toBeInTheDocument()
    expect(screen.getByLabelText("Pay into")).toBeInTheDocument()
    expect(screen.getByLabelText("Tax deducted")).toBeInTheDocument()
  })

  it("defaults Gross salary to the active work scenario's monthly income", () => {
    // Scenario income wins over the plan field (the authoritative source).
    mockScenarios = {
      data: [
        { isCurrent: false, workingIncomeMonthly: 1000 },
        { isCurrent: true, workingIncomeMonthly: 6000 },
      ],
    }
    mockPlans = { data: [{ workingIncomeMonthly: 999 }] }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(
      (screen.getByLabelText("Gross salary") as HTMLInputElement).value,
    ).toBe("6000")
  })

  it("falls back to the primary plan's income when there is no work scenario", () => {
    mockScenarios = { data: [] }
    mockPlans = { data: [{ workingIncomeMonthly: 4200 }] }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(
      (screen.getByLabelText("Gross salary") as HTMLInputElement).value,
    ).toBe("4200")
  })

  it("leaves Gross salary empty when there is no scenario or plan income", () => {
    mockScenarios = { data: [] }
    mockPlans = { data: [] }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(
      (screen.getByLabelText("Gross salary") as HTMLInputElement).value,
    ).toBe("")
  })

  it("revalidates the portfolios list on save so the Wealth total refreshes", async () => {
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "4000" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith("/api/portfolios?inactive=true")
    })
  })

  it("lists private TRADE/ACCOUNT accounts in Pay into, not just cash balances", () => {
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    const payInto = screen.getByLabelText("Pay into")
    const labels = Array.from(payInto.querySelectorAll("option")).map(
      (o) => o.textContent,
    )
    // Generic cash balance still present
    expect(labels).toContain("SGD Cash")
    // Named private accounts now offered (bank + brokerage cash)
    expect(labels).toContain("DBS Savings (SGD)")
    expect(labels).toContain("Wise USD (USD)")
  })

  it("defaults Pay into to the reporting-currency account when no saved pref", () => {
    const prev = mockPreferences.preferences
    mockPreferences.preferences = {
      ...prev,
      defaultPayslipCashAssetId: undefined,
      reportingCurrencyCode: "SGD",
    }
    try {
      render(<PayslipModal modalOpen onClose={jest.fn()} />)
      // Reporting currency SGD → the SGD bank account is preferred over the
      // generic SGD cash balance.
      expect(
        (screen.getByLabelText("Pay into") as HTMLSelectElement).value,
      ).toBe("dbs-sgd")
    } finally {
      mockPreferences.preferences = prev
    }
  })

  it("defaults Pay into to the first account (never USD) when no reporting currency is set", () => {
    const prev = mockPreferences.preferences
    mockPreferences.preferences = {
      ...prev,
      defaultPayslipCashAssetId: undefined,
      reportingCurrencyCode: undefined,
    }
    try {
      render(<PayslipModal modalOpen onClose={jest.fn()} />)
      // No reporting currency → fall back to the first real account (the SGD
      // bank), NOT a hardcoded USD balance.
      expect(
        (screen.getByLabelText("Pay into") as HTMLSelectElement).value,
      ).toBe("dbs-sgd")
    } finally {
      mockPreferences.preferences = prev
    }
  })

  it("defaults the Portfolio to the CPF-holding portfolio, over a different saved default", () => {
    mockConfigs = [{ assetId: "cpf-asset", policyType: "CPF" }]
    const prev = mockPreferences.preferences
    mockPreferences.preferences = {
      ...prev,
      defaultPayslipPortfolioId: "pf-other",
    }
    try {
      render(<PayslipModal modalOpen onClose={jest.fn()} />)
      // The CPF lookup resolves to pf-1 and wins over the stale saved default.
      expect(
        (screen.getByLabelText("Portfolio") as HTMLSelectElement).value,
      ).toBe("pf-1")
    } finally {
      mockPreferences.preferences = prev
    }
  })

  it("shows the Portfolio selector in master mode (more than one portfolio)", () => {
    mockPortfolios = masterPortfolios
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(screen.getByLabelText("Portfolio")).toBeInTheDocument()
  })

  it("hides the Portfolio selector in zen mode (single portfolio auto-selected)", () => {
    mockPortfolios = zenPortfolios
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    // No selector to choose — the sole portfolio is targeted implicitly.
    expect(screen.queryByLabelText("Portfolio")).not.toBeInTheDocument()
  })

  it("auto-targets the sole portfolio in zen mode, even over a stale saved default", async () => {
    mockPortfolios = zenPortfolios
    const prev = mockPreferences.preferences
    // A stale saved default pointing at a since-deleted portfolio must NOT win
    // in zen mode — the selector is hidden, so the sole live portfolio has to
    // outrank it or the payslip posts to a dead id with no way to fix it.
    mockPreferences.preferences = {
      ...prev,
      defaultPayslipPortfolioId: "pf-deleted",
    }
    try {
      render(<PayslipModal modalOpen onClose={jest.fn()} />)
      fireEvent.change(screen.getByLabelText("Gross salary"), {
        target: { value: "4000" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => {
        const trnCall = (global.fetch as jest.Mock).mock.calls.find(
          (c) => c[0] === "/api/trns",
        )
        expect(trnCall).toBeDefined()
      })
      const trnCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[0] === "/api/trns",
      )!
      expect(JSON.parse(trnCall[1].body).portfolioId).toBe("pf-1")
    } finally {
      mockPreferences.preferences = prev
    }
  })

  it("keeps the Portfolio selector when there are no portfolios (never strands the user)", () => {
    // Zero portfolios derives as zen, but there's nothing to auto-target, so
    // the picker must stay visible rather than hide with no recovery path.
    mockPortfolios = { data: [] } as typeof masterPortfolios
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(screen.getByLabelText("Portfolio")).toBeInTheDocument()
  })

  it("shows the pension box whenever the user has a CPF plan, not gated on the live verdict", () => {
    mockConfigs = [{ assetId: "cpf-asset", policyType: "CPF" }]
    // hasDefinedContribution false on purpose — the plan's existence is the
    // signal, so the box still shows once a gross is entered.
    mockDc = {
      employeeContribution: 0,
      employerContribution: 0,
      employeeRate: 0,
      cappedSalary: 0,
      hasDefinedContribution: false,
      buckets: [{ code: "OA", amount: 0 }],
    }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "6000" },
    })
    expect(screen.getByTestId("pension-section")).toBeInTheDocument()
  })

  it("hides the pension section when there is no CPF asset", () => {
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    expect(screen.queryByTestId("pension-section")).not.toBeInTheDocument()
  })

  it("shows the pension section with bucket inputs when a CPF asset exists", () => {
    mockConfigs = [{ assetId: "cpf-asset", policyType: "CPF" }]
    mockDc = {
      employeeContribution: 1200,
      employerContribution: 1020,
      employeeRate: 0.2,
      cappedSalary: 6000,
      hasDefinedContribution: true,
      buckets: [
        { code: "OA", amount: 1380 },
        { code: "SA", amount: 360 },
        { code: "MA", amount: 660 },
      ],
    }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    // Gross must be > 0 for the DC fetch to be meaningful; set it.
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "6000" },
    })
    expect(screen.getByTestId("pension-section")).toBeInTheDocument()
    expect(screen.getByLabelText("CPF OA")).toBeInTheDocument()
    expect(screen.getByLabelText("CPF SA")).toBeInTheDocument()
    expect(screen.getByLabelText("CPF MA")).toBeInTheDocument()
  })

  it("shows a total contribution summing employee and employer", () => {
    mockConfigs = [{ assetId: "cpf-asset", policyType: "CPF" }]
    mockDc = {
      employeeContribution: 1200,
      employerContribution: 1020,
      employeeRate: 0.2,
      cappedSalary: 6000,
      hasDefinedContribution: true,
      buckets: [{ code: "OA", amount: 2220 }],
    }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "6000" },
    })
    const total = screen.getByTestId("pension-total")
    // 1200 + 1020 = 2220
    expect(total).toHaveTextContent("2,220.00")
  })

  it("submits a 4-leg payload with employee-only cash debit and overridden buckets", async () => {
    mockConfigs = [{ assetId: "cpf-asset", policyType: "CPF" }]
    mockDc = {
      employeeContribution: 1200,
      employerContribution: 1020,
      employeeRate: 0.2,
      cappedSalary: 6000,
      hasDefinedContribution: true,
      buckets: [
        { code: "OA", amount: 1380 },
        { code: "SA", amount: 360 },
        { code: "MA", amount: 660 },
      ],
    }
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "6000" },
    })
    fireEvent.change(screen.getByLabelText("Tax deducted"), {
      target: { value: "500" },
    })
    // Override the OA bucket.
    fireEvent.change(screen.getByLabelText("CPF OA"), {
      target: { value: "1500" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const trnCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[0] === "/api/trns",
      )
      expect(trnCall).toBeDefined()
    })

    const trnCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[0] === "/api/trns",
    )!
    const body = JSON.parse(trnCall[1].body)
    expect(body.portfolioId).toBe("pf-1")
    expect(body.data.map((l: { trnType: string }) => l.trnType)).toEqual([
      "INCOME",
      "DEDUCTION",
      "DEDUCTION",
      "ADD",
    ])
    // Employee-only cash debit
    expect(body.data[1].cashAmount).toBe(-1200)
    // Tax leg
    expect(body.data[2].cashAmount).toBe(-500)
    // Overridden buckets → subAccounts
    expect(body.data[3].subAccounts).toEqual({ OA: 1500, SA: 360, MA: 660 })
    expect(body.data[3].cashAmount).toBe(0)

    // Prefs PATCH on save
    await waitFor(() => {
      const meCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[0] === "/api/me",
      )
      expect(meCall).toBeDefined()
      expect(meCall![1].method).toBe("PATCH")
    })
  })

  it("submits salary + optional tax only when no CPF asset", async () => {
    render(<PayslipModal modalOpen onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Gross salary"), {
      target: { value: "4000" },
    })
    fireEvent.change(screen.getByLabelText("Tax deducted"), {
      target: { value: "300" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const trnCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[0] === "/api/trns",
      )
      expect(trnCall).toBeDefined()
    })
    const trnCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[0] === "/api/trns",
    )!
    const body = JSON.parse(trnCall[1].body)
    expect(body.data.map((l: { trnType: string }) => l.trnType)).toEqual([
      "INCOME",
      "DEDUCTION",
    ])
    expect(body.data[0].cashAmount).toBe(4000)
    expect(body.data[1].cashAmount).toBe(-300)
  })
})
