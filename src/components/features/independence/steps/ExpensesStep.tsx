import React, { useEffect, useRef, useState } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, CategoryLabelsResponse } from "types/independence"
import { wizardMessages } from "@lib/independence/messages"

const msg = wizardMessages.steps.expenses

interface ExpensesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

const categoriesKey = "/api/independence/categories"

export default function ExpensesStep({
  control,
  errors,
  setValue,
}: ExpensesStepProps): React.ReactElement {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "expenses",
  })
  const hasInitialized = useRef(false)
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
  const expenses = useWatch({ control, name: "expenses" }) || []

  // Initialize expenses with all system categories when data loads
  // Only do this for NEW plans that have no expenses yet
  // Important: Check expenses.length instead of fields.length to avoid race condition
  // where useFieldArray hasn't synced with form state yet on first render
  useEffect(() => {
    if (
      systemCategories.length > 0 &&
      !hasInitialized.current &&
      expenses.length === 0
    ) {
      const initialExpenses = systemCategories.map((cat) => ({
        categoryLabelId: cat.id,
        categoryName: cat.name,
        monthlyAmount: 0,
      }))
      setValue("expenses", initialExpenses)
      hasInitialized.current = true
    }
  }, [systemCategories, setValue, expenses.length])

  const totalMonthlyExpenses = expenses.reduce(
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {msg.title}
        </h2>
        <p className="text-gray-600">{msg.description}</p>
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
                    {expenses[index]?.categoryName || field.categoryName}
                  </span>
                  {isCustom && (
                    <span className="ml-2 text-xs bg-independence-100 text-independence-700 px-2 py-0.5 rounded">
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
                    name={`expenses.${index}.monthlyAmount`}
                    control={control}
                    render={({ field: inputField }) => (
                      <input
                        type="number"
                        min={0}
                        step={50}
                        placeholder="0"
                        value={inputField.value || ""}
                        onChange={(e) =>
                          inputField.onChange(
                            e.target.value === ""
                              ? 0
                              : Number(e.target.value),
                          )
                        }
                        onBlur={inputField.onBlur}
                        ref={inputField.ref}
                        name={inputField.name}
                        className={`
                          w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 text-right
                          ${errors.expenses?.[index]?.monthlyAmount ? "border-red-500" : "border-gray-300"}
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
          <div className="flex items-center space-x-2 p-4 bg-independence-50 rounded-lg border border-independence-200">
            <input
              type="text"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder="Enter custom category name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
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
              className="px-4 py-2 bg-independence-600 text-white rounded-lg hover:bg-independence-700"
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
            className="w-full py-3 border-2 border-dashed border-independence-200 text-independence-600 rounded-lg hover:bg-independence-50 hover:border-independence-500 transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>
            Add Custom Category
          </button>
        )}

        {errors.expenses && !Array.isArray(errors.expenses) && (
          <p className="text-sm text-red-600">{errors.expenses.message}</p>
        )}
      </div>

      <div className="bg-independence-50 border border-independence-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <i className="fas fa-calculator text-independence-600 mr-3"></i>
            <span className="font-medium text-independence-700">
              {msg.totalLabel}
            </span>
          </div>
          <span className="text-xl font-bold text-independence-700">
            ${totalMonthlyExpenses.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
