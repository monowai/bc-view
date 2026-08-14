import React, { useState } from "react"
import Alert from "@components/ui/Alert"
import { useRouter } from "next/router"
import useSWR from "swr"
import Spinner from "@components/ui/Spinner"
import { ModelDto, CreateModelRequest } from "types/rebalance"
import { Currency, PortfolioResponses } from "types/beancounter"
import { ccyKey, portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import ClientSelector from "@components/features/shares/ClientSelector"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

interface ModelPortfolioFormProps {
  model?: ModelDto
  onSuccess?: (model: ModelDto) => void
}

const ModelPortfolioForm: React.FC<ModelPortfolioFormProps> = ({
  model,
  onSuccess,
}) => {
  const router = useRouter()
  const isEditing = !!model?.id

  // Fetch currencies from backend
  const { data: ccyResponse, isLoading: loadingCurrencies } = useSWR<{
    data: Currency[]
  }>(ccyKey, simpleFetcher(ccyKey))
  const currencies = ccyResponse?.data || []

  // Fetch the user's portfolios so a brand-new model can default its base
  // currency to a portfolio the user actually holds, instead of a
  // hard-coded country default (#1156).
  const { data: portfoliosResponse } = useSWR<PortfolioResponses>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const portfolios = portfoliosResponse?.data || []

  const [name, setName] = useState(model?.name || "")
  const [objective, setObjective] = useState(model?.objective || "")
  const [description, setDescription] = useState(model?.description || "")
  const [baseCurrency, setBaseCurrency] = useState(model?.baseCurrency || "")
  const [risk, setRisk] = useState<number>(model?.risk ?? 5)
  const [clientId, setClientId] = useState(model?.clientId || "")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit: dialogSubmit,
  } = useDialogSubmit({ fallbackError: "Failed to save model" })

  // Resolved at render (not via an effect) since the portfolios list may
  // still be loading when this form mounts: an explicit pick always wins;
  // otherwise default to the first portfolio the user actually holds, and
  // only fall back to empty (nothing to derive from yet) — never a
  // hard-coded country currency (#1156). Editing an existing model always
  // keeps its own baseCurrency, since `baseCurrency` state is seeded from it.
  const resolvedBaseCurrency =
    baseCurrency || portfolios[0]?.currency.code || ""

  // Empty resolvedBaseCurrency (no portfolios yet, or submitting before the
  // portfolios SWR resolves) must block submit — the old hard-coded "NZD"
  // default made this state impossible, so removing it without a matching
  // gate would let a model persist with baseCurrency: "".
  const isValid = name.trim() !== "" && resolvedBaseCurrency !== ""

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isValid) return

    await dialogSubmit(async () => {
      const payload: CreateModelRequest = {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        baseCurrency: resolvedBaseCurrency,
        clientId: clientId.trim() || undefined,
        risk,
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
        throw new Error(errorData.message || "Failed to save model")
      }

      const result = await response.json()
      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push("/rebalance/models")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Model Name"} *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={"e.g., Conservative Growth"}
        />
      </div>

      <div>
        <label
          htmlFor="objective"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Investment Objective"}
        </label>
        <input
          id="objective"
          type="text"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={"e.g., Long-term growth with moderate risk"}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Description"}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={"Optional description"}
        />
      </div>

      <div>
        <label
          htmlFor="baseCurrency"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Base Currency"}
        </label>
        <select
          id="baseCurrency"
          value={resolvedBaseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          disabled={loadingCurrencies}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          {loadingCurrencies ? (
            <option value="">{"Loading..."}</option>
          ) : (
            <>
              {/* Real placeholder (not a silently-selected first currency)
                  for the brief window before a default currency has been
                  resolved from either the model or the portfolios list. */}
              {!resolvedBaseCurrency && (
                <option value="">{"Select a currency..."}</option>
              )}
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Risk Profile"}
        </label>
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Risk profile"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRisk(n)}
              role="radio"
              aria-checked={risk === n}
              aria-label={`Risk ${n}`}
              className="p-1"
            >
              <i
                className={`fas fa-star text-lg ${
                  n <= risk
                    ? "text-amber-400"
                    : "text-gray-300 hover:text-amber-200"
                }`}
              ></i>
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500">{risk}/5</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {"1 = lowest risk, 5 = highest"}
        </p>
      </div>

      {!isEditing && (
        <ClientSelector clientId={clientId} onChange={setClientId} />
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          {"Cancel"}
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
              <Spinner className="mr-2" />
              {"Saving..."}
            </span>
          ) : isEditing ? (
            "Save"
          ) : (
            "Create"
          )}
        </button>
      </div>
    </form>
  )
}

export default ModelPortfolioForm
