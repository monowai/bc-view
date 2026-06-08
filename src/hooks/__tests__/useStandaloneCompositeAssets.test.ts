import { buildStandaloneConfigs } from "../useStandaloneCompositeAssets"

describe("buildStandaloneConfigs", () => {
  const cpfConfig = {
    assetId: "asset-cpf",
    policyType: "CPF",
    isComposite: true,
    subAccounts: [
      { code: "OA", balance: 145000, liquid: true },
      { code: "SA", balance: 78000, liquid: true },
      { code: "MA", balance: 58000, liquid: false },
    ],
  }

  it("returns SGD for CPF policies (never USD placeholder)", () => {
    const result = buildStandaloneConfigs(["asset-cpf"], [cpfConfig], {
      "asset-cpf": "CPF",
    })

    expect(result).toHaveLength(1)
    expect(result[0].currency).toBe("SGD")
    expect(result[0].policyType).toBe("CPF")
    expect(result[0].total).toBe(281000)
  })

  it("preserves sub-account liquid flags", () => {
    const result = buildStandaloneConfigs(["asset-cpf"], [cpfConfig], {})

    const ma = result[0].subAccounts.find((s) => s.code === "MA")
    expect(ma?.liquid).toBe(false)
    const oa = result[0].subAccounts.find((s) => s.code === "OA")
    expect(oa?.liquid).toBe(true)
  })

  it("skips ids not in composites map", () => {
    const result = buildStandaloneConfigs(["asset-missing"], [cpfConfig], {})

    expect(result).toEqual([])
  })

  it("falls back to UNKNOWN currency for unknown policy types (forces server lookup later)", () => {
    const ilpConfig = {
      assetId: "asset-ilp",
      policyType: "ILP",
      isComposite: true,
      subAccounts: [{ code: "FUND-A", balance: 50000, liquid: true }],
    }
    const result = buildStandaloneConfigs(["asset-ilp"], [ilpConfig], {})

    expect(result[0].currency).toBe("")
    expect(result[0].policyType).toBe("ILP")
  })
})
