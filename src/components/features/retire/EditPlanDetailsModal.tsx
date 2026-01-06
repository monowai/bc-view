import React, { useState, useEffect } from "react"
import { RetirementPlan } from "types/retirement"
import { ScenarioOverrides } from "./types"

interface EditFormData {
  pensionMonthly: number
  socialSecurityMonthly: number
  otherIncomeMonthly: number
  monthlyExpenses: number
  equityReturnRate: number
  cashReturnRate: number
  housingReturnRate: number
  inflationRate: number
  targetBalance: number
}

interface EditPlanDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (overrides: ScenarioOverrides) => void
  plan: RetirementPlan
}

export default function EditPlanDetailsModal({
  isOpen,
  onClose,
  onApply,
  plan,
}: EditPlanDetailsModalProps): React.ReactElement | null {
  const [formData, setFormData] = useState<EditFormData>({
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    monthlyExpenses: 0,
    equityReturnRate: 0,
    cashReturnRate: 0,
    housingReturnRate: 0,
    inflationRate: 0,
    targetBalance: 0,
  })

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && plan) {
      setFormData({
        pensionMonthly: plan.pensionMonthly,
        socialSecurityMonthly: plan.socialSecurityMonthly,
        otherIncomeMonthly: plan.otherIncomeMonthly ?? 0,
        monthlyExpenses: plan.monthlyExpenses,
        equityReturnRate: plan.equityReturnRate * 100, // Convert to percentage
        cashReturnRate: plan.cashReturnRate * 100,
        housingReturnRate: plan.housingReturnRate * 100,
        inflationRate: plan.inflationRate * 100,
        targetBalance: plan.targetBalance ?? 0,
      })
    }
  }, [isOpen, plan])

  if (!isOpen) return null

  const handleApply = (): void => {
    onApply({
      pensionMonthly: formData.pensionMonthly,
      socialSecurityMonthly: formData.socialSecurityMonthly,
      otherIncomeMonthly: formData.otherIncomeMonthly,
      monthlyExpenses: formData.monthlyExpenses,
      equityReturnRate: formData.equityReturnRate / 100, // Convert back to decimal
      cashReturnRate: formData.cashReturnRate / 100,
      housingReturnRate: formData.housingReturnRate / 100,
      inflationRate: formData.inflationRate / 100,
      targetBalance: formData.targetBalance || undefined,
    })
    onClose()
  }

  const netMonthlyNeed =
    formData.monthlyExpenses -
    formData.pensionMonthly -
    formData.socialSecurityMonthly -
    formData.otherIncomeMonthly

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Plan Details
        </h2>

        <div className="space-y-4">
          {/* Pension */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pension (Monthly)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={formData.pensionMonthly}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    pensionMonthly: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                step={100}
              />
            </div>
          </div>

          {/* Government Benefits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Government Benefits (Monthly)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={formData.socialSecurityMonthly}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    socialSecurityMonthly: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                step={100}
              />
            </div>
          </div>

          {/* Other Income */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Income (Monthly)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={formData.otherIncomeMonthly}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    otherIncomeMonthly: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                step={100}
              />
            </div>
          </div>

          {/* Monthly Expenses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Expenses
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={formData.monthlyExpenses}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    monthlyExpenses: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                step={100}
              />
            </div>
          </div>

          {/* Return Rates */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Return Rates
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Equity
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.equityReturnRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        equityReturnRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min={0}
                    max={30}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cash</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.cashReturnRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cashReturnRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Housing
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.housingReturnRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        housingReturnRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Inflation Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inflation Rate (%)
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.inflationRate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    inflationRate: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full pl-4 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                max={20}
                step={0.1}
              />
              <span className="absolute right-3 top-2.5 text-gray-500">%</span>
            </div>
          </div>

          {/* Target Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Balance (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={formData.targetBalance || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    targetBalance: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0"
                className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                min={0}
                step={10000}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Minimum balance to maintain at end of life
            </p>
          </div>

          {/* Net Monthly Need Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Net Monthly Need</span>
              <span className="font-medium text-orange-600">
                ${netMonthlyNeed.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <i className="fas fa-check mr-2"></i>
            Apply
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Changes will update the projection. Use &quot;Save Scenario&quot; to
          persist.
        </p>
      </div>
    </div>
  )
}
