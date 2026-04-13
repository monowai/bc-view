import React, { useState, useEffect, useCallback } from "react"
import { WorkScenario, WorkScenarioRequest } from "types/independence"
import Dialog from "@components/ui/Dialog"

interface ScenarioEditorProps {
  scenario?: WorkScenario | null
  onSave: (data: WorkScenarioRequest) => Promise<void>
  onClose: () => void
}

const DEFAULT_FORM: WorkScenarioRequest = {
  name: "",
  workingIncomeMonthly: 0,
  workingExpensesMonthly: 0,
  taxesMonthly: 0,
  bonusMonthly: 0,
  investmentAllocationPercent: 80,
  currency: "NZD",
}

function computeContribution(form: WorkScenarioRequest): number {
  const income = (form.workingIncomeMonthly || 0) + (form.bonusMonthly || 0)
  const outgoings =
    (form.workingExpensesMonthly || 0) + (form.taxesMonthly || 0)
  const surplus = income - outgoings
  const pct = (form.investmentAllocationPercent || 0) / 100
  return Math.round(surplus * pct)
}

export default function ScenarioEditor({
  scenario,
  onSave,
  onClose,
}: ScenarioEditorProps): React.ReactElement {
  const isEditing = !!scenario
  const [form, setForm] = useState<WorkScenarioRequest>(DEFAULT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (scenario) {
      setForm({
        name: scenario.name,
        workingIncomeMonthly: scenario.workingIncomeMonthly,
        workingExpensesMonthly: scenario.workingExpensesMonthly,
        taxesMonthly: scenario.taxesMonthly,
        bonusMonthly: scenario.bonusMonthly,
        investmentAllocationPercent: scenario.investmentAllocationPercent,
        currency: scenario.currency,
      })
    }
  }, [scenario])

  const handleChange = useCallback(
    (field: keyof WorkScenarioRequest, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save scenario"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const contribution = computeContribution(form)

  return (
    <Dialog
      title={isEditing ? "Edit Scenario" : "Create Scenario"}
      onClose={onClose}
      maxWidth="md"
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSubmit}
            label={isEditing ? "Save" : "Create"}
            loadingLabel="Saving..."
            isSubmitting={isSubmitting}
            disabled={!form.name.trim()}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            placeholder="e.g. Full-time NZ"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Income
            </label>
            <input
              type="number"
              min={0}
              value={form.workingIncomeMonthly ?? 0}
              onChange={(e) =>
                handleChange(
                  "workingIncomeMonthly",
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Expenses
            </label>
            <input
              type="number"
              min={0}
              value={form.workingExpensesMonthly ?? 0}
              onChange={(e) =>
                handleChange(
                  "workingExpensesMonthly",
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Taxes
            </label>
            <input
              type="number"
              min={0}
              value={form.taxesMonthly ?? 0}
              onChange={(e) =>
                handleChange("taxesMonthly", parseFloat(e.target.value) || 0)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Bonus (avg)
            </label>
            <input
              type="number"
              min={0}
              value={form.bonusMonthly ?? 0}
              onChange={(e) =>
                handleChange("bonusMonthly", parseFloat(e.target.value) || 0)
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Investment Allocation %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.investmentAllocationPercent ?? 80}
              onChange={(e) =>
                handleChange(
                  "investmentAllocationPercent",
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              % of surplus allocated to investments
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <input
              type="text"
              value={form.currency ?? "NZD"}
              onChange={(e) =>
                handleChange("currency", e.target.value.toUpperCase())
              }
              maxLength={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              placeholder="NZD"
            />
          </div>
        </div>

        <div className="bg-gradient-to-r from-independence-50 to-independence-100 rounded-lg p-3 border border-independence-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              <i className="fas fa-piggy-bank text-independence-500 mr-1"></i>
              Computed Monthly Contribution
            </span>
            <span
              className={`font-bold ${
                contribution >= 0 ? "text-independence-600" : "text-red-600"
              }`}
            >
              {form.currency || "$"}
              {Math.abs(contribution).toLocaleString()}
              {contribution < 0 && (
                <span className="text-xs font-normal text-red-500 ml-1">
                  (deficit)
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            (Income + Bonus - Expenses - Taxes) x{" "}
            {form.investmentAllocationPercent ?? 80}%
          </p>
        </div>
      </div>
    </Dialog>
  )
}
