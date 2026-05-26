import React from "react"
import Dialog from "@components/ui/Dialog"
import PensionProjectionPanel from "@components/features/independence/scenarios/PensionProjectionPanel"

/**
 * Per-asset balance-projection modal opened from a ScenarioContributions
 * row. Thin Dialog wrapper around PensionProjectionPanel — the panel
 * is also reused inline as a tab in EditAccountDialog.
 */

export interface PensionProjectionAsset {
  assetId: string
  assetName: string
  policyType?: string
  cpfLifePlan?: string
  payoutAge?: number
  expectedReturnRate?: number
  monthlyContribution?: number
  /** Snapshot date for the starting balance — used in the stale-balance banner. */
  updatedDate?: string
  /** CPF only: starting OA / SA / MA / RA balances. */
  subAccounts?: { code: string; balance: number }[]
}

interface Props {
  asset: PensionProjectionAsset
  currency: string
  currentAge: number
  /** Scenario-resolved figures (may differ from asset.monthlyContribution). */
  scenarioMonthlySalary?: number
  scenarioAnnualOverride?: number
  onClose: () => void
}

export default function PensionProjectionModal({
  asset,
  currency,
  currentAge,
  scenarioMonthlySalary,
  scenarioAnnualOverride,
  onClose,
}: Props): React.ReactElement {
  return (
    <Dialog
      title={`Projection · ${asset.assetName}`}
      onClose={onClose}
      maxWidth="lg"
      scrollable
      footer={<Dialog.CancelButton onClick={onClose} label="Close" />}
    >
      <PensionProjectionPanel
        policyType={asset.policyType}
        cpfLifePlan={asset.cpfLifePlan}
        payoutAge={asset.payoutAge}
        expectedReturnRate={asset.expectedReturnRate}
        monthlyContribution={asset.monthlyContribution}
        updatedDate={asset.updatedDate}
        subAccounts={asset.subAccounts}
        currency={currency}
        currentAge={currentAge}
        scenarioMonthlySalary={scenarioMonthlySalary}
        scenarioAnnualOverride={scenarioAnnualOverride}
      />
    </Dialog>
  )
}
