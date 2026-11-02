import React, { useState, useMemo } from "react"
import { useRouter } from "next/router"
import Dialog from "@components/ui/Dialog"
import WeightsSummary from "../common/WeightsSummary"
import HoldingWeightsEditor from "./HoldingWeightsEditor"
import ClientSelector from "@components/features/shares/ClientSelector"
import { weightsSumValid, toWeightDecimal } from "@lib/rebalance/weights"
import { AssetWeightWithDetails, ModelDto } from "types/rebalance"
import { Holdings, Position } from "types/beancounter"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { createModel, createModelPlan } from "@utils/api/client/rebalance"

interface CreateModelFromHoldingsDialogProps {
  modalOpen: boolean
  onClose: () => void
  holdings: Holdings
  portfolioCode: string
  onSuccess?: (model: ModelDto) => void
}

const CreateModelFromHoldingsDialog: React.FC<
  CreateModelFromHoldingsDialogProps
> = ({ modalOpen, onClose, holdings, portfolioCode, onSuccess }) => {
  const router = useRouter()

  // Calculate initial weights from holdings
  const initialWeights = useMemo((): AssetWeightWithDetails[] => {
    const positions: Position[] = []
    Object.values(holdings.holdingGroups).forEach((group) => {
      positions.push(...group.positions)
    })

    // Filter out cash-related positions and calculate weights
    const nonCashPositions = positions.filter(
      (p) =>
        p.asset.assetCategory?.id !== "CASH" &&
        p.asset.assetCategory?.id !== "ACCOUNT",
    )

    const totalMarketValue = nonCashPositions.reduce(
      (sum, p) => sum + (p.moneyValues?.PORTFOLIO?.marketValue || 0),
      0,
    )

    if (totalMarketValue === 0) return []

    return nonCashPositions.map((p, index) => ({
      assetId: p.asset.id,
      assetCode: p.asset.code,
      assetName: p.asset.name,
      weight:
        Math.round(
          ((p.moneyValues?.PORTFOLIO?.marketValue || 0) / totalMarketValue) *
            10000,
        ) / 100, // Round to 2 decimal places
      currentValue: p.moneyValues?.PORTFOLIO?.marketValue || 0,
      currentWeight:
        ((p.moneyValues?.PORTFOLIO?.marketValue || 0) / totalMarketValue) * 100,
      sortOrder: index,
    }))
  }, [holdings])

  const [name, setName] = useState(`${portfolioCode} Model`)
  const [objective, setObjective] = useState("")
  const [description, setDescription] = useState("")
  const [weights, setWeights] =
    useState<AssetWeightWithDetails[]>(initialWeights)
  const [clientId, setClientId] = useState("")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
  } = useDialogSubmit({
    fallbackError: "Failed to create model",
  })

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const isValid = name.trim() !== "" && weightsSumValid(totalWeight)

  const handleCreate = async (): Promise<void> => {
    if (!isValid) return
    await handleSubmit(async () => {
      // Step 1: Create the Model (metadata only)
      const modelPayload = {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        baseCurrency: holdings.portfolio.currency.code,
        clientId: clientId.trim() || undefined,
      }

      const modelResponse = await createModel(modelPayload)

      if (!modelResponse.ok) {
        const errorData = await modelResponse.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to create model")
      }

      const modelResult = await modelResponse.json()
      const model: ModelDto = modelResult.data

      // Step 2: Create a Plan with the weights
      const planPayload = {
        description: `Initial plan from ${portfolioCode} holdings`,
        assets: weights.map((w, index) => ({
          assetId: w.assetId,
          weight: toWeightDecimal(w.weight),
          sortOrder: w.sortOrder ?? index,
        })),
      }

      const planResponse = await createModelPlan(model.id, planPayload)

      if (!planResponse.ok) {
        // Plan creation failed, but model was created - navigate to it anyway
        console.error("Failed to create plan:", await planResponse.text())
      }

      if (onSuccess) {
        onSuccess(model)
      } else {
        // Navigate to the new model
        router.push(`/rebalance/models/${model.id}`)
      }
      onClose()
    })
  }

  if (!modalOpen) return null

  return (
    <Dialog
      title={"Create Model from Holdings"}
      onClose={onClose}
      maxWidth="2xl"
      scrollable={true}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleCreate}
            label={"Create Model"}
            loadingLabel={"Creating..."}
            isSubmitting={isSubmitting}
            disabled={!isValid}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />

      <div className="space-y-4">
        <div>
          <label
            htmlFor="modelName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {"Model Name"} *
          </label>
          <input
            id="modelName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="modelObjective"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {"Investment Objective"}
          </label>
          <input
            id="modelObjective"
            type="text"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder={"e.g., Long-term growth"}
          />
        </div>

        <div>
          <label
            htmlFor="modelDescription"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {"Description"}
          </label>
          <input
            id="modelDescription"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder={"Optional description"}
          />
        </div>

        <ClientSelector clientId={clientId} onChange={setClientId} />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700">
            <i className="fas fa-info-circle"></i>
            <span className="text-sm">
              {
                "This will create a Model and a Draft Plan with weights from your holdings."
              }
            </span>
          </div>
        </div>

        <HoldingWeightsEditor
          weights={weights}
          totalWeight={totalWeight}
          onChange={setWeights}
        />

        {weights.length > 0 && (
          <WeightsSummary
            totalWeight={totalWeight}
            assetCount={weights.length}
          />
        )}
      </div>
    </Dialog>
  )
}

export default CreateModelFromHoldingsDialog
