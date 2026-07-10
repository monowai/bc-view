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

interface CompositeConfigSource {
  assetId: string
  policyType?: string | null
  isComposite?: boolean
  subAccounts?: Array<{
    code: string
    displayName?: string
    balance: number
    liquid?: boolean
  }>
}

interface PrivateAssetConfigsResponse {
  data: CompositeConfigSource[]
  assetNames?: Record<string, string>
}

interface AssetPositionsResponse {
  data: Array<{ portfolio: { id: string } | null }>
}

const CONFIGS_KEY = "/api/assets/config"

// Composite policies are denominated in a fixed currency dictated by the
// scheme rules. CPF is statutory SGD; ILP / generic policies vary and need
// a server-side lookup (deferred — empty string forces the caller to handle).
const POLICY_CURRENCY: Record<string, string> = {
  CPF: "SGD",
  US_401K: "USD",
  US_IRA: "USD",
  UK_ISA: "GBP",
}

/**
 * Pure mapping step extracted for unit testing. Given the list of
 * standalone asset ids, the composite configs and the asset-name map,
 * return the [StandaloneCompositeConfig] shape consumed by the Link
 * banner / dialog. `currency` is resolved from the policy type — never
 * a placeholder — so the downstream BALANCE trn carries the correct
 * statutory currency instead of defaulting to USD.
 */
export function buildStandaloneConfigs(
  standaloneIds: string[],
  composites: CompositeConfigSource[],
  assetNames: Record<string, string>,
): StandaloneCompositeConfig[] {
  return standaloneIds
    .map((id) => composites.find((c) => c.assetId === id))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => {
      const subs = (c.subAccounts ?? []).map((sa) => ({
        code: sa.code,
        displayName: sa.displayName,
        balance: sa.balance,
        liquid: sa.liquid ?? true,
      }))
      const policyType = c.policyType ?? "UNKNOWN"
      return {
        assetId: c.assetId,
        assetName: assetNames[c.assetId] ?? c.assetId,
        assetCode: c.assetId,
        currency: POLICY_CURRENCY[policyType] ?? "",
        policyType,
        total: subs.reduce((sum, sa) => sum + (sa.balance || 0), 0),
        subAccounts: subs,
      }
    })
}

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

  const safeIds: string[] = Array.isArray(standaloneIds) ? standaloneIds : []
  const standalone = buildStandaloneConfigs(
    safeIds,
    composites,
    data?.assetNames ?? {},
  )

  return { standalone, isLoading: isLoading || heldLoading }
}
