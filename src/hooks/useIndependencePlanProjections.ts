import { useState, useEffect } from "react"

export interface PensionProjection {
  assetId: string
  assetName: string
  currentValue: number
  projectedValue: number
  payoutAge: number
  currency: string
  category: string
  cpfLifePlan?: "STANDARD" | "BASIC" | "ESCALATING"
  monthlyPayout?: number
}

export interface LumpSumAssetConfig {
  assetId: string
  payoutAge?: number
  expectedReturnRate?: number
  monthlyContribution?: number
  rentalCurrency?: string
}

export interface LumpSumAsset {
  config: LumpSumAssetConfig
  assetName: string
  currentValue: number
  category: string
}

export interface UseIndependencePlanProjectionsResult {
  pensionProjections: PensionProjection[]
}

export function useIndependencePlanProjections(
  lumpSumAssets: LumpSumAsset[],
  currentAge: number | undefined,
  planCurrency: string,
): UseIndependencePlanProjectionsResult {
  const [pensionProjections, setPensionProjections] = useState<
    PensionProjection[]
  >([])

  useEffect(() => {
    const fetchPensionProjections = async (): Promise<void> => {
      if (!lumpSumAssets.length || currentAge === undefined) {
        setPensionProjections([])
        return
      }

      const projections: PensionProjection[] = []

      for (const asset of lumpSumAssets) {
        const { config, assetName, currentValue, category } = asset

        if (!config.payoutAge || !config.expectedReturnRate) {
          continue
        }

        if (currentAge >= config.payoutAge) {
          projections.push({
            assetId: config.assetId,
            assetName,
            currentValue,
            projectedValue: currentValue,
            payoutAge: config.payoutAge,
            currency: config.rentalCurrency || planCurrency,
            category,
          })
          continue
        }

        try {
          const response = await fetch("/api/projection/lump-sum", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthlyContribution: config.monthlyContribution || 0,
              expectedReturnRate: config.expectedReturnRate,
              currentAge: currentAge,
              payoutAge: config.payoutAge,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            const yearsToMaturity = config.payoutAge - currentAge
            const grownCurrentValue =
              currentValue *
              Math.pow(1 + config.expectedReturnRate, yearsToMaturity)
            const contributionFV = data.data?.projectedPayout || 0
            const totalProjected = grownCurrentValue + contributionFV

            projections.push({
              assetId: config.assetId,
              assetName,
              currentValue,
              projectedValue: totalProjected,
              payoutAge: config.payoutAge,
              currency: config.rentalCurrency || planCurrency,
              category,
            })
          }
        } catch (err) {
          console.error(
            `Failed to fetch projection for ${config.assetId}:`,
            err,
          )
        }
      }

      setPensionProjections(projections)
    }

    fetchPensionProjections()
  }, [lumpSumAssets, currentAge, planCurrency])

  return { pensionProjections }
}
