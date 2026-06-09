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
    label: "Restricted — housing / edu pre-55",
    tone: "amber",
    tooltip:
      "Ordinary Account. Withdrawable for approved uses (housing, education, top-ups). At age 55 the balance flows into the Retirement Account up to the FRS cap to fund CPF LIFE.",
  },
  SA: {
    label: "Locked — merges to RA at 55",
    tone: "gray",
    tooltip:
      "Special Account. Statutorily locked until 55, then absorbed into the Retirement Account to fund CPF LIFE annuity. Not spendable as a lump sum.",
  },
  MA: {
    label: "Medical only",
    tone: "gray",
    tooltip:
      "MediSave Account. Locked for approved healthcare expenses and MediShield premiums. Never enters the spendable pool.",
  },
  RA: {
    label: "CPF LIFE annuity source",
    tone: "gray",
    tooltip:
      "Retirement Account. Created at age 55 from OA/SA balances; pays out as the CPF LIFE annuity from the payout-start age.",
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
