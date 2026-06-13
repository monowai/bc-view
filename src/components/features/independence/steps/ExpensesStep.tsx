import React, { useEffect, useRef, useState } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useWatch,
  UseFormSetValue,
  UseFormGetValues,
} from "react-hook-form"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, CategoryLabelsResponse } from "types/independence"
import { wizardMessages } from "@lib/independence/messages"
import MathInput from "@components/ui/MathInput"
import Spinner from "@components/ui/Spinner"

const msg = wizardMessages.steps.expenses

interface ExpensesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  getValues: UseFormGetValues<WizardFormData>
  isEditMode?: boolean
}

const categoriesKey = "/api/independence/categories"

export default function ExpensesStep({
  control,
  errors,
  setValue,
  getValues,
  isEditMode,
}: ExpensesStepProps): React.ReactElement {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "expenses",
  })
  const hasInitialized = useRef(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState("")
  const [copyPercent, setCopyPercent] = useState(80)
  const [copyApplied, setCopyApplied] = useState(false)

  const { data: categoriesData } = useSwr<CategoryLabelsResponse>(
    categoriesKey,
    simpleFetcher(categoriesKey),
  )

  const categories = categoriesData?.data || []
  const systemCategories = categories.filter(
    (c) => c.ownerId === "SYSTEM" || c.ownerId === "system",
  )
  const expenses = useWatch({ control, name: "expenses" }) || []

  const workingExpenses = getValues("workingExpenses") || []
  const hasWorkingExpenses = workingExpenses.some(
    (e) => (e?.monthlyAmount || 0) > 0,
  )
  const allRetirementExpensesZero = expenses.every(
    (e) => (e?.monthlyAmount || 0) === 0,
  )
  const canCopyFromWorking = hasWorkingExpenses && allRetirementExpensesZero

  // Initialise / re-order expenses against canonical system-category sequence.
  // New plans get one row per category at zero. Edit plans get stored amounts
  // re-merged. Custom rows are appended at the end preserving relative order.
  useEffect(() => {
    if (systemCategories.length === 0 || hasInitialized.current) return
    hasInitialized.current = true

    const currentExpenses = getValues("expenses") || []
    const existingByCategory = new Map(
      currentExpenses.map((e) => [e.categoryLabelId, e]),
    )

    const merged = systemCategories.map((cat) => ({
      categoryLabelId: cat.id,
      categoryName: cat.name,
      monthlyAmount: existingByCategory.get(cat.id)?.monthlyAmount ?? 0,
    }))

    const customExpenses = currentExpenses.filter((e) =>
      e.categoryLabelId.startsWith("custom-"),
    )

    setValue("expenses", [...merged, ...customExpenses])
  }, [systemCategories, setValue, getValues])

  const totalMonthlyExpenses = expenses.reduce(
    (sum, expense) => sum + (expense?.monthlyAmount || 0),
    0,
  )

  const applyCopyFromWorking = (percent: number): void => {
    const working = getValues("workingExpenses") || []
    const workingMap = new Map(
      working
        .filter((e) => (e?.monthlyAmount || 0) > 0)
        .map((e) => [e.categoryLabelId, e.monthlyAmount]),
    )

    const currentExpenses = getValues("expenses") || []
    const updated = currentExpenses.map((expense) => ({
      ...expense,
      monthlyAmount: workingMap.has(expense.categoryLabelId)
        ? Math.round((workingMap.get(expense.categoryLabelId)! * percent) / 100)
        : expense.monthlyAmount,
    }))
    setValue("expenses", updated)
    setCopyApplied(true)
    setTimeout(() => setCopyApplied(false), 3000)
  }

  const handleAddCustomCategory = (): void => {
    if (customCategoryName.trim()) {
      append({
        categoryLabelId: `custom-${Date.now()}`,
        categoryName: customCategoryName.trim(),
        monthlyAmount: 0,
      })
      setCustomCategoryName("")
      setShowAddCustom(false)
    }
  }

  const getCategoryDescription = (categoryId: string): string | undefined => {
    const category = categories.find((c) => c.id === categoryId)
    return category?.description
  }

  const isCustomCategory = (categoryId: string): boolean => {
    return categoryId.startsWith("custom-")
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {msg.title}
        </h2>
        <p className="text-sm text-gray-600">{msg.description}</p>
      </div>

      {/* Hero: Total monthly expenses */}
      <div className="rounded-xl border border-independence-200 bg-independence-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-independence-700">
              {msg.totalLabel}
            </p>
            <p className="mt-0.5 text-xs text-independence-500 max-w-xs leading-relaxed">
              {msg.totalHelper}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold tabular-nums text-independence-800">
              ${totalMonthlyExpenses.toLocaleString()}
            </p>
            <p className="text-xs text-independence-500 mt-0.5">per month</p>
          </div>
        </div>

        {/* Copy from working — surfaced when relevant */}
        {canCopyFromWorking && (
          <div className="mt-4 pt-4 border-t border-independence-200">
            <p className="text-xs text-independence-600 mb-2.5 font-medium">
              <i className="fas fa-copy mr-1.5"></i>
              You have working expenses on file — pre-fill from those?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-independence-700">Apply at</span>
              <div className="flex items-center gap-1">
                <MathInput
                  value={copyPercent}
                  onChange={setCopyPercent}
                  min={10}
                  max={100}
                  placeholder="80"
                  aria-label="Copy percentage"
                  className="w-16 px-2 py-1 text-sm text-center border border-independence-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                />
                <span className="text-sm text-independence-700">%</span>
              </div>
              <span className="text-sm text-independence-500">
                of working expenses
              </span>
              <button
                type="button"
                onClick={() => applyCopyFromWorking(copyPercent)}
                className="px-3 py-1.5 text-sm bg-independence-600 text-white rounded-lg hover:bg-independence-700 font-medium transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Copy success flash */}
        {copyApplied && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-independence-700">
            <i className="fas fa-check-circle"></i>
            <span>Working expenses applied at {copyPercent}%</span>
          </div>
        )}

        {/* Repeat copy trigger when already applied */}
        {hasWorkingExpenses && !canCopyFromWorking && (
          <div className="mt-4 pt-3 border-t border-independence-200">
            <button
              type="button"
              onClick={() => applyCopyFromWorking(copyPercent)}
              className="text-xs text-independence-600 hover:text-independence-800 flex items-center gap-1.5"
            >
              <i className="fas fa-copy"></i>
              Re-apply working expenses at {copyPercent}%
            </button>
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div>
        <p className="text-xs text-gray-500 mb-3">
          Adjust amounts by category to check nothing is missing:
        </p>

        <div className="space-y-2">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-gray-200">
              <Spinner size="lg" className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Loading categories…</p>
            </div>
          ) : (
            fields.map((field, index) => {
              const description = getCategoryDescription(field.categoryLabelId)
              const isCustom = isCustomCategory(field.categoryLabelId)
              const amount = expenses[index]?.monthlyAmount || 0

              return (
                <div
                  key={field.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    amount > 0
                      ? "bg-independence-50 border border-independence-100"
                      : "bg-gray-50 border border-transparent hover:bg-gray-100"
                  }`}
                >
                  {/* Category label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {expenses[index]?.categoryName || field.categoryName}
                      </span>
                      {isCustom && (
                        <>
                          <span className="shrink-0 text-xs bg-independence-100 text-independence-700 px-2 py-0.5 rounded-full">
                            Custom
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="shrink-0 p-0.5 text-red-400 hover:text-red-600 rounded"
                            title="Remove"
                            aria-label="Remove custom category"
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </>
                      )}
                    </div>
                    {description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Amount input */}
                  <div className="shrink-0 w-32">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-gray-400 pointer-events-none">
                        $
                      </span>
                      <Controller
                        name={`expenses.${index}.monthlyAmount`}
                        control={control}
                        render={({ field: inputField }) => (
                          <MathInput
                            value={inputField.value || 0}
                            onChange={inputField.onChange}
                            placeholder="0"
                            min={0}
                            step={50}
                            className={`w-full pl-7 pr-3 py-2 text-sm text-right border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 ${
                              errors.expenses?.[index]?.monthlyAmount
                                ? "border-red-400"
                                : amount > 0
                                  ? "border-independence-200 bg-white"
                                  : "border-gray-200 bg-white"
                            }`}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add custom category */}
        <div className="mt-3">
          {showAddCustom ? (
            <div className="flex items-center gap-2 p-3 bg-independence-50 rounded-lg border border-independence-200">
              <input
                type="text"
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder="Category name (e.g. Golf, Travel)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddCustomCategory()
                  }
                  if (e.key === "Escape") {
                    setShowAddCustom(false)
                    setCustomCategoryName("")
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomCategory}
                className="px-3 py-1.5 text-sm bg-independence-600 text-white rounded-lg hover:bg-independence-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustom(false)
                  setCustomCategoryName("")
                }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCustom(true)}
              className="w-full py-2.5 text-sm border-2 border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-independence-300 hover:text-independence-600 hover:bg-independence-50 transition-colors"
            >
              <i className="fas fa-plus mr-1.5"></i>
              Add custom category
            </button>
          )}
        </div>

        {errors.expenses && !Array.isArray(errors.expenses) && (
          <p className="mt-2 text-sm text-red-600">{errors.expenses.message}</p>
        )}
      </div>

      {/* Skip hint */}
      {(!isEditMode || totalMonthlyExpenses === 0) && (
        <p className="text-xs text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          {msg.skipHint}
        </p>
      )}
    </div>
  )
}
