import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "next-i18next"
import Dialog from "@components/ui/Dialog"
import { Portfolio, CashTransferData, Asset } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import useSWR from "swr"
import { simpleFetcher, ccyKey } from "@utils/api/fetchHelper"
import { stripOwnerPrefix, resolveAssetId } from "@lib/assets/assetUtils"

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

  // Fetch available account assets (ACCOUNT category - bank accounts)
  const { data: accountAssetsData } = useSWR(
    modalOpen ? "/api/assets?category=ACCOUNT" : null,
    simpleFetcher("/api/assets?category=ACCOUNT"),
  )

  // Fetch currencies for CASH market assets
  const { data: ccyData } = useSWR(
    modalOpen ? ccyKey : null,
    simpleFetcher(ccyKey),
  )

  // Helper to get currency from an asset
  const getAssetCurrency = (asset: Asset): string => {
    if (asset.assetCategory?.id === "CASH") {
      return asset.code
    }
    return asset.priceSymbol || asset.market?.currency?.code || asset.code
  }

  // Build target asset options: currency balances + bank accounts (excluding source asset)
  const eligibleTargetAssets = useMemo((): {
    currencies: CashAsset[]
    accounts: CashAsset[]
  } => {
    const currencies: CashAsset[] = []
    const accounts: CashAsset[] = []

    // Add matching currency balance (CASH market) only when source is an account asset.
    // When source is already a CASH asset, "Same Asset" covers same-currency transfers.
    const sourceIsCash = sourceData.assetCode === sourceData.currency
    if (ccyData?.data && sourceData.assetId && !sourceIsCash) {
      ccyData.data
        .filter((ccy: { code: string }) => ccy.code === sourceData.currency)
        .forEach((ccy: { code: string; name?: string }) => {
          currencies.push({
            id: `cash:${ccy.code}`,
            code: ccy.code,
            name: `${ccy.code} Balance`,
            currency: ccy.code,
          })
        })
    }

    // Add bank/trade accounts matching the currency
    if (accountAssetsData?.data) {
      const accountAssets = Object.values(accountAssetsData.data) as Asset[]
      accountAssets
        .filter(
          (asset) =>
            getAssetCurrency(asset) === sourceData.currency &&
            asset.id !== sourceData.assetId,
        )
        .forEach((asset) => {
          accounts.push({
            id: asset.id,
            code: asset.code,
            name: asset.name || asset.code,
            currency: getAssetCurrency(asset),
          })
        })
    }

    return { currencies, accounts }
  }, [ccyData, accountAssetsData, sourceData])

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

  const allTargetAssets = [
    ...eligibleTargetAssets.currencies,
    ...eligibleTargetAssets.accounts,
  ]

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

    const tradeDate = new Date().toISOString().split("T")[0]

    let resolvedTargetAssetId: string
    try {
      resolvedTargetAssetId = await resolveAssetId(targetAssetId)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to resolve target asset",
      )
      return
    }

    // Resolve display codes for comments
    const sourceDisplayCode = stripOwnerPrefix(sourceData.assetCode)
    const targetAsset = allTargetAssets.find((a) => a.id === targetAssetId)
    const targetDisplayCode =
      targetAssetId === sourceData.assetId
        ? sourceDisplayCode
        : targetAsset
          ? stripOwnerPrefix(targetAsset.code)
          : ""
    const targetPortfolio = portfolios.find((p) => p.id === targetPortfolioId)

    const withdrawalComment =
      description ||
      `Transfer to ${targetDisplayCode}${targetPortfolio ? ` (${targetPortfolio.code})` : ""}`
    const depositComment =
      description ||
      `Transfer from ${sourceDisplayCode} (${sourceData.portfolioCode})`

    const withdrawal = {
      trnType: "WITHDRAWAL",
      assetId: sourceData.assetId,
      cashAssetId: sourceData.assetId,
      tradeDate,
      tradeAmount: parsedSentAmount,
      tradeCurrency: sourceData.currency,
      cashCurrency: sourceData.currency,
      price: 1,
      quantity: 0,
      status: "SETTLED",
      comments: withdrawalComment,
    }

    const deposit = {
      trnType: "DEPOSIT",
      assetId: resolvedTargetAssetId,
      cashAssetId: resolvedTargetAssetId,
      tradeDate,
      tradeAmount: parsedReceivedAmount,
      tradeCurrency: sourceData.currency,
      cashCurrency: sourceData.currency,
      price: 1,
      quantity: 0,
      status: "SETTLED",
      comments: depositComment,
    }

    try {
      const isSamePortfolio = sourceData.portfolioId === targetPortfolioId

      if (isSamePortfolio) {
        // Same portfolio: send both in one request
        const response = await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: sourceData.portfolioId,
            data: [withdrawal, deposit],
          }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setSubmitError(
            errorData.message || errorData.detail || "Failed to transfer cash",
          )
          return
        }
      } else {
        // Different portfolios: two sequential requests
        const withdrawalResponse = await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: sourceData.portfolioId,
            data: [withdrawal],
          }),
        })
        if (!withdrawalResponse.ok) {
          const errorData = await withdrawalResponse.json().catch(() => ({}))
          setSubmitError(
            errorData.message ||
              errorData.detail ||
              "Failed to create withdrawal",
          )
          return
        }

        const depositResponse = await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: targetPortfolioId,
            data: [deposit],
          }),
        })
        if (!depositResponse.ok) {
          const errorData = await depositResponse.json().catch(() => ({}))
          setSubmitError(
            errorData.message ||
              errorData.detail ||
              "Withdrawal succeeded but deposit failed",
          )
          return
        }
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
      : allTargetAssets.find((a) => a.id === targetAssetId)

  const stepFooter =
    step === "amounts" ? (
      <>
        <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
        <Dialog.SubmitButton
          onClick={() => setStep("target")}
          label={t("next")}
          disabled={!isAmountsValid}
          variant="purple"
        />
      </>
    ) : (
      <>
        <button
          type="button"
          className="text-gray-600 hover:text-gray-800 px-4 py-2"
          onClick={() => setStep("amounts")}
          disabled={isSubmitting}
        >
          &larr; {t("back")}
        </button>
        <div className="flex space-x-2">
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleTransfer}
            label={submitSuccess ? t("success") : t("cash.transfer.confirm")}
            loadingLabel={t("submitting")}
            isSubmitting={isSubmitting}
            disabled={!isTargetValid || submitSuccess}
            variant={submitSuccess ? "green" : "purple"}
          />
        </div>
      </>
    )

  return (
    <Dialog
      title={
        <div>
          <div>{t("cash.transfer.title")}</div>
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
      }
      onClose={onClose}
      maxWidth="md"
      scrollable={true}
      footer={stepFooter}
    >
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
              <option value={sourceData.assetId}>
                {sourceData.assetName} ({t("cash.transfer.sameAsset")})
              </option>
              {eligibleTargetAssets.currencies.length > 0 && (
                <optgroup
                  label={t(
                    "cash.transfer.currencyBalances",
                    "Currency Balances",
                  )}
                >
                  {eligibleTargetAssets.currencies.map((asset) => (
                    <option key={`ccy-${asset.code}`} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {eligibleTargetAssets.accounts.length > 0 && (
                <optgroup
                  label={t("cash.transfer.bankAccounts", "Bank Accounts")}
                >
                  {eligibleTargetAssets.accounts.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </optgroup>
              )}
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
          <Dialog.ErrorAlert message={submitError} />
        </div>
      )}
    </Dialog>
  )
}

export default CashTransferDialog
