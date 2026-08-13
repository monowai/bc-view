import { parseWeightsFromCsvText } from "./csvImport"
import { AssetWeightWithDetails } from "types/rebalance"

describe("parseWeightsFromCsvText", () => {
  it("parses a 5-column CSV (Asset, Weight %, Price, Currency, Description)", () => {
    const csv = [
      "Asset,Weight %,Price,Currency,Description",
      "US:VOO,60,450.12,USD,Core holding",
      "US:VXUS,40,55.30,USD,",
    ].join("\n")

    const { weights, missingPrices } = parseWeightsFromCsvText(csv, [])

    expect(weights).toEqual([
      {
        assetId: "US:VOO",
        assetCode: "US:VOO",
        weight: 60,
        capturedPrice: 450.12,
        priceCurrency: "USD",
        rationale: "Core holding",
        sortOrder: 0,
      },
      {
        assetId: "US:VXUS",
        assetCode: "US:VXUS",
        weight: 40,
        capturedPrice: 55.3,
        priceCurrency: "USD",
        rationale: undefined,
        sortOrder: 1,
      },
    ])
    expect(missingPrices).toBe(false)
  })

  it("parses a 4-column CSV (Asset, Weight %, Price, Description) inferring currency from the price header", () => {
    const csv = [
      "Asset,Weight %,Price (SGD),Description",
      "SG:D05,100,35.5,DBS",
    ].join("\n")

    const { weights } = parseWeightsFromCsvText(csv, [])

    expect(weights).toEqual([
      {
        assetId: "SG:D05",
        assetCode: "SG:D05",
        weight: 100,
        capturedPrice: 35.5,
        priceCurrency: "SGD",
        rationale: "DBS",
        sortOrder: 0,
      },
    ])
  })

  it("defaults a bare code (no market prefix) to the US market", () => {
    const csv = ["Asset,Weight %", "VOO,100"].join("\n")

    const { weights } = parseWeightsFromCsvText(csv, [])

    expect(weights[0].assetCode).toBe("US:VOO")
  })

  it("reuses the existing assetId when the asset is already in the plan", () => {
    const existing: AssetWeightWithDetails[] = [
      { assetId: "real-uuid-1", assetCode: "US:VOO", weight: 50 },
    ]
    const csv = ["Asset,Weight %", "US:VOO,60"].join("\n")

    const { weights } = parseWeightsFromCsvText(csv, existing)

    expect(weights[0].assetId).toBe("real-uuid-1")
  })

  it("flags missingPrices when any parsed row has no price", () => {
    const csv = ["Asset,Weight %,Price", "US:VOO,60,450", "US:VXUS,40,"].join(
      "\n",
    )

    const { missingPrices } = parseWeightsFromCsvText(csv, [])

    expect(missingPrices).toBe(true)
  })

  it("treats a non-numeric price cell as no price (not NaN) and flags missingPrices", () => {
    const csv = ["Asset,Weight %,Price", "US:VOO,60,N/A"].join("\n")

    const { weights, missingPrices } = parseWeightsFromCsvText(csv, [])

    expect(weights[0].capturedPrice).toBeUndefined()
    expect(missingPrices).toBe(true)
  })

  it("treats a headerless file as data rows (no 'asset' column header detected)", () => {
    const csv = ["US:VOO,100"].join("\n")

    const { weights } = parseWeightsFromCsvText(csv, [])

    expect(weights).toHaveLength(1)
    expect(weights[0].assetCode).toBe("US:VOO")
  })

  it("skips rows with fewer than 2 columns or a non-numeric weight", () => {
    const csv = ["Asset,Weight %", "US:VOO", "US:VXUS,not-a-number"].join("\n")

    const { weights } = parseWeightsFromCsvText(csv, [])

    expect(weights).toEqual([])
  })

  it("returns an empty result (no-op) when nothing parses", () => {
    const csv = "Asset,Weight %"

    const result = parseWeightsFromCsvText(csv, [])

    expect(result).toEqual({ weights: [], missingPrices: false })
  })
})
