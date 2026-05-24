import React from "react"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"

/**
 * Light read-only summary of the user's existing pension / policy assets,
 * rendered on the Wealth (AssetsStep) page so it doesn't look like the
 * portfolio currency block + 'Add Retirement Account' CTA are the whole
 * picture when there are CPF / SingLife / SRS rows already configured.
 *
 * Anything actionable lives on the Accounts page Edit Asset dialog — this
 * is just a 'these exist' callout with the same data IncomeSourcesStep
 * uses to compute payouts later in the wizard.
 */
export default function ExistingRetirementAccounts(): React.ReactElement | null {
  const { configs, assetNames } = usePrivateAssetConfigs()
  const pensionAssets = (configs || []).filter((c) => c.isPension)
  if (pensionAssets.length === 0) return null

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-4">
      <div className="flex items-center mb-2">
        <i className="fas fa-piggy-bank text-indigo-600 mr-2"></i>
        <h3 className="text-sm font-semibold text-indigo-800">
          Your retirement accounts ({pensionAssets.length})
        </h3>
      </div>
      <ul className="space-y-1">
        {pensionAssets.map((c) => (
          <li
            key={c.assetId}
            className="flex justify-between text-sm text-indigo-700"
          >
            <span>
              {assetNames?.[c.assetId] || c.assetId}
              {c.policyType ? (
                <span className="ml-2 text-xs text-indigo-500">
                  {c.policyType}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-indigo-500">
              {c.payoutAge ? `payout age ${c.payoutAge}` : "no payout age"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-indigo-600 mt-2">
        <i className="fas fa-info-circle mr-1"></i>
        Edit each one on the Accounts page — projected income shows on the
        Monthly Income step.
      </p>
    </div>
  )
}
