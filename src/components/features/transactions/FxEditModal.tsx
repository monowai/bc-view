import React, { useState, useEffect, useMemo, useCallback } from "react"
import { NumericFormat } from "react-number-format"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { mutate } from "swr"
import { Transaction } from "types/beancounter"
import { convert } from "@lib/trns/tradeUtils"
import { copyToClipboard } from "@lib/trns/formUtils"
import { postData } from "@components/ui/DropZone"
import { holdingKey, trnKey } from "@utils/api/fetchHelper"
import {
  TrnDateField,
  TrnMathField,
  TrnTextField,
} from "@components/features/transactions/TrnFormFields"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { deleteTrn, isProposedTrnsKey } from "@utils/api/client/trns"
import { aggregatedHoldingsTodayKey } from "@utils/api/client/holdings"
import { fxFetcher, useFxBuyAmount } from "./useFxBuyAmount"

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

function AmountLabel({
  label,
  currency,
  colorClass,
}: {
  label: string
  currency: string
  colorClass: string
}): React.ReactElement {
  return (
    <>
      <span className={colorClass}>{label}</span>
      <span className="text-gray-400 ml-1">({currency})</span>
    </>
  )
}

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
  const {
    isSubmitting,
    submitError,
    handleSubmit: dialogHandleSubmit,
  } = useDialogSubmit({
    fallbackError: "Failed to update transaction",
  })
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxRateLoading, setFxRateLoading] = useState(false)

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
      ? buyAsset.name || buyAsset.displayCode
      : `${buyCurrency} Balance`

  // Determine sell display name - check if it's a specific account or generic balance
  const sellDisplayName = (() => {
    if (!sellAsset) {
      return `${sellCurrency} Balance`
    }
    // If market is NOT "CASH", it's a specific account (PRIVATE, TRADE, etc.)
    if (sellAsset.market?.code && sellAsset.market.code !== "CASH") {
      return sellAsset.name || sellAsset.displayCode
    }
    // If the asset code differs from the currency, it might be a named account
    if (sellAsset.code && sellAsset.code !== sellCurrency) {
      return sellAsset.name || sellAsset.displayCode
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
    handleSubmit: rhfHandleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(fxEditSchema),
    defaultValues,
  })

  // react-hook-form's watch() is a stable, non-memoizable library API; safe to read here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const sellAmount = watch("sellAmount")
  const buyAmount = watch("buyAmount")

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
  const setBuyAmount = useCallback(
    (value: number) => setValue("buyAmount", value),
    [setValue],
  )
  const {
    manualBuyAmount,
    overrideBuyAmount: handleBuyAmountChange,
    resumeAutoBuyAmount,
  } = useFxBuyAmount({ sellAmount, fxRate, onBuyAmount: setBuyAmount })

  // Calculate implied rate from current values
  const impliedRate = useMemo(() => {
    if (sellAmount > 0 && buyAmount > 0) {
      return buyAmount / sellAmount
    }
    return null
  }, [sellAmount, buyAmount])

  // Build data structure matching what getCashRow expects for FX
  const buildFxFormData = (
    values: FxEditFormData,
  ): Parameters<typeof convert>[0] => ({
    type: { value: "FX", label: "FX" },
    asset: sellAsset ? sellAsset.displayCode : sellCurrency,
    market: sellAsset?.market?.code || "CASH",
    tradeDate: values.tradeDate,
    quantity: values.sellAmount,
    price: 1,
    tradeCurrency: {
      value: sellCurrency,
      label: sellCurrency,
      currency: sellCurrency,
      market: sellAsset?.market?.code || "CASH",
    },
    cashCurrency: {
      value:
        buyAsset.market.code === "CASH" ? buyCurrency : buyAsset.displayCode,
      label: buyDisplayName,
      currency: buyCurrency,
      market: buyAsset.market.code,
    },
    cashAmount: values.buyAmount,
    fees: values.fees,
    tax: values.tax,
    comments: values.comments || `Buy ${buyCurrency}/Sell ${sellCurrency}`,
    status: { value: trn.status, label: trn.status },
  })

  const handleCopy = (): void => {
    const row = convert(buildFxFormData(getValues()))
    copyToClipboard(row)
  }

  // Invalidate holdings cache after transaction changes
  const invalidateHoldingsCache = (portfolioCode: string): void => {
    setTimeout(() => {
      mutate(holdingKey(portfolioCode, "today"))
      mutate(aggregatedHoldingsTodayKey)
    }, 1500)
  }

  const onSubmit = async (data: FxEditFormData): Promise<void> => {
    await dialogHandleSubmit(async () => {
      // FX transactions: Delete old + Add new via CSV import
      const deleteResponse = await deleteTrn(trn.id)
      if (!deleteResponse.ok) {
        throw new Error("Failed to delete transaction")
      }

      const row = convert(buildFxFormData(data))
      await postData(trn.portfolio, false, row.split(","))
      await mutate(trnKey(trn.id))
      mutate(isProposedTrnsKey)
      invalidateHoldingsCache(trn.portfolio.code)
      onClose()
    })
  }

  const handleSave = (): void => {
    void rhfHandleSubmit(onSubmit)()
  }

  const inputClass =
    "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
  const labelClass = "block text-xs font-medium text-gray-600"
  const fieldProps = {
    control,
    labelClassName: labelClass,
    inputClassName: inputClass,
  }

  return (
    <Dialog
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 text-center">
            <div className="font-semibold text-base">{"FX Trade"}</div>
            <div className="text-xs text-gray-500">{trn.tradeDate}</div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              className="text-green-600 hover:text-green-700 p-1"
              onClick={handleCopy}
              title={"Copy"}
            >
              <i className="fas fa-copy"></i>
            </button>
            <button
              type="button"
              className="text-red-500 hover:text-red-600 p-1"
              onClick={onDelete}
              title={"Delete"}
            >
              <i className="fas fa-trash-can"></i>
            </button>
          </div>
        </div>
      }
      onClose={onClose}
      maxWidth="md"
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label="Save"
            loadingLabel="Saving..."
            isSubmitting={isSubmitting}
            disabled={!isDirty}
            variant="blue"
          />
        </>
      }
    >
      {/* FX Visual Summary */}
      <div className="bg-linear-to-r from-red-50 to-green-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-center gap-4">
          {/* Sell Side */}
          <div className="text-center flex-1">
            <div className="text-xs text-red-600 font-medium uppercase mb-1">
              {"Sell"}
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
              {"Buy"}
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

      {/* Form */}
      <form
        id="fx-edit-form"
        onSubmit={rhfHandleSubmit(onSubmit)}
        className="space-y-3"
      >
        {/* Trade Date */}
        <TrnDateField {...fieldProps} name="tradeDate" label={"Trade Date"} />

        {/* Sell Amount */}
        <TrnMathField
          {...fieldProps}
          name="sellAmount"
          label={
            <AmountLabel
              label={"Sell Amount"}
              currency={sellCurrency}
              colorClass="text-red-600"
            />
          }
          onChange={(value, applyChange) => {
            resumeAutoBuyAmount() // Reset manual override when sell amount changes
            applyChange(value)
          }}
          inputClassName={`${inputClass} border-red-200 bg-red-50`}
          error={errors.sellAmount?.message}
        />

        {/* Buy Amount */}
        <TrnMathField
          {...fieldProps}
          name="buyAmount"
          label={
            <AmountLabel
              label={"Buy Amount"}
              currency={buyCurrency}
              colorClass="text-green-600"
            />
          }
          onChange={handleBuyAmountChange}
          inputClassName={`${inputClass} border-green-200 bg-green-50`}
          error={errors.buyAmount?.message}
        />

        {/* Fees */}
        <TrnMathField {...fieldProps} name="fees" label={"Fees"} />

        {/* Comments */}
        <TrnTextField
          {...fieldProps}
          name="comments"
          label={"Comments"}
          placeholder={`Buy ${buyCurrency}/Sell ${sellCurrency}`}
        />

        {/* Status (read-only) */}
        <div>
          <label className={labelClass}>{"Status"}</label>
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
      </form>

      <Dialog.ErrorAlert message={submitError} />
    </Dialog>
  )
}
