import React, { useState, useCallback, useMemo } from "react"
import { PolicyType, SubAccountRequest, TaxTreatment } from "types/beancounter"
import TouchDatePicker from "@components/ui/TouchDatePicker"
import MathInput from "@components/ui/MathInput"

/**
 * CPF default sub-accounts with Board-published interest rates (as of 2024).
 */
const CPF_TEMPLATE: SubAccountRequest[] = [
  {
    code: "OA",
    displayName: "Ordinary Account",
    balance: 0,
    expectedReturnRate: 0.025,
    liquid: true,
  },
  {
    code: "SA",
    displayName: "Special Account",
    balance: 0,
    expectedReturnRate: 0.04,
    liquid: true,
  },
  {
    code: "MA",
    displayName: "Medisave Account",
    balance: 0,
    expectedReturnRate: 0.04,
    liquid: false,
  },
  {
    code: "RA",
    displayName: "Retirement Account",
    balance: 0,
    expectedReturnRate: 0.04,
    liquid: true,
  },
]

/**
 * US 401(k)/IRA + UK ISA default to a single sub-account holding the whole
 * balance — unlike CPF's prescribed OA/SA/MA/RA split, these wrappers don't
 * have statutory buckets.
 */
const SINGLE_ACCOUNT_TEMPLATE: SubAccountRequest[] = [
  { code: "BAL", displayName: "Balance", balance: 0, liquid: true },
]

const POLICY_TYPE_OPTIONS: { value: PolicyType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "ILP", label: "Investment-Linked Policy" },
  { value: "GENERIC", label: "Generic Composite" },
  { value: "US_401K", label: "US 401(k)" },
  { value: "US_IRA", label: "US IRA" },
  { value: "UK_ISA", label: "UK ISA" },
]

type CpfLifePlan = "STANDARD" | "BASIC" | "ESCALATING"

const CPF_LIFE_PLAN_OPTIONS: {
  value: CpfLifePlan
  label: string
  description: string
}[] = [
  {
    value: "STANDARD",
    label: "Standard",
    description: "Level monthly payouts for life",
  },
  {
    value: "BASIC",
    label: "Basic",
    description:
      "Higher bequest, lower payouts with longevity insurance from 90",
  },
  {
    value: "ESCALATING",
    label: "Escalating",
    description: "Payouts grow 2%/year, starting ~20% lower",
  },
]

export interface CompositeAssetEditorProps {
  policyType: PolicyType | undefined
  lockedUntilDate: string
  subAccounts: SubAccountRequest[]
  cpfLifePlan?: CpfLifePlan
  cpfPayoutStartAge?: number
  // US 401(k)/IRA + UK ISA wrapper settings. Decimals (e.g. 0.06 = 6%).
  taxTreatment?: TaxTreatment
  employeeDeferralPercent?: number
  employerMatchPercent?: number
  employerMatchCapPercent?: number
  withdrawalTaxRate?: number
  onPolicyTypeChange: (value: PolicyType | undefined) => void
  onLockedUntilDateChange: (value: string) => void
  onSubAccountsChange: (accounts: SubAccountRequest[]) => void
  onCpfLifePlanChange?: (value: CpfLifePlan | undefined) => void
  onCpfPayoutStartAgeChange?: (value: number | undefined) => void
  onTaxTreatmentChange?: (value: TaxTreatment | undefined) => void
  onEmployeeDeferralPercentChange?: (value: number | undefined) => void
  onEmployerMatchPercentChange?: (value: number | undefined) => void
  onEmployerMatchCapPercentChange?: (value: number | undefined) => void
  onWithdrawalTaxRateChange?: (value: number | undefined) => void
}

export default function CompositeAssetEditor({
  policyType,
  lockedUntilDate,
  subAccounts,
  cpfLifePlan,
  cpfPayoutStartAge,
  taxTreatment,
  employeeDeferralPercent,
  employerMatchPercent,
  employerMatchCapPercent,
  withdrawalTaxRate,
  onPolicyTypeChange,
  onLockedUntilDateChange,
  onSubAccountsChange,
  onCpfLifePlanChange,
  onCpfPayoutStartAgeChange,
  onTaxTreatmentChange,
  onEmployeeDeferralPercentChange,
  onEmployerMatchPercentChange,
  onEmployerMatchCapPercentChange,
  onWithdrawalTaxRateChange,
}: CompositeAssetEditorProps): React.ReactElement {
  const [newCode, setNewCode] = useState("")

  const totalBalance = useMemo(
    () => subAccounts.reduce((sum, a) => sum + (a.balance || 0), 0),
    [subAccounts],
  )

  const liquidBalance = useMemo(
    () =>
      subAccounts
        .filter((a) => a.liquid !== false)
        .reduce((sum, a) => sum + (a.balance || 0), 0),
    [subAccounts],
  )

  const handleAddSubAccount = useCallback(() => {
    const code = newCode.trim().toUpperCase()
    if (!code) return
    if (subAccounts.some((a) => a.code.toUpperCase() === code)) return
    onSubAccountsChange([...subAccounts, { code, balance: 0, liquid: true }])
    setNewCode("")
  }, [newCode, subAccounts, onSubAccountsChange])

  const handleRemoveSubAccount = useCallback(
    (index: number) => {
      onSubAccountsChange(subAccounts.filter((_, i) => i !== index))
    },
    [subAccounts, onSubAccountsChange],
  )

  const handleSubAccountChange = useCallback(
    (index: number, field: keyof SubAccountRequest, value: unknown) => {
      const updated = [...subAccounts]
      updated[index] = { ...updated[index], [field]: value }
      onSubAccountsChange(updated)
    },
    [subAccounts, onSubAccountsChange],
  )

  const isComposite = policyType !== undefined
  const isCpf = policyType === "CPF"
  const isUsWrapper = policyType === "US_401K" || policyType === "US_IRA"

  // CPF LIFE settings (cpfLifePlan/cpfPayoutStartAge) are CPF-only — clear
  // them when switching to any other policy type.
  const clearCpfOnlyFields = (): void => {
    if (cpfLifePlan) {
      onCpfLifePlanChange?.(undefined)
    }
    if (cpfPayoutStartAge != null) {
      onCpfPayoutStartAgeChange?.(undefined)
    }
  }

  // US 401(k)/IRA/ISA wrapper settings — clear when switching to CPF/ILP/
  // Generic/None so they can't leak into an unrelated policy's save.
  const clearWrapperFields = (): void => {
    if (taxTreatment) {
      onTaxTreatmentChange?.(undefined)
    }
    if (employeeDeferralPercent != null) {
      onEmployeeDeferralPercentChange?.(undefined)
    }
    if (employerMatchPercent != null) {
      onEmployerMatchPercentChange?.(undefined)
    }
    if (employerMatchCapPercent != null) {
      onEmployerMatchCapPercentChange?.(undefined)
    }
    if (withdrawalTaxRate != null) {
      onWithdrawalTaxRateChange?.(undefined)
    }
  }

  return (
    <div className="space-y-4">
      {/* Policy Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Composite Policy Type
        </label>
        <div className="flex items-center space-x-2">
          <select
            value={policyType || ""}
            onChange={(e) => {
              const val = e.target.value as PolicyType | ""
              onPolicyTypeChange(val === "" ? undefined : val)
              // Changing the policy type resets the sub-accounts to the new
              // type's default template. Safe to reset unconditionally: this
              // onChange only fires on an explicit user change, never on
              // initial load of an existing asset.
              if (val === "CPF") {
                // CPF is fully prescribed: apply the OA/SA/MA/RA template (the
                // user can't add codes) and default CPF LIFE to Standard —
                // otherwise svc-retire's enrichCpfConfigs reports zero pension
                // income. Keep an already-chosen plan (BASIC/ESCALATING).
                onSubAccountsChange(CPF_TEMPLATE.map((t) => ({ ...t })))
                if (!cpfLifePlan) {
                  onCpfLifePlanChange?.("STANDARD")
                }
                // CPF's lock is statutory and the field is hidden — drop any
                // manual lock date carried over from a previous policy type so
                // it can't leak into the CPF save.
                if (lockedUntilDate) {
                  onLockedUntilDateChange("")
                }
                clearWrapperFields()
              } else if (val === "US_401K" || val === "US_IRA") {
                // No statutory buckets — start from a single Balance
                // sub-account and default to TRADITIONAL (svc-retire projects
                // net of withdrawalTaxRate for TRADITIONAL, 1:1 for ROTH).
                // Keep an already-chosen treatment (e.g. re-selecting IRA
                // after ROTH).
                onSubAccountsChange(
                  SINGLE_ACCOUNT_TEMPLATE.map((t) => ({ ...t })),
                )
                if (!taxTreatment) {
                  onTaxTreatmentChange?.("TRADITIONAL")
                }
                clearCpfOnlyFields()
              } else if (val === "UK_ISA") {
                // ISA is always tax-free — not a user choice — so force
                // TAX_FREE unconditionally rather than only-if-unset.
                onSubAccountsChange(
                  SINGLE_ACCOUNT_TEMPLATE.map((t) => ({ ...t })),
                )
                onTaxTreatmentChange?.("TAX_FREE")
                onEmployeeDeferralPercentChange?.(undefined)
                onEmployerMatchPercentChange?.(undefined)
                onEmployerMatchCapPercentChange?.(undefined)
                onWithdrawalTaxRateChange?.(undefined)
                clearCpfOnlyFields()
              } else {
                // ILP / Generic / None have no prescribed buckets — start from
                // an empty template and drop CPF-only and wrapper settings.
                if (subAccounts.length > 0) {
                  onSubAccountsChange([])
                }
                clearCpfOnlyFields()
                clearWrapperFields()
              }
            }}
            className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">None (Simple Asset)</option>
            {POLICY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Select a policy type to manage sub-account balances.
        </p>
      </div>

      {isComposite && (
        <>
          {/* Locked Until Date — CPF has a statutory lock, so we don't prompt
              for it; only non-CPF composites expose a manual lock date. */}
          {policyType !== "CPF" && (
            <TouchDatePicker
              value={lockedUntilDate}
              onChange={onLockedUntilDateChange}
              label="Locked Until Date"
              hint="Asset cannot be liquidated before this date."
              minYear={new Date().getFullYear()}
              maxYear={new Date().getFullYear() + 40}
            />
          )}

          {/* CPF LIFE Settings */}
          {policyType === "CPF" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-medium text-blue-800">
                CPF LIFE Settings
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    CPF LIFE Plan
                  </label>
                  <select
                    value={cpfLifePlan || ""}
                    onChange={(e) => {
                      const val = e.target.value as CpfLifePlan | ""
                      onCpfLifePlanChange?.(val === "" ? undefined : val)
                    }}
                    className="w-full border-blue-300 rounded px-2 py-1.5 border text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Not set</option>
                    {CPF_LIFE_PLAN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {cpfLifePlan ? (
                    <p className="text-xs text-blue-600 mt-1">
                      {
                        CPF_LIFE_PLAN_OPTIONS.find(
                          (o) => o.value === cpfLifePlan,
                        )?.description
                      }
                    </p>
                  ) : (
                    // Surface the silent enrichment skip: svc-retire's
                    // enrichCpfConfigs only computes monthlyPayoutAmount
                    // when cpfLifePlan is set, so an unset plan reports
                    // zero pension income in projections without any
                    // visible cue. Amber inline; not a save block.
                    <p
                      role="alert"
                      className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1"
                    >
                      <i className="fas fa-triangle-exclamation mr-1"></i>
                      CPF LIFE Plan required for projected payout — pick one or
                      pension income stays zero.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Payout Start Age
                  </label>
                  <input
                    type="number"
                    min={65}
                    max={70}
                    value={cpfPayoutStartAge ?? 65}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      onCpfPayoutStartAgeChange?.(isNaN(val) ? undefined : val)
                    }}
                    className="w-full border-blue-300 rounded px-2 py-1.5 border text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Between 65 and 70. Delaying increases payouts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* US 401(k)/IRA Wrapper Settings — UK ISA has no user-facing tax
              fields (TAX_FREE is implied and forced above). */}
          {isUsWrapper && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3">
              <h4 className="text-sm font-medium text-emerald-800">
                Retirement Wrapper Settings
              </h4>
              <div>
                <span className="block text-xs font-medium text-emerald-700 mb-1">
                  Tax Treatment
                </span>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center text-sm text-emerald-700">
                    <input
                      type="radio"
                      name="taxTreatment"
                      value="TRADITIONAL"
                      checked={
                        (taxTreatment || "TRADITIONAL") === "TRADITIONAL"
                      }
                      onChange={() => onTaxTreatmentChange?.("TRADITIONAL")}
                      className="mr-1.5"
                    />
                    Traditional
                  </label>
                  <label className="flex items-center text-sm text-emerald-700">
                    <input
                      type="radio"
                      name="taxTreatment"
                      value="ROTH"
                      checked={taxTreatment === "ROTH"}
                      onChange={() => onTaxTreatmentChange?.("ROTH")}
                      className="mr-1.5"
                    />
                    Roth
                  </label>
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  Traditional projects withdrawals net of tax; Roth projects 1:1
                  (already taxed).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="employeeDeferralPercent"
                    className="block text-xs font-medium text-emerald-700 mb-1"
                  >
                    Employee Deferral %
                  </label>
                  <input
                    id="employeeDeferralPercent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={
                      employeeDeferralPercent != null
                        ? Math.round(employeeDeferralPercent * 1000) / 10
                        : ""
                    }
                    onChange={(e) =>
                      onEmployeeDeferralPercentChange?.(
                        e.target.value
                          ? parseFloat(e.target.value) / 100
                          : undefined,
                      )
                    }
                    placeholder="--"
                    className="w-full border-emerald-300 rounded px-2 py-1.5 border text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="employerMatchPercent"
                    className="block text-xs font-medium text-emerald-700 mb-1"
                  >
                    Employer Match %
                  </label>
                  <input
                    id="employerMatchPercent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={
                      employerMatchPercent != null
                        ? Math.round(employerMatchPercent * 1000) / 10
                        : ""
                    }
                    onChange={(e) =>
                      onEmployerMatchPercentChange?.(
                        e.target.value
                          ? parseFloat(e.target.value) / 100
                          : undefined,
                      )
                    }
                    placeholder="--"
                    className="w-full border-emerald-300 rounded px-2 py-1.5 border text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="employerMatchCapPercent"
                    className="block text-xs font-medium text-emerald-700 mb-1"
                  >
                    Match Cap % (of salary)
                  </label>
                  <input
                    id="employerMatchCapPercent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={
                      employerMatchCapPercent != null
                        ? Math.round(employerMatchCapPercent * 1000) / 10
                        : ""
                    }
                    onChange={(e) =>
                      onEmployerMatchCapPercentChange?.(
                        e.target.value
                          ? parseFloat(e.target.value) / 100
                          : undefined,
                      )
                    }
                    placeholder="--"
                    className="w-full border-emerald-300 rounded px-2 py-1.5 border text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <p className="text-xs text-emerald-600">
                Match = min(deferral, cap % of salary) × match %.
              </p>
              {/* Withdrawal tax rate only applies when withdrawals are
                  taxable — Roth is already taxed, so hide it. */}
              {(taxTreatment || "TRADITIONAL") !== "ROTH" && (
                <div>
                  <label
                    htmlFor="withdrawalTaxRate"
                    className="block text-xs font-medium text-emerald-700 mb-1"
                  >
                    Withdrawal Tax Rate %
                  </label>
                  <input
                    id="withdrawalTaxRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={
                      withdrawalTaxRate != null
                        ? Math.round(withdrawalTaxRate * 1000) / 10
                        : ""
                    }
                    onChange={(e) =>
                      onWithdrawalTaxRateChange?.(
                        e.target.value
                          ? parseFloat(e.target.value) / 100
                          : undefined,
                      )
                    }
                    placeholder="22"
                    className="w-full border-emerald-300 rounded px-2 py-1.5 border text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-xs text-emerald-600 mt-1">
                    Applied to projected withdrawals. Defaults to 22% if left
                    blank.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sub-Accounts Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Code
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">
                    Balance
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">
                    Return %
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">
                    Fee %
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subAccounts.map((account, index) => (
                  <tr key={account.code} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div>
                        <span className="font-medium text-gray-900">
                          {account.code}
                        </span>
                        {account.displayName && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({account.displayName})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <MathInput
                        aria-label={`${account.code} balance`}
                        step="100"
                        value={account.balance || ""}
                        onChange={(val) =>
                          handleSubAccountChange(index, "balance", val)
                        }
                        placeholder="0"
                        className="w-full min-w-[6rem] text-right border-gray-300 rounded px-2 py-1.5 border focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={
                          account.expectedReturnRate != null
                            ? Math.round(account.expectedReturnRate * 1000) / 10
                            : ""
                        }
                        onChange={(e) =>
                          handleSubAccountChange(
                            index,
                            "expectedReturnRate",
                            e.target.value
                              ? parseFloat(e.target.value) / 100
                              : null,
                          )
                        }
                        placeholder="--"
                        className="w-full min-w-[4.5rem] text-right border-gray-300 rounded px-2 py-1.5 border focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          account.feeRate != null
                            ? Math.round(account.feeRate * 1000) / 10
                            : ""
                        }
                        onChange={(e) =>
                          handleSubAccountChange(
                            index,
                            "feeRate",
                            e.target.value
                              ? parseFloat(e.target.value) / 100
                              : null,
                          )
                        }
                        placeholder="--"
                        className="w-full min-w-[4.5rem] text-right border-gray-300 rounded px-2 py-1.5 border focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {!isCpf && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubAccount(index)}
                          className="text-red-400 hover:text-red-600"
                          title="Remove sub-account"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {subAccounts.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                No sub-accounts. Add one below or apply a template.
              </div>
            )}
          </div>

          {/* Add Sub-Account Row — CPF's sub-accounts are fixed (OA/SA/MA/RA),
              so adding codes is disabled for CPF. */}
          {!isCpf && (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddSubAccount()
                  }
                }}
                placeholder="Sub-account code"
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <button
                type="button"
                onClick={handleAddSubAccount}
                disabled={!newCode.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-plus mr-1"></i>
                Add
              </button>
            </div>
          )}

          {/* Balance Summary */}
          {subAccounts.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Balance</span>
                <span className="font-medium text-gray-900">
                  $
                  {totalBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {liquidBalance !== totalBalance && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Liquid Balance</span>
                  <span className="font-medium text-green-700">
                    $
                    {liquidBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
