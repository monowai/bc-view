import { buildPensionTrn } from "@components/features/onboarding/buildPensionTrn"
import type { Pension } from "@components/features/onboarding/OnboardingWizard"

const TODAY = "2026-06-14"

describe("buildPensionTrn", () => {
  it("links a composite CPF pension (sub-accounts, no top-level balance) as a BALANCE trn", () => {
    const cpf: Pension = {
      name: "CPF",
      currency: "SGD",
      policyType: "CPF",
      // No top-level balance: CPF balance lives in sub-accounts.
      subAccounts: [
        { code: "OA", balance: 50000, liquid: true },
        { code: "SA", balance: 30000, liquid: false },
        { code: "MA", balance: 20000, liquid: false },
        { code: "RA", balance: 0, liquid: false },
      ],
    }

    const row = buildPensionTrn(cpf, "asset-cpf", TODAY)

    expect(row).toEqual({
      assetId: "asset-cpf",
      trnType: "BALANCE",
      quantity: 100000,
      tradeAmount: 100000,
      tradeDate: TODAY,
      tradeCurrency: "SGD",
      cashCurrency: "SGD",
      status: "SETTLED",
      comments: "Link CPF balance to portfolio",
      subAccounts: { OA: 50000, SA: 30000, MA: 20000, RA: 0 },
    })
  })

  it("keeps a plain pension (top-level balance, no sub-accounts) as an ADD trn", () => {
    const pension: Pension = {
      name: "Acme Pension",
      currency: "USD",
      balance: 12345,
    }

    const row = buildPensionTrn(pension, "asset-plain", TODAY)

    expect(row).toEqual({
      assetId: "asset-plain",
      trnType: "ADD",
      quantity: 12345,
      price: 1,
      tradeCurrency: "USD",
      tradeDate: TODAY,
      status: "SETTLED",
    })
  })

  it("returns null when there is nothing to link (no sub-accounts, no positive balance)", () => {
    const empty: Pension = { name: "Empty", currency: "SGD" }
    expect(buildPensionTrn(empty, "asset-empty", TODAY)).toBeNull()

    const zero: Pension = { name: "Zero", currency: "SGD", balance: 0 }
    expect(buildPensionTrn(zero, "asset-zero", TODAY)).toBeNull()
  })

  it("prefers the BALANCE shape when both sub-accounts and a top-level balance are present", () => {
    const mixed: Pension = {
      name: "Mixed",
      currency: "SGD",
      balance: 999,
      subAccounts: [{ code: "OA", balance: 200 }],
    }

    const row = buildPensionTrn(mixed, "asset-mixed", TODAY)

    expect(row?.trnType).toBe("BALANCE")
    expect(row?.quantity).toBe(200)
    expect(row?.subAccounts).toEqual({ OA: 200 })
  })
})
