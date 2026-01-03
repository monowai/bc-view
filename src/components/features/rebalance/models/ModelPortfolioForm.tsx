import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { ModelDto, CreateModelRequest } from "types/rebalance"

interface ModelPortfolioFormProps {
  model?: ModelDto
  onSuccess?: (model: ModelDto) => void
}

const ModelPortfolioForm: React.FC<ModelPortfolioFormProps> = ({
  model,
  onSuccess,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const isEditing = !!model?.id

  const [name, setName] = useState(model?.name || "")
  const [objective, setObjective] = useState(model?.objective || "")
  const [description, setDescription] = useState(model?.description || "")
  const [baseCurrency, setBaseCurrency] = useState(model?.baseCurrency || "USD")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim() !== ""

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: CreateModelRequest = {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        baseCurrency,
      }

      const url = isEditing
        ? `/api/rebalance/models/${model.id}`
        : "/api/rebalance/models"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || "Failed to save model")
        return
      }

      const result = await response.json()
      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push("/rebalance/models")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save model")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("rebalance.models.name", "Model Name")} *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={t(
            "rebalance.models.namePlaceholder",
            "e.g., Conservative Growth",
          )}
        />
      </div>

      <div>
        <label
          htmlFor="objective"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("rebalance.models.objective", "Investment Objective")}
        </label>
        <input
          id="objective"
          type="text"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={t(
            "rebalance.models.objectivePlaceholder",
            "e.g., Long-term growth with moderate risk",
          )}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("rebalance.models.description", "Description")}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={t(
            "rebalance.models.descriptionPlaceholder",
            "Optional description",
          )}
        />
      </div>

      <div>
        <label
          htmlFor="baseCurrency"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("rebalance.models.currency", "Base Currency")}
        </label>
        <select
          id="baseCurrency"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="NZD">NZD</option>
          <option value="AUD">AUD</option>
        </select>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          {t("cancel", "Cancel")}
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`px-4 py-2 rounded text-white transition-colors ${
            isValid && !isSubmitting
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              {t("saving", "Saving...")}
            </span>
          ) : isEditing ? (
            t("save", "Save")
          ) : (
            t("create", "Create")
          )}
        </button>
      </div>
    </form>
  )
}

export default ModelPortfolioForm
