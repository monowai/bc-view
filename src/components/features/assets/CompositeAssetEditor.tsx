import React, { useState, useCallback, useMemo } from "react"
import { PolicyType, SubAccountRequest } from "types/beancounter"
import TouchDatePicker from "@components/ui/TouchDatePicker"

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

const POLICY_TYPE_OPTIONS: { value: PolicyType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "ILP", label: "Investment-Linked Policy" },
  { value: "GENERIC", label: "Generic Composite" },
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
  onPolicyTypeChange: (value: PolicyType | undefined) => void
  onLockedUntilDateChange: (value: string) => void
  onSubAccountsChange: (accounts: SubAccountRequest[]) => void
  onCpfLifePlanChange?: (value: CpfLifePlan | undefined) => void
  onCpfPayoutStartAgeChange?: (value: number | undefined) => void
}

export default function CompositeAssetEditor({
  policyType,
  lockedUntilDate,
  subAccounts,
  cpfLifePlan,
  cpfPayoutStartAge,
  onPolicyTypeChange,
  onLockedUntilDateChange,
  onSubAccountsChange,
  onCpfLifePlanChange,
  onCpfPayoutStartAgeChange,
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

  const handleApplyTemplate = useCallback(
    (template: SubAccountRequest[]) => {
      onSubAccountsChange(template.map((t) => ({ ...t })))
    },
    [onSubAccountsChange],
  )

  const isComposite = policyType !== undefined

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
              if (val === "" && subAccounts.length > 0) {
                onSubAccountsChange([])
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
          {/* Locked Until Date - Touch-friendly picker */}
          <TouchDatePicker
            value={lockedUntilDate}
            onChange={onLockedUntilDateChange}
            label="Locked Until Date"
            hint="Asset cannot be liquidated before this date."
            minYear={new Date().getFullYear()}
            maxYear={new Date().getFullYear() + 40}
          />

          {/* Template Buttons */}
          <div className="flex space-x-2">
            {policyType === "CPF" && (
              <button
                type="button"
                onClick={() => handleApplyTemplate(CPF_TEMPLATE)}
                className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <i className="fas fa-magic mr-1"></i>
                Apply CPF Template
              </button>
            )}
          </div>

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
                  {cpfLifePlan && (
                    <p className="text-xs text-blue-600 mt-1">
                      {
                        CPF_LIFE_PLAN_OPTIONS.find(
                          (o) => o.value === cpfLifePlan,
                        )?.description
                      }
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
                  <th className="text-center px-3 py-2 font-medium text-gray-600">
                    Liquid
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
                      <input
                        type="number"
                        step="100"
                        value={account.balance || ""}
                        onChange={(e) =>
                          handleSubAccountChange(
                            index,
                            "balance",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="0"
                        className="w-full text-right border-gray-300 rounded px-2 py-1 border focus:ring-indigo-500 focus:border-indigo-500"
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
                        className="w-full text-right border-gray-300 rounded px-2 py-1 border focus:ring-indigo-500 focus:border-indigo-500"
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
                        className="w-full text-right border-gray-300 rounded px-2 py-1 border focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={account.liquid !== false}
                        onChange={(e) =>
                          handleSubAccountChange(
                            index,
                            "liquid",
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveSubAccount(index)}
                        className="text-red-400 hover:text-red-600"
                        title="Remove sub-account"
                      >
                        <i className="fas fa-times"></i>
                      </button>
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

          {/* Add Sub-Account Row */}
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
