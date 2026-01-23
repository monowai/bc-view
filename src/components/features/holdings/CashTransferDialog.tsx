import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { Portfolio, CashTransferData, Asset } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import useSWR from "swr"
import { simpleFetcher, optionalFetcher } from "@utils/api/fetchHelper"

interface CashTransferDialogProps {
  modalOpen: boolean
  onClose: () => void
  sourceData: CashTransferData
  portfolios: Portfolio[]
}

interface CashAsset {
  id: string
  code: string
  name: string
  currency: string
}

type WizardStep = "amounts" | "target"

const CashTransferDialog: React.FC<CashTransferDialogProps> = ({
  modalOpen,
  onClose,
  sourceData,
  portfolios,
}) => {
  const { t } = useTranslation("common")
  const [step, setStep] = useState<WizardStep>("amounts")
  const [sentAmount, setSentAmount] = useState<string>("")
  const [receivedAmount, setReceivedAmount] = useState<string>("")
  const [targetPortfolioId, setTargetPortfolioId] = useState<string>("")
  const [targetAssetId, setTargetAssetId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [description, setDescription] = useState<string>("")

  // Cash endpoint not implemented on backend - disable for now
  const { data: cashAssetsData } = useSWR(null, optionalFetcher("/api/cash"))

  // Fetch available account assets (ACCOUNT category - bank accounts)
  const { data: accountAssetsData } = useSWR(
    modalOpen ? "/api/assets?category=ACCOUNT" : null,
    simpleFetcher("/api/assets?category=ACCOUNT"),
  )

  // Helper to get currency from an asset
  const getAssetCurrency = (asset: Asset): string => {
    if (asset.assetCategory?.id === "CASH") {
      return asset.code
    }
    return asset.priceSymbol || asset.market?.currency?.code || asset.code
  }

  // Filter assets to same currency as source (excluding source asset)
  const eligibleTargetAssets = useMemo((): CashAsset[] => {
    const result: CashAsset[] = []

    if (cashAssetsData?.data) {
      const cashAssets = Object.values(cashAssetsData.data) as Asset[]
      cashAssets
        .filter(
          (asset) =>
            asset.code === sourceData.currency &&
            asset.id !== sourceData.assetId,
        )
        .forEach((asset) => {
          result.push({
            id: asset.id,
            code: asset.code,
            name: asset.name || `${asset.code} Balance`,
            currency: asset.code,
          })
        })
    }

    if (accountAssetsData?.data) {
      const accountAssets = Object.values(accountAssetsData.data) as Asset[]
      accountAssets
        .filter(
          (asset) =>
            getAssetCurrency(asset) === sourceData.currency &&
            asset.id !== sourceData.assetId,
        )
        .forEach((asset) => {
          result.push({
            id: asset.id,
            code: asset.code,
            name: asset.name || asset.code,
            currency: getAssetCurrency(asset),
          })
        })
    }

    return result
  }, [cashAssetsData, accountAssetsData, sourceData])

  // Reset state when modal opens - default amount to current balance (market value)
  useEffect(() => {
    if (modalOpen) {
      setStep("amounts")
      const defaultAmount = String(sourceData.currentBalance)
      setSentAmount(defaultAmount)
      setReceivedAmount(defaultAmount)
      setTargetPortfolioId(sourceData.portfolioId)
      setTargetAssetId("")
      setIsSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
      setDescription("")
    }
  }, [modalOpen, sourceData.portfolioId, sourceData.currentBalance])

  const parsedSentAmount = parseFloat(sentAmount) || 0
  const parsedReceivedAmount = parseFloat(receivedAmount) || 0
  const fee = parsedSentAmount - parsedReceivedAmount

  const handleSentChange = (value: number): void => {
    setSentAmount(String(value))
    if (receivedAmount === "" || receivedAmount === sentAmount) {
      setReceivedAmount(String(value))
    }
  }

  const handleTransfer = async (): Promise<void> => {
    if (parsedSentAmount <= 0 || !targetPortfolioId || !targetAssetId) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch("/api/cash/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPortfolioId: sourceData.portfolioId,
          fromAssetId: sourceData.assetId,
          toPortfolioId: targetPortfolioId,
          toAssetId: targetAssetId,
          sentAmount: parsedSentAmount,
          receivedAmount: parsedReceivedAmount,
          description: description || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setSubmitError(errorData.message || "Failed to transfer cash")
        return
      }

      setSubmitSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to transfer cash",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!modalOpen) {
    return null
  }

  // Validation for step 1
  const isAmountsValid =
    parsedSentAmount > 0 &&
    parsedSentAmount <= sourceData.currentBalance &&
    parsedReceivedAmount > 0 &&
    parsedReceivedAmount <= parsedSentAmount

  // Validation for step 2
  const isTargetValid = targetPortfolioId && targetAssetId

  const selectedPortfolio = portfolios.find((p) => p.id === targetPortfolioId)
  const selectedAsset =
    targetAssetId === sourceData.assetId
      ? { name: sourceData.assetName }
      : eligibleTargetAssets.find((a) => a.id === targetAssetId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with step indicator */}
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {t("cash.transfer.title")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded ${step === "amounts" ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                1
              </span>
              <span className="text-xs text-gray-400">―</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${step === "target" ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                2
              </span>
            </div>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        {/* Step 1: Amounts */}
        {step === "amounts" && (
          <div className="space-y-4">
            {/* Source Info */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">
                {t("cash.transfer.from")}
              </div>
              <div className="font-semibold">{sourceData.assetName}</div>
              <div className="text-sm text-gray-500">
                {sourceData.portfolioCode} &bull; {sourceData.currency}{" "}
                {sourceData.currentBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            {/* Amount Sent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("cash.transfer.amountSent")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{sourceData.currency}</span>
                <MathInput
                  value={sentAmount === "" ? "" : parsedSentAmount}
                  onChange={handleSentChange}
                  placeholder="0.00"
                  className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {parsedSentAmount > sourceData.currentBalance && (
                <p className="text-red-500 text-sm mt-1">
                  {t("cash.transfer.insufficientBalance")}
                </p>
              )}
            </div>

            {/* Amount Received */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("cash.transfer.amountReceived")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{sourceData.currency}</span>
                <MathInput
                  value={receivedAmount === "" ? "" : parsedReceivedAmount}
                  onChange={(value) => setReceivedAmount(String(value))}
                  placeholder="0.00"
                  className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {parsedReceivedAmount > parsedSentAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {t("cash.transfer.receivedExceedsSent")}
                </p>
              )}
            </div>

            {/* Fee display */}
            {fee > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700">
                    {t("cash.transfer.fee")}
                  </span>
                  <span className="font-semibold text-amber-700">
                    {sourceData.currency}{" "}
                    {fee.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded transition-colors text-white ${
                  !isAmountsValid
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-purple-500 hover:bg-purple-600"
                }`}
                onClick={() => setStep("target")}
                disabled={!isAmountsValid}
              >
                {t("next")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Target & Confirm */}
        {step === "target" && (
          <div className="space-y-4">
            {/* Target Portfolio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("cash.transfer.toPortfolio")}
              </label>
              <select
                value={targetPortfolioId}
                onChange={(e) => setTargetPortfolioId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.code} - {portfolio.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Asset */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("cash.transfer.toAsset")}
              </label>
              <select
                value={targetAssetId}
                onChange={(e) => setTargetAssetId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">{t("cash.transfer.selectAsset")}</option>
                {targetPortfolioId !== sourceData.portfolioId && (
                  <option value={sourceData.assetId}>
                    {sourceData.assetName} ({t("cash.transfer.sameAsset")})
                  </option>
                )}
                {eligibleTargetAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("cash.transfer.description")} ({t("optional")})
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("cash.transfer.descriptionPlaceholder")}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Transfer Summary */}
            {isTargetValid && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-sm text-gray-600 mb-2">
                  {t("cash.transfer.summary")}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t("cash.transfer.from")}:</span>
                    <span className="font-medium">{sourceData.assetName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("cash.transfer.to")}:</span>
                    <span className="font-medium">
                      {selectedAsset?.name} ({selectedPortfolio?.code})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("cash.transfer.amountSent")}:</span>
                    <span className="font-semibold">
                      {sourceData.currency}{" "}
                      {parsedSentAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {fee > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>{t("cash.transfer.fee")}:</span>
                      <span>
                        {sourceData.currency}{" "}
                        {fee.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t("cash.transfer.amountReceived")}:</span>
                    <span className="font-semibold">
                      {sourceData.currency}{" "}
                      {parsedReceivedAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 px-4 py-2"
                onClick={() => setStep("amounts")}
                disabled={isSubmitting}
              >
                &larr; {t("back")}
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded transition-colors text-white ${
                    !isTargetValid || isSubmitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : submitSuccess
                        ? "bg-green-600"
                        : "bg-purple-500 hover:bg-purple-600"
                  }`}
                  onClick={handleTransfer}
                  disabled={!isTargetValid || isSubmitting || submitSuccess}
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t("submitting")}
                    </span>
                  ) : submitSuccess ? (
                    <span className="flex items-center">
                      <i className="fas fa-check mr-2"></i>
                      {t("success")}
                    </span>
                  ) : (
                    t("cash.transfer.confirm")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CashTransferDialog
