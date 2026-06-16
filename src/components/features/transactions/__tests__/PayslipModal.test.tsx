import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import PayslipModal from "../PayslipModal"

const mockPortfolios = {
  data: [{ id: "pf-1", code: "MAIN", name: "Main", base: { code: "SGD" } }],
}
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

// Synchronous SWR: route by key substring.
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (!key) return { data: undefined, error: undefined, isLoading: false }
    if (key.includes("portfolios"))
      return { data: mockPortfolios, error: undefined, isLoading: false }
    if (key.includes("cash"))
      return { data: mockCash, error: undefined, isLoading: false }
    return { data: { data: [] }, error: undefined, isLoading: false }
  },
  mutate: jest.fn(),
}))

const mockPreferences = {
  preferences: {
    id: "u1",
    yearOfBirth: 1985,
    defaultPayslipPortfolioId: "pf-1",
    defaultPayslipCashAssetId: "cash-sgd",
  },
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
    mockConfigs = []
    mockDc = undefined
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
