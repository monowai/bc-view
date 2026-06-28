import { buildCompositeBalanceTrn } from "@utils/trns/compositeBalanceTrn"

describe("buildCompositeBalanceTrn", () => {
  const base = {
    assetId: "asset-1",
    assetName: "CPF",
    currency: "SGD",
    tradeDate: "2026-06-28",
  }

  it("builds a BALANCE trn carrying the sub-account map for composites", () => {
    const row = buildCompositeBalanceTrn({
      ...base,
      subAccounts: [
        { code: "OA", balance: 100 },
        { code: "SA", balance: 250 },
      ],
    })

    expect(row).toMatchObject({
      assetId: "asset-1",
      trnType: "BALANCE",
      quantity: 350,
      tradeAmount: 350,
      tradeCurrency: "SGD",
      cashCurrency: "SGD",
      status: "SETTLED",
      subAccounts: { OA: 100, SA: 250 },
    })
    expect(row?.comments).toContain("CPF")
  })

  it("builds an ADD trn for a plain positive balance", () => {
    const row = buildCompositeBalanceTrn({ ...base, balance: 500 })

    expect(row).toMatchObject({
      assetId: "asset-1",
      trnType: "ADD",
      quantity: 500,
      price: 1,
      tradeCurrency: "SGD",
      status: "SETTLED",
    })
    expect(row?.subAccounts).toBeUndefined()
  })

  it("prefers sub-accounts over a top-level balance when both are present", () => {
    const row = buildCompositeBalanceTrn({
      ...base,
      subAccounts: [{ code: "OA", balance: 10 }],
      balance: 999,
    })

    expect(row?.trnType).toBe("BALANCE")
    expect(row?.quantity).toBe(10)
  })

  it("returns null when there is nothing to link", () => {
    expect(buildCompositeBalanceTrn({ ...base })).toBeNull()
    expect(buildCompositeBalanceTrn({ ...base, subAccounts: [] })).toBeNull()
    expect(buildCompositeBalanceTrn({ ...base, balance: 0 })).toBeNull()
  })
})
