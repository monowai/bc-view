import React, { useState, useEffect, useMemo, useCallback } from "react"
import { NumericFormat } from "react-number-format"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { useTranslation } from "next-i18next"
import { mutate } from "swr"
import { Transaction, FxResponse } from "types/beancounter"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { convert } from "@lib/trns/tradeUtils"
import { copyToClipboard } from "@lib/trns/formUtils"
import { postData } from "@components/ui/DropZone"
import { holdingKey, trnKey } from "@utils/api/fetchHelper"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"

// Fetcher for FX rates
const fxFetcher = async (
  from: string,
  to: string,
): Promise<FxResponse | null> => {
  if (!from || !to || from === to) return null
  const response = await fetch("/api/fx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs: [{ from, to }] }),
  })
  if (!response.ok) return null
  return response.json()
}

interface FxEditFormData {
  tradeDate: string
  sellAmount: number
  buyAmount: number
  fees: number
  tax: number
  comments: string
}

const fxEditSchema = yup.object().shape({
  tradeDate: yup.string().required(),
  sellAmount: yup.number().required().positive(),
  buyAmount: yup.number().required().positive(),
  fees: yup.number().required().min(0),
  tax: yup.number().required().min(0),
  comments: yup.string().default(""),
})

interface FxEditModalProps {
  trn: Transaction
  onClose: () => void
  onDelete: () => void
}

/**
 * Specialized edit modal for FX transactions.
 * FX transactions have different semantics than regular trades:
 * - Asset = buy account (what you're buying into)
 * - CashAsset = sell account (what you're selling from)
 * - tradeCurrency = buy currency
 * - cashCurrency = sell currency
 * - tradeAmount = buy amount
 * - cashAmount = sell amount (negative)
 */
export default function FxEditModal({
  trn,
  onClose,
  onDelete,
}: FxEditModalProps): React.ReactElement {
  const { t } = useTranslation("common")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxRateLoading, setFxRateLoading] = useState(false)
  const [manualBuyAmount, setManualBuyAmount] = useState(false)

  // Extract FX-specific values from transaction
  // For FX_BUY: asset is the buy side, cashAsset is the sell side
  const buyAsset = trn.asset
  const sellAsset = trn.cashAsset
  const buyCurrency = trn.tradeCurrency.code
  const sellCurrency =
    typeof trn.cashCurrency === "object"
      ? (trn.cashCurrency as { code: string }).code
      : (trn.cashCurrency as string)

  // Display names for accounts
  // For bank accounts (PRIVATE market), show the account name
  // For generic cash balances (CASH market), show "Currency Balance"
  const buyDisplayName =
    buyAsset.market.code !== "CASH"
      ? buyAsset.name || stripOwnerPrefix(buyAsset.code)
      : `${buyCurrency} Balance`

  // Determine sell display name - check if it's a specific account or generic balance
  const sellDisplayName = (() => {
    if (!sellAsset) {
      return `${sellCurrency} Balance`
    }
    // If market is NOT "CASH", it's a specific account (PRIVATE, TRADE, etc.)
    if (sellAsset.market?.code && sellAsset.market.code !== "CASH") {
      return sellAsset.name || stripOwnerPrefix(sellAsset.code)
    }
    // If the asset code differs from the currency, it might be a named account
    if (sellAsset.code && sellAsset.code !== sellCurrency) {
      return sellAsset.name || stripOwnerPrefix(sellAsset.code)
    }
    return `${sellCurrency} Balance`
  })()

  // Default values from transaction
  const defaultValues: FxEditFormData = {
    tradeDate: trn.tradeDate,
    sellAmount: Math.abs(trn.cashAmount),
    buyAmount: trn.tradeAmount,
    fees: trn.fees,
    tax: trn.tax,
    comments: trn.comments || "",
  }

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(fxEditSchema),
    defaultValues,
  })

  const sellAmount = watch("sellAmount")
  const buyAmount = watch("buyAmount")

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  // Fetch FX rate for reference
  useEffect(() => {
    setFxRateLoading(true)
    fxFetcher(sellCurrency, buyCurrency)
      .then((response) => {
        if (response?.data?.rates) {
          const key = `${sellCurrency}:${buyCurrency}`
          const rate = response.data.rates[key]?.rate
          setFxRate(rate ?? null)
        } else {
          setFxRate(null)
        }
      })
      .catch(() => setFxRate(null))
      .finally(() => setFxRateLoading(false))
  }, [sellCurrency, buyCurrency])

  // Auto-calculate buy amount when sell amount or rate changes (if not manually overridden)
  useEffect(() => {
    if (fxRate && sellAmount > 0 && !manualBuyAmount) {
      const calculatedBuyAmount = sellAmount * fxRate
      setValue("buyAmount", parseFloat(calculatedBuyAmount.toFixed(2)))
    }
  }, [fxRate, sellAmount, manualBuyAmount, setValue])

  // Handle manual buy amount change
  const handleBuyAmountChange = useCallback(
    (value: number) => {
      setManualBuyAmount(true)
      setValue("buyAmount", value)
    },
    [setValue],
  )

  // Calculate implied rate from current values
  const impliedRate = useMemo(() => {
    if (sellAmount > 0 && buyAmount > 0) {
      return buyAmount / sellAmount
    }
    return null
  }, [sellAmount, buyAmount])

  const handleCopy = (): void => {
    const formData = getValues()
    // Build data structure matching what getCashRow expects for FX
    const data = {
      type: { value: "FX", label: "FX" },
      asset: sellAsset ? stripOwnerPrefix(sellAsset.code) : sellCurrency,
      market: sellAsset?.market?.code || "CASH",
      tradeDate: formData.tradeDate,
      quantity: formData.sellAmount,
      price: 1,
      tradeCurrency: {
        value: sellCurrency,
        label: sellCurrency,
        currency: sellCurrency,
        market: sellAsset?.market?.code || "CASH",
      },
      cashCurrency: {
        value:
          buyAsset.market.code === "CASH"
            ? buyCurrency
            : stripOwnerPrefix(buyAsset.code),
        label: buyDisplayName,
        currency: buyCurrency,
        market: buyAsset.market.code,
      },
      cashAmount: formData.buyAmount,
      fees: formData.fees,
      tax: formData.tax,
      comments: formData.comments || `Buy ${buyCurrency}/Sell ${sellCurrency}`,
      status: { value: trn.status, label: trn.status },
    }
    const row = convert(data)
    copyToClipboard(row)
  }

  // Invalidate holdings cache after transaction changes
  const invalidateHoldingsCache = (portfolioCode: string): void => {
    setTimeout(() => {
      mutate(holdingKey(portfolioCode, "today"))
      mutate("/api/holdings/aggregated?asAt=today")
    }, 1500)
  }

  const onSubmit = async (data: FxEditFormData): Promise<void> => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // FX transactions: Delete old + Add new via CSV import
      const deleteResponse = await fetch(`/api/trns/trades/${trn.id}`, {
        method: "DELETE",
      })
      if (!deleteResponse.ok) {
        setSubmitError(t("trn.error.delete"))
        return
      }

      // Build data structure matching what getCashRow expects for FX
      const formData = {
        type: { value: "FX", label: "FX" },
        asset: sellAsset ? stripOwnerPrefix(sellAsset.code) : sellCurrency,
        market: sellAsset?.market?.code || "CASH",
        tradeDate: data.tradeDate,
        quantity: data.sellAmount,
        price: 1,
        tradeCurrency: {
          value: sellCurrency,
          label: sellCurrency,
          currency: sellCurrency,
          market: sellAsset?.market?.code || "CASH",
        },
        cashCurrency: {
          value:
            buyAsset.market.code === "CASH"
              ? buyCurrency
              : stripOwnerPrefix(buyAsset.code),
          label: buyDisplayName,
          currency: buyCurrency,
          market: buyAsset.market.code,
        },
        cashAmount: data.buyAmount,
        fees: data.fees,
        tax: data.tax,
        comments: data.comments || `Buy ${buyCurrency}/Sell ${sellCurrency}`,
        status: { value: trn.status, label: trn.status },
      }
      const row = convert(formData)
      await postData(trn.portfolio, false, row.split(","))
      await mutate(trnKey(trn.id))
      invalidateHoldingsCache(trn.portfolio.code)
      onClose()
    } catch (error) {
      console.error("Failed to update FX transaction:", error)
      setSubmitError(t("trn.error.update"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 z-50 text-sm flex flex-col max-h-[85vh]">
        {/* Header */}
        <header className="flex-shrink-0 pb-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={onClose}
              title={t("cancel")}
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="text-center flex-1 px-2">
              <div className="font-semibold">
                {t("trade.fx.title", "FX Trade")}
              </div>
              <div className="text-xs text-gray-500">{trn.tradeDate}</div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="text-green-600 hover:text-green-700 p-1"
                onClick={handleCopy}
                title={t("copy")}
              >
                <i className="fas fa-copy"></i>
              </button>
              <button
                type="button"
                className="text-red-500 hover:text-red-600 p-1"
                onClick={onDelete}
                title={t("delete")}
              >
                <i className="fas fa-trash-can"></i>
              </button>
            </div>
          </div>

          {/* FX Visual Summary */}
          <div className="bg-linear-to-r from-red-50 to-green-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-center gap-4">
              {/* Sell Side */}
              <div className="text-center flex-1">
                <div className="text-xs text-red-600 font-medium uppercase mb-1">
                  {t("trn.fx.sell", "Sell")}
                </div>
                <div className="font-bold text-red-700">
                  <NumericFormat
                    value={sellAmount}
                    displayType="text"
                    thousandSeparator
                    decimalScale={2}
                    fixedDecimalScale
                  />
                </div>
                <div
                  className="text-xs text-red-600 mt-1 truncate"
                  title={sellDisplayName}
                >
                  {sellDisplayName}
                </div>
              </div>

              {/* Arrow and Rate */}
              <div className="text-center text-gray-400 px-2">
                <i className="fas fa-arrow-right"></i>
                {fxRateLoading ? (
                  <div className="text-xs mt-1">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                ) : impliedRate ? (
                  <div className="text-xs mt-1 font-mono text-gray-600">
                    @{impliedRate.toFixed(4)}
                  </div>
                ) : null}
              </div>

              {/* Buy Side */}
              <div className="text-center flex-1">
                <div className="text-xs text-green-600 font-medium uppercase mb-1">
                  {t("trn.fx.buy", "Buy")}
                </div>
                <div className="font-bold text-green-700">
                  <NumericFormat
                    value={buyAmount}
                    displayType="text"
                    thousandSeparator
                    decimalScale={2}
                    fixedDecimalScale
                  />
                </div>
                <div
                  className="text-xs text-green-600 mt-1 truncate"
                  title={buyDisplayName}
                >
                  {buyDisplayName}
                </div>
              </div>
            </div>
            {fxRate && !manualBuyAmount && (
              <div className="text-center text-xs text-gray-500 mt-2">
                Market rate: {fxRate.toFixed(4)}
              </div>
            )}
            {manualBuyAmount && (
              <div className="text-center text-xs text-amber-600 mt-2">
                Manual amount entered
              </div>
            )}
          </div>
        </header>

        {/* Form */}
        <form
          id="fx-edit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto py-3 space-y-3"
        >
          {/* Trade Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t("trn.tradeDate")}
            </label>
            <Controller
              name="tradeDate"
              control={control}
              render={({ field }) => (
                <DateInput
                  value={field.value}
                  onChange={field.onChange}
                  className={inputClass}
                />
              )}
            />
          </div>

          {/* Sell Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              <span className="text-red-600">
                {t("trn.fx.sellAmount", "Sell Amount")}
              </span>
              <span className="text-gray-400 ml-1">({sellCurrency})</span>
            </label>
            <Controller
              name="sellAmount"
              control={control}
              render={({ field }) => (
                <MathInput
                  value={field.value}
                  onChange={(value) => {
                    setManualBuyAmount(false) // Reset manual override when sell amount changes
                    field.onChange(value)
                  }}
                  className={`${inputClass} border-red-200 bg-red-50`}
                />
              )}
            />
            {errors.sellAmount && (
              <p className="text-red-500 text-xs">
                {errors.sellAmount.message}
              </p>
            )}
          </div>

          {/* Buy Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              <span className="text-green-600">
                {t("trn.fx.buyAmount", "Buy Amount")}
              </span>
              <span className="text-gray-400 ml-1">({buyCurrency})</span>
            </label>
            <Controller
              name="buyAmount"
              control={control}
              render={({ field }) => (
                <MathInput
                  value={field.value}
                  onChange={handleBuyAmountChange}
                  className={`${inputClass} border-green-200 bg-green-50`}
                />
              )}
            />
            {errors.buyAmount && (
              <p className="text-red-500 text-xs">{errors.buyAmount.message}</p>
            )}
          </div>

          {/* Fees */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t("trn.amount.charges")}
            </label>
            <Controller
              name="fees"
              control={control}
              render={({ field }) => (
                <MathInput
                  value={field.value}
                  onChange={field.onChange}
                  className={inputClass}
                />
              )}
            />
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t("trn.comments", "Comments")}
            </label>
            <Controller
              name="comments"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className={inputClass}
                  value={field.value || ""}
                  placeholder={`Buy ${buyCurrency}/Sell ${sellCurrency}`}
                />
              )}
            />
          </div>

          {/* Status (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t("trn.status")}
            </label>
            <div className={`${inputClass} bg-gray-100 flex items-center`}>
              <span
                className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  trn.status === "SETTLED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {trn.status}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {submitError && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded">
              {submitError}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 pt-3 border-t flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            form="fx-edit-form"
            disabled={isSubmitting || !isDirty}
            className={`px-4 py-2 rounded text-white text-sm ${
              isSubmitting || !isDirty
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isSubmitting ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  )
}
