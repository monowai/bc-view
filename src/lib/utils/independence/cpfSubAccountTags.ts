import { PrivateAssetConfig, SubAccount } from "types/beancounter"

export interface CpfSubAccountRow {
  parentAssetId: string
  parentAssetName: string
  code: string
  displayName: string
  balance: number
  liquid: boolean
  tagLabel: string
  tagTone: "amber" | "gray"
  tooltip: string
}

const TAGS: Record<
  string,
  { label: string; tone: "amber" | "gray"; tooltip: string }
> = {
  OA: {
    label: "Accumulates, rolls into RA at retirement",
    tone: "amber",
    tooltip:
      "Ordinary Account. Accumulates until the retirement age, then rolls into the Retirement Account to fund payouts.",
  },
  SA: {
    label: "Accumulates, rolls into RA at retirement",
    tone: "gray",
    tooltip:
      "Special Account. Accumulates until the retirement age, then rolls into the Retirement Account to fund payouts.",
  },
  MA: {
    label: "Medical only",
    tone: "gray",
    tooltip:
      "MediSave Account. Reserved for approved healthcare expenses and insurance premiums. Not part of the spendable pool.",
  },
  RA: {
    label: "Pays out from retirement age",
    tone: "amber",
    tooltip:
      "Retirement Account. Holds OA + SA balances at retirement age and pays them out across retirement.",
  },
}

function tagFor(code: string): {
  label: string
  tone: "amber" | "gray"
  tooltip: string
} {
  return (
    TAGS[code.toUpperCase()] ?? {
      label: "Locked",
      tone: "gray",
      tooltip: "Composite sub-account.",
    }
  )
}

/**
 * Flatten CPF configs into per-sub-account display rows. Returns empty array
 * for users without any CPF policy. Caller sums to verify against the
 * composite parent balance.
 */
export function buildCpfSubAccountRows(
  configs: PrivateAssetConfig[] | undefined,
  assetNames: Record<string, string>,
): CpfSubAccountRow[] {
  if (!configs || configs.length === 0) return []
  const rows: CpfSubAccountRow[] = []
  for (const cfg of configs) {
    if (cfg.policyType !== "CPF") continue
    if (!cfg.subAccounts || cfg.subAccounts.length === 0) continue
    const parentName = assetNames[cfg.assetId] ?? cfg.assetId
    for (const sa of cfg.subAccounts as SubAccount[]) {
      const tag = tagFor(sa.code)
      rows.push({
        parentAssetId: cfg.assetId,
        parentAssetName: parentName,
        code: sa.code,
        displayName: sa.displayName || `CPF ${sa.code.toUpperCase()}`,
        balance: sa.balance,
        liquid: sa.liquid,
        tagLabel: tag.label,
        tagTone: tag.tone,
        tooltip: tag.tooltip,
      })
    }
  }
  return rows
}
