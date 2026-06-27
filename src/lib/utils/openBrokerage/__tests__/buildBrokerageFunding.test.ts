import { buildBrokerageFunding } from "../buildBrokerageFunding"

describe("buildBrokerageFunding", () => {
  it("always opens the broker cash account in Zen mode, even with no deposit", () => {
    // The original bug: Zen mode passed `undefined`, so openBrokerage never
    // minted the per-broker cash asset (e.g. IB-USD). The row must always
    // exist so ensureBrokerCashAsset + settlement mapping run.
    const funding = buildBrokerageFunding({
      isZen: true,
      currency: "USD",
      amount: NaN,
      source: "",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: {},
    })
    expect(funding).toEqual([{ currency: "USD", amount: 0 }])
  })

  it("opens a zero-balance account for a Master broker with no opening deposit", () => {
    const funding = buildBrokerageFunding({
      isZen: false,
      currency: "SGD",
      amount: 0,
      source: "",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: {},
    })
    expect(funding).toEqual([{ currency: "SGD", amount: 0 }])
  })

  it("funds a Master deposit from a bank-account source on the default portfolio", () => {
    const funding = buildBrokerageFunding({
      isZen: false,
      currency: "USD",
      amount: 1000,
      source: "bankAccount:DBS",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: { DBS: "asset-dbs" },
    })
    expect(funding).toEqual([
      {
        currency: "USD",
        amount: 1000,
        sourceAssetId: "asset-dbs",
        sourcePortfolioId: "pf-1",
      },
    ])
  })

  it("funds a Master deposit from a portfolio source", () => {
    const funding = buildBrokerageFunding({
      isZen: false,
      currency: "USD",
      amount: 500,
      source: "portfolio:pf-other",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: {},
    })
    expect(funding).toEqual([
      { currency: "USD", amount: 500, sourcePortfolioId: "pf-other" },
    ])
  })

  it("ignores a bank-account source whose asset id is unknown", () => {
    const funding = buildBrokerageFunding({
      isZen: false,
      currency: "USD",
      amount: 500,
      source: "bankAccount:Missing",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: {},
    })
    expect(funding).toEqual([{ currency: "USD", amount: 500 }])
  })

  it("never attaches a withdrawal source in Zen mode", () => {
    const funding = buildBrokerageFunding({
      isZen: true,
      currency: "USD",
      amount: 1000,
      source: "bankAccount:DBS",
      defaultPortfolioId: "pf-1",
      bankAccountAssetIds: { DBS: "asset-dbs" },
    })
    expect(funding[0].sourceAssetId).toBeUndefined()
    expect(funding[0].sourcePortfolioId).toBeUndefined()
  })
})
