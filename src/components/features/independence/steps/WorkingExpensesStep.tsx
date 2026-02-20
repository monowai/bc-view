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

const msg = wizardMessages.steps.workingExpenses

interface WorkingExpensesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  getValues: UseFormGetValues<WizardFormData>
}

const categoriesKey = "/api/independence/categories"

export default function WorkingExpensesStep({
  control,
  errors,
  setValue,
  getValues,
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
  // BUT only if user has made changes OR the computed total is greater than 0
  // This preserves the stored plan value when editing an existing plan
  useEffect(() => {
    const total = workingExpenses.reduce(
      (sum, expense) => sum + (expense?.monthlyAmount || 0),
      0,
    )
    // Only update if user has made changes or the total is non-zero
    // This prevents overwriting stored workingExpensesMonthly when loading with empty expenses
    if (hasUserChanges.current || total > 0) {
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {msg.title}
        </h2>
        <p className="text-sm text-gray-600">{msg.description}</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
        <i className="fas fa-check-circle text-green-600 mt-0.5 mr-2"></i>
        <p className="text-sm text-green-700">{msg.skipHint}</p>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const description = getCategoryDescription(field.categoryLabelId)
          const isCustom = isCustomCategory(field.categoryLabelId)

          return (
            <div
              key={field.id}
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">
                    {workingExpenses[index]?.categoryName || field.categoryName}
                  </span>
                  {isCustom && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                )}
              </div>

              <div className="w-36">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">
                    $
                  </span>
                  <Controller
                    name={`workingExpenses.${index}.monthlyAmount`}
                    control={control}
                    render={({ field: inputField }) => (
                      <input
                        type="number"
                        min={0}
                        step={50}
                        placeholder="0"
                        value={inputField.value || ""}
                        onChange={(e) => {
                          hasUserChanges.current = true
                          inputField.onChange(
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }}
                        onBlur={inputField.onBlur}
                        ref={inputField.ref}
                        name={inputField.name}
                        className={`
                          w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right
                          ${errors.workingExpenses?.[index]?.monthlyAmount ? "border-red-500" : "border-gray-300"}
                        `}
                      />
                    )}
                  />
                </div>
              </div>

              {isCustom && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="ml-2 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Remove custom category"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          )
        })}

        {fields.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-2"></i>
            <p className="text-gray-500">Loading categories...</p>
          </div>
        )}

        {/* Add Custom Category */}
        {showAddCustom ? (
          <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="text"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder="Enter custom category name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddCustomCategory()
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomCategory}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddCustom(false)
                setCustomCategoryName("")
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddCustom(true)}
            className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>
            Add Custom Category
          </button>
        )}

        {errors.workingExpenses && !Array.isArray(errors.workingExpenses) && (
          <p className="text-sm text-red-600">
            {errors.workingExpenses.message}
          </p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <i className="fas fa-calculator text-blue-600 mr-3"></i>
            <span className="font-medium text-blue-800">{msg.totalLabel}</span>
          </div>
          <span className="text-xl font-bold text-blue-700">
            ${totalMonthlyExpenses.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
