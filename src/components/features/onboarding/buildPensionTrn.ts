import type { Pension } from "./OnboardingWizard"
import {
  buildCompositeBalanceTrn,
  type CompositeBalanceTrnRow,
} from "@utils/trns/compositeBalanceTrn"

/**
 * Build the `/api/trns` transaction-data row that links a pension asset
 * to the default portfolio during onboarding. Thin adapter over the shared
 * {@link buildCompositeBalanceTrn} (the single source of truth for the trn
 * shape) — composite pensions (CPF) post a BALANCE trn with the per-sub-account
 * map; plain pensions post an ADD for the top-level balance; nothing-to-link
 * returns null.
 */
export type PensionTrnRow = CompositeBalanceTrnRow

export function buildPensionTrn(
  pension: Pension,
  assetId: string,
  tradeDate: string,
): PensionTrnRow | null {
  return buildCompositeBalanceTrn({
    assetId,
    assetName: pension.name,
    currency: pension.currency,
    tradeDate,
    subAccounts: pension.subAccounts,
    balance: pension.balance,
  })
}
