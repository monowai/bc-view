import React from "react"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import Dialog from "@components/ui/Dialog"

/**
 * Per-asset balance-projection modal opened from a ScenarioContributions
 * row. Shows a year-by-year table of how the asset's balance is expected
 * to evolve until payout age, plus a banner reminding the user that the
 * starting balance is the figure they entered when the asset was created
 * — there's currently no in-app way to refresh it, so the projection
 * starts from whatever was true at that point in time.
 */

interface CpfYearlyBalance {
  age: number
  oa: number
  sa: number
  ma: number
  ra: number
  annualContribution: number
}

interface PolicyYearlyBalance {
  age: number
  balance: number
  annualContribution: number
}

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
  const isCpf = asset.policyType === "CPF"
  const payoutAge = asset.payoutAge ?? 65

  const subBalanceFor = (code: string): number =>
    asset.subAccounts?.find((s) => s.code === code)?.balance ?? 0

  const cpfKey = isCpf
    ? `/api/independence/cpf/balance-series?currentAge=${currentAge}` +
      `&payoutAge=${payoutAge}` +
      `&oa=${subBalanceFor("OA")}&sa=${subBalanceFor("SA")}` +
      `&ma=${subBalanceFor("MA")}&ra=${subBalanceFor("RA")}` +
      (scenarioMonthlySalary
        ? `&monthlySalary=${scenarioMonthlySalary}`
        : "") +
      (scenarioAnnualOverride
        ? `&annualContributionOverride=${scenarioAnnualOverride}`
        : "") +
      (asset.cpfLifePlan ? `&cpfLifePlan=${asset.cpfLifePlan}` : "")
    : null

  // Scenario override wins for the non-CPF projection too: the user-entered
  // amount in this scenario edit should drive the table, not the stale asset
  // default. Convert the annual override back to a monthly figure (the
  // endpoint takes monthlyContribution); fall through to asset default when
  // the user has cleared the row.
  const policyMonthly =
    scenarioAnnualOverride && scenarioAnnualOverride > 0
      ? scenarioAnnualOverride / 12
      : (asset.monthlyContribution ?? 0)
  const policyKey = !isCpf
    ? `/api/independence/cpf/policy-balance-series?currentAge=${currentAge}` +
      `&payoutAge=${payoutAge}` +
      `&startingBalance=${subBalanceFor("BALANCE") || 0}` +
      `&monthlyContribution=${policyMonthly}` +
      `&expectedReturnRate=${asset.expectedReturnRate ?? 0}`
    : null

  const { data: cpfData } = useSWR<{ data: CpfYearlyBalance[] } | CpfYearlyBalance[]>(
    cpfKey,
    simpleFetcher,
  )
  const { data: policyData } = useSWR<
    { data: PolicyYearlyBalance[] } | PolicyYearlyBalance[]
  >(policyKey, simpleFetcher)

  // Endpoints return arrays directly, but SWR-via-proxy may wrap in { data }.
  const cpfSeries: CpfYearlyBalance[] = Array.isArray(cpfData)
    ? cpfData
    : (cpfData?.data ?? [])
  const policySeries: PolicyYearlyBalance[] = Array.isArray(policyData)
    ? policyData
    : (policyData?.data ?? [])

  const fmt = (n: number): string =>
    `${currency} ${Math.round(n).toLocaleString()}`

  return (
    <Dialog
      title={`Projection · ${asset.assetName}`}
      onClose={onClose}
      maxWidth="lg"
      scrollable
      footer={<Dialog.CancelButton onClick={onClose} label="Close" />}
    >
      <div
        role="alert"
        className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3"
      >
        Starting balance is the figure you entered when the asset was last
        edited
        {asset.updatedDate ? ` (${asset.updatedDate})` : ""}. There&rsquo;s
        currently no in-app way to refresh it, so the projection grows from
        that snapshot — actual balances may already be higher.
      </div>

      {isCpf ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1">Age</th>
              <th className="py-1 text-right">OA</th>
              <th className="py-1 text-right">SA</th>
              <th className="py-1 text-right">MA</th>
              <th className="py-1 text-right">RA</th>
              <th className="py-1 text-right">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {cpfSeries.map((row) => (
              <tr key={row.age} className="border-b last:border-b-0">
                <td className="py-1">{row.age}</td>
                <td className="py-1 text-right">{fmt(row.oa)}</td>
                <td className="py-1 text-right">{fmt(row.sa)}</td>
                <td className="py-1 text-right">{fmt(row.ma)}</td>
                <td className="py-1 text-right">{fmt(row.ra)}</td>
                <td className="py-1 text-right text-gray-500">
                  {row.annualContribution > 0 ? fmt(row.annualContribution) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1">Age</th>
              <th className="py-1 text-right">Balance</th>
              <th className="py-1 text-right">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {policySeries.map((row) => (
              <tr key={row.age} className="border-b last:border-b-0">
                <td className="py-1">{row.age}</td>
                <td className="py-1 text-right">{fmt(row.balance)}</td>
                <td className="py-1 text-right text-gray-500">
                  {row.annualContribution > 0 ? fmt(row.annualContribution) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  )
}
