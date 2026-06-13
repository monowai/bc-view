import React, { useEffect, useMemo, useRef, useState } from "react"
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
import Spinner from "@components/ui/Spinner"
import MathInput from "@components/ui/MathInput"

const msg = wizardMessages.steps.workingExpenses

interface WorkingExpensesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  getValues: UseFormGetValues<WizardFormData>
  isEditMode?: boolean
}

const categoriesKey = "/api/independence/categories"

export default function WorkingExpensesStep({
  control,
  errors,
  setValue,
  getValues,
  isEditMode,
}: WorkingExpensesStepProps): React.ReactElement {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "workingExpenses",
  })
  const hasInitialized = useRef(false)
  // Track if user has made changes - only then compute the sum
  const hasUserChanges = useRef(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState("")

  const { data: categoriesData } = useSwr<CategoryLabelsResponse>(
    categoriesKey,
    simpleFetcher(categoriesKey),
  )

  const categories = categoriesData?.data || []
  const systemCategories = categories.filter(
    (c) => c.ownerId === "SYSTEM" || c.ownerId === "system",
  )
  const watchedWorkingExpenses = useWatch({ control, name: "workingExpenses" })
  const workingExpenses = useMemo(
    () => watchedWorkingExpenses || [],
    [watchedWorkingExpenses],
  )

  // Initialize expenses with all system categories when data loads
  // Merge system categories with any stored expenses to ensure all categories display
  // Uses getValues() instead of useWatch to avoid race condition where useWatch returns []
  // on first render before defaultValues have propagated through the subscription mechanism
  useEffect(() => {
    if (systemCategories.length > 0 && !hasInitialized.current) {
      const currentExpenses = getValues("workingExpenses") || []

      // Build a map of existing expenses by categoryLabelId
      const existingExpenseMap = new Map(
        currentExpenses.map((e) => [e.categoryLabelId, e]),
      )

      // Create merged list: all system categories with stored values
      const mergedExpenses = systemCategories.map((cat) => ({
        categoryLabelId: cat.id,
        categoryName: cat.name,
        monthlyAmount: existingExpenseMap.get(cat.id)?.monthlyAmount || 0,
      }))

      // Add any custom categories that were stored
      const customExpenses = currentExpenses.filter((e) =>
        e.categoryLabelId.startsWith("custom-"),
      )

      setValue("workingExpenses", [...mergedExpenses, ...customExpenses])
      hasInitialized.current = true
    }
  }, [systemCategories, setValue, getValues])

  // Update workingExpensesMonthly whenever workingExpenses changes
  const prevTotalRef = useRef<number | null>(null)
  useEffect(() => {
    const total = workingExpenses.reduce(
      (sum, expense) => sum + (expense?.monthlyAmount || 0),
      0,
    )
    // Only call setValue when the total actually changes to avoid infinite loop
    if (
      total !== prevTotalRef.current &&
      (hasUserChanges.current || total > 0)
    ) {
      prevTotalRef.current = total
      setValue("workingExpensesMonthly", total)
    }
  }, [workingExpenses, setValue])

  const totalMonthlyExpenses = workingExpenses.reduce(
    (sum, expense) => sum + (expense?.monthlyAmount || 0),
    0,
  )

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

      {/* Hero: Total */}
      <div className="rounded-xl border border-independence-200 bg-independence-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-independence-700">
              {msg.totalLabel}
            </p>
            <p className="mt-0.5 text-xs text-independence-500 max-w-xs leading-relaxed">
              Used to estimate how much your expenses might drop after
              independence.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold tabular-nums text-independence-800">
              ${totalMonthlyExpenses.toLocaleString()}
            </p>
            <p className="text-xs text-independence-500 mt-0.5">per month</p>
          </div>
        </div>
      </div>

      {(!isEditMode || totalMonthlyExpenses === 0) && (
        <p className="text-xs text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          {msg.skipHint}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs text-gray-500">Adjust amounts by category:</p>
        {fields.map((field, index) => {
          const description = getCategoryDescription(field.categoryLabelId)
          const isCustom = isCustomCategory(field.categoryLabelId)
          const amount = workingExpenses[index]?.monthlyAmount || 0

          return (
            <div
              key={field.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                amount > 0
                  ? "bg-independence-50 border border-independence-100"
                  : "bg-gray-50 border border-transparent hover:bg-gray-100"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {workingExpenses[index]?.categoryName || field.categoryName}
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

              <div className="shrink-0 w-32">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 pointer-events-none">
                    $
                  </span>
                  <Controller
                    name={`workingExpenses.${index}.monthlyAmount`}
                    control={control}
                    render={({ field: inputField }) => (
                      <MathInput
                        value={inputField.value || 0}
                        onChange={(v) => {
                          hasUserChanges.current = true
                          inputField.onChange(v)
                        }}
                        min={0}
                        step={50}
                        placeholder="0"
                        className={`w-full pl-7 pr-3 py-2 text-sm text-right border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 ${
                          errors.workingExpenses?.[index]?.monthlyAmount
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
        })}

        {fields.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Spinner size="4xl" className="text-gray-400 mb-2" />
            <p className="text-gray-500">Loading categories...</p>
          </div>
        )}

        {errors.workingExpenses && !Array.isArray(errors.workingExpenses) && (
          <p className="mt-2 text-sm text-red-600">
            {errors.workingExpenses.message}
          </p>
        )}
      </div>

      {/* Add custom category */}
      <div className="mt-1">
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
    </div>
  )
}
