import React from "react"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

/**
 * Year-by-year balance projection body for a pension asset. Extracted
 * from PensionProjectionModal so the same view can render inline as a
 * tab in EditAccountDialog as well as inside the scenario modal.
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

export interface PensionProjectionPanelProps {
  policyType?: string
  cpfLifePlan?: string
  payoutAge?: number
  expectedReturnRate?: number
  monthlyContribution?: number
  /** Snapshot date for the starting balance — used in the stale-balance banner. */
  updatedDate?: string
  /** CPF only: starting OA / SA / MA / RA balances. */
  subAccounts?: { code: string; balance: number }[]
  currency: string
  currentAge: number
  scenarioMonthlySalary?: number
  scenarioAnnualOverride?: number
}

export default function PensionProjectionPanel({
  policyType,
  cpfLifePlan,
  payoutAge: payoutAgeProp,
  expectedReturnRate,
  monthlyContribution,
  updatedDate,
  subAccounts,
  currency,
  currentAge,
  scenarioMonthlySalary,
  scenarioAnnualOverride,
}: PensionProjectionPanelProps): React.ReactElement {
  const isCpf = policyType === "CPF"
  const payoutAge = payoutAgeProp ?? 65

  const subBalanceFor = (code: string): number =>
    subAccounts?.find((s) => s.code === code)?.balance ?? 0

  const cpfKey = isCpf
    ? `/api/independence/cpf/balance-series?currentAge=${currentAge}` +
      `&payoutAge=${payoutAge}` +
      `&oa=${subBalanceFor("OA")}&sa=${subBalanceFor("SA")}` +
      `&ma=${subBalanceFor("MA")}&ra=${subBalanceFor("RA")}` +
      (scenarioMonthlySalary ? `&monthlySalary=${scenarioMonthlySalary}` : "") +
      (scenarioAnnualOverride
        ? `&annualContributionOverride=${scenarioAnnualOverride}`
        : "") +
      (cpfLifePlan ? `&cpfLifePlan=${cpfLifePlan}` : "")
    : null

  const policyMonthly =
    scenarioAnnualOverride && scenarioAnnualOverride > 0
      ? scenarioAnnualOverride / 12
      : (monthlyContribution ?? 0)
  const policyKey = !isCpf
    ? `/api/independence/cpf/policy-balance-series?currentAge=${currentAge}` +
      `&payoutAge=${payoutAge}` +
      `&startingBalance=${subBalanceFor("BALANCE") || 0}` +
      `&monthlyContribution=${policyMonthly}` +
      `&expectedReturnRate=${expectedReturnRate ?? 0}`
    : null

  const { data: cpfData } = useSWR<
    { data: CpfYearlyBalance[] } | CpfYearlyBalance[]
  >(cpfKey, simpleFetcher)
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
    <div>
      <div
        role="alert"
        className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3"
      >
        Starting balance is the figure you entered when the asset was last
        edited
        {updatedDate ? ` (${updatedDate})` : ""}. There&rsquo;s currently no
        in-app way to refresh it, so the projection grows from that snapshot —
        actual balances may already be higher.
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
                  {row.annualContribution > 0
                    ? fmt(row.annualContribution)
                    : "—"}
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
                  {row.annualContribution > 0
                    ? fmt(row.annualContribution)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
