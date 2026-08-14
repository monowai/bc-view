import { parseCsvLine } from "@lib/csvExport"
import { AssetWeightWithDetails } from "types/rebalance"

export interface ParsedCsvWeightsResult {
  weights: AssetWeightWithDetails[]
  /** True when at least one parsed row had no captured price — callers use
   *  this to trigger an auto price-fetch after import. */
  missingPrices: boolean
}

/**
 * Parses a plan-allocations CSV/TSV export back into editable weights.
 * Supports both 5-column (Asset, Weight %, Price, Currency, Description)
 * and 4-column (Asset, Weight %, Price, Description) formats. Currency can
 * also be inferred from the price header, e.g. "Price (SGD)".
 *
 * `existingWeights` is used to recover the real assetId for a code that's
 * already in the plan (import must not fabricate a fresh id for an asset
 * the plan already resolved).
 *
 * Returns `{ weights: [], missingPrices: false }` when nothing parses —
 * callers must treat that as a no-op (no setState), matching the original
 * `if (newWeights.length > 0)` guard.
 */
export function parseWeightsFromCsvText(
  text: string,
  existingWeights: AssetWeightWithDetails[],
): ParsedCsvWeightsResult {
  const lines = text.trim().split("\n")
  const headerLine = lines[0].toLowerCase()
  const hasHeader = headerLine.includes("asset")
  const dataLines = hasHeader ? lines.slice(1) : lines

  // Detect column layout from header
  const headerParts = hasHeader ? parseCsvLine(lines[0]) : ([] as string[])
  // Check if header has a separate currency column (5-column format)
  const hasCurrencyColumn =
    headerParts.length >= 5 &&
    headerParts[3]?.toLowerCase().includes("currency")
  // Extract currency from price header, e.g. "Price (SGD)" -> "SGD"
  const priceHeader = headerParts[2] || ""
  const headerCurrencyMatch = priceHeader.match(/\(([A-Z]{3})\)/i)
  const headerCurrency = headerCurrencyMatch?.[1]?.toUpperCase()

  const newWeights: AssetWeightWithDetails[] = []

  for (const line of dataLines) {
    const parts = parseCsvLine(line)
    if (parts.length >= 2) {
      const rawAssetCode = parts[0]
      const weightPercent = parseFloat(parts[1])
      const parsedPrice = parts[2] ? parseFloat(parts[2]) : NaN
      const price = Number.isFinite(parsedPrice) ? parsedPrice : undefined

      let currency: string | undefined
      let rationale: string | undefined

      if (hasCurrencyColumn) {
        // 5-column format: Asset, Weight %, Price, Currency, Description
        currency = parts[3] || undefined
        rationale = parts[4] || undefined
      } else {
        // 4-column format: Asset, Weight %, Price, Description
        // Use currency from price header if available
        currency = headerCurrency
        rationale = parts[3] || undefined
      }

      if (rawAssetCode && !isNaN(weightPercent)) {
        // Default to US market if no market code provided
        const assetCode = rawAssetCode.includes(":")
          ? rawAssetCode
          : `US:${rawAssetCode}`
        // Try to find existing asset to get its UUID
        const existing = existingWeights.find(
          (w) => w.assetCode === assetCode || w.assetId === assetCode,
        )
        newWeights.push({
          assetId: existing?.assetId || assetCode,
          assetCode: assetCode, // MARKET:CODE format
          weight: weightPercent,
          capturedPrice: price,
          priceCurrency: currency,
          rationale: rationale,
          sortOrder: newWeights.length,
        })
      }
    }
  }

  return {
    weights: newWeights,
    missingPrices: newWeights.some((w) => !w.capturedPrice),
  }
}
