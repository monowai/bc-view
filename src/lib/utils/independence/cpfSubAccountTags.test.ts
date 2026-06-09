import { buildCpfSubAccountRows } from "./cpfSubAccountTags"
import { PrivateAssetConfig } from "types/beancounter"

const baseCpf: PrivateAssetConfig = {
  assetId: "cpf-asset",
  monthlyRentalIncome: 0,
  rentalCurrency: "SGD",
  countryCode: "SG",
  monthlyManagementFee: 0,
  managementFeePercent: 0,
  monthlyBodyCorporateFee: 0,
  annualPropertyTax: 0,
  annualInsurance: 0,
  monthlyOtherExpenses: 0,
  deductIncomeTax: false,
  isPrimaryResidence: false,
  liquidationPriority: 99,
  transactionDayOfMonth: 1,
  autoGenerateTransactions: false,
  isPension: true,
  policyType: "CPF",
  subAccounts: [
    {
      id: "1",
      assetId: "cpf-asset",
      code: "OA",
      balance: 145000,
      liquid: true,
    },
    {
      id: "2",
      assetId: "cpf-asset",
      code: "SA",
      balance: 78000,
      liquid: true,
    },
    {
      id: "3",
      assetId: "cpf-asset",
      code: "MA",
      balance: 58000,
      liquid: false,
    },
    { id: "4", assetId: "cpf-asset", code: "RA", balance: 0, liquid: true },
  ],
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

describe("buildCpfSubAccountRows", () => {
  it("returns empty array when no configs", () => {
    expect(buildCpfSubAccountRows(undefined, {})).toEqual([])
    expect(buildCpfSubAccountRows([], {})).toEqual([])
  })

  it("returns empty array when no CPF configs", () => {
    const ilp: PrivateAssetConfig = {
      ...baseCpf,
      assetId: "ilp",
      policyType: "ILP",
      subAccounts: [
        {
          id: "f1",
          assetId: "ilp",
          code: "FUND-A",
          balance: 50000,
          liquid: true,
        },
      ],
    }
    expect(buildCpfSubAccountRows([ilp], { ilp: "MyILP" })).toEqual([])
  })

  it("ignores CPF configs without sub-accounts", () => {
    const noSubs: PrivateAssetConfig = { ...baseCpf, subAccounts: [] }
    expect(buildCpfSubAccountRows([noSubs], {})).toEqual([])
  })

  it("flattens all CPF sub-accounts with correct tags", () => {
    const rows = buildCpfSubAccountRows([baseCpf], { "cpf-asset": "Mary CPF" })
    expect(rows).toHaveLength(4)
    const oa = rows.find((r) => r.code === "OA")
    const sa = rows.find((r) => r.code === "SA")
    const ma = rows.find((r) => r.code === "MA")
    const ra = rows.find((r) => r.code === "RA")
    expect(oa).toMatchObject({
      balance: 145000,
      liquid: true,
      tagTone: "amber",
      parentAssetName: "Mary CPF",
    })
    expect(sa?.tagLabel).toContain("merges to RA")
    expect(ma?.tagLabel).toBe("Medical only")
    expect(ra?.tagLabel).toContain("CPF LIFE")
    expect(ma?.liquid).toBe(false)
  })

  it("sub-account balances sum to parent total", () => {
    const rows = buildCpfSubAccountRows([baseCpf], {})
    const total = rows.reduce((s, r) => s + r.balance, 0)
    expect(total).toBe(281000)
  })

  it("falls back to assetId when assetNames map missing entry", () => {
    const rows = buildCpfSubAccountRows([baseCpf], {})
    expect(rows[0]?.parentAssetName).toBe("cpf-asset")
  })

  it("uses displayName when provided on sub-account", () => {
    const custom: PrivateAssetConfig = {
      ...baseCpf,
      subAccounts: [
        {
          id: "1",
          assetId: "cpf-asset",
          code: "OA",
          displayName: "Ordinary",
          balance: 100,
          liquid: true,
        },
      ],
    }
    const rows = buildCpfSubAccountRows([custom], {})
    expect(rows[0].displayName).toBe("Ordinary")
  })
})
