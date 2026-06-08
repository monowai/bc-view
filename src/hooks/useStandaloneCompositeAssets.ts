import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

/**
 * Subset of svc-data's PrivateAssetConfig response — only the fields the
 * Link banner / dialog need. Keep narrow so we don't drag the full asset
 * config DTO into UI code.
 */
export interface StandaloneCompositeConfig {
  assetId: string
  assetName: string
  assetCode: string
  currency: string
  policyType: string
  total: number
  subAccounts: Array<{
    code: string
    displayName?: string
    balance: number
    liquid: boolean
  }>
}

interface PrivateAssetConfigsResponse {
  data: Array<{
    assetId: string
    policyType?: string | null
    isComposite?: boolean
    subAccounts?: Array<{
      code: string
      displayName?: string
      balance: number
      liquid?: boolean
    }>
  }>
  assetNames?: Record<string, string>
}

interface AssetPositionsResponse {
  data: Array<{ portfolio: { id: string } | null }>
}

const CONFIGS_KEY = "/api/assets/config"

/**
 * Lists composite-policy assets the user owns that aren't held in any
 * portfolio. Used by the Link banner to nudge the user to BALANCE the
 * asset into a portfolio (CPF / ILP / generic pension) so it appears in
 * portfolio holdings + the plan's Assets-by-Category panel.
 *
 * Implementation: pulls all configs, filters to composite, then asks
 * svc-position whether each is held. Standalone = held nowhere.
 */
export function useStandaloneCompositeAssets(): {
  standalone: StandaloneCompositeConfig[]
  isLoading: boolean
} {
  const { data, isLoading } = useSwr<PrivateAssetConfigsResponse>(
    CONFIGS_KEY,
    simpleFetcher(CONFIGS_KEY),
  )

  const composites = (data?.data ?? []).filter(
    (c) => c.isComposite && (c.subAccounts?.length ?? 0) > 0,
  )

  const compositeKey = composites.length
    ? `standalone-composites:${composites.map((c) => c.assetId).join(",")}`
    : null

  const { data: standaloneIds, isLoading: heldLoading } = useSwr<string[]>(
    compositeKey,
    async () => {
      const checks = await Promise.all(
        composites.map(async (c) => {
          try {
            const r = await fetch(
              `/api/assets/${c.assetId}/positions?date=today`,
            )
            if (!r.ok) return c.assetId
            const body: AssetPositionsResponse = await r.json()
            const held = (body.data ?? []).some(
              (e) => e.portfolio && e.portfolio.id,
            )
            return held ? null : c.assetId
          } catch {
            return c.assetId
          }
        }),
      )
      return checks.filter((id): id is string => id != null)
    },
  )

  const names = data?.assetNames ?? {}
  const safeIds: string[] = Array.isArray(standaloneIds) ? standaloneIds : []
  const standalone: StandaloneCompositeConfig[] = safeIds
    .map((id) => composites.find((c) => c.assetId === id))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => {
      const subs = (c.subAccounts ?? []).map((sa) => ({
        code: sa.code,
        displayName: sa.displayName,
        balance: sa.balance,
        liquid: sa.liquid ?? true,
      }))
      return {
        assetId: c.assetId,
        assetName: names[c.assetId] ?? c.assetId,
        assetCode: c.assetId,
        currency: "USD", // placeholder — overridden when banner displays via asset lookup
        policyType: c.policyType ?? "UNKNOWN",
        total: subs.reduce((sum, sa) => sum + (sa.balance || 0), 0),
        subAccounts: subs,
      }
    })

  return { standalone, isLoading: isLoading || heldLoading }
}
