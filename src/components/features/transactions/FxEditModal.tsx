import React, { useMemo, useCallback } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { mutate } from "swr"
import { Transaction } from "types/beancounter"
import { convert } from "@lib/trns/tradeUtils"
import { postData } from "@components/ui/DropZone"
import { trnKey } from "@utils/api/fetchHelper"
import {
  TrnDateField,
  TrnMathField,
  TrnTextField,
} from "@components/features/transactions/TrnFormFields"
import Dialog from "@components/ui/Dialog"
import TrnFormDialog, {
  HeaderIconButton,
} from "@components/features/transactions/TrnFormDialog"
import {
  FxRateHint,
  FxSummary,
} from "@components/features/transactions/TrnFormParts"
import { inputClass, labelClass } from "@lib/trns/trnFormStyles"
import { refreshHoldingsSoon } from "@lib/trns/refreshHoldings"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { deleteTrn, isProposedTrnsKey } from "@utils/api/client/trns"
import { useFxBuyAmount } from "./useFxBuyAmount"
import { useFxRate } from "./useFxRate"

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
}: {
  label: string
  currency: string
}): React.ReactElement {
  return (
    <>
      <span>{label}</span>
      <span className="ml-1 text-gray-500">{currency}</span>
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

  const { rate: fxRate, loading: fxRateLoading } = useFxRate(
    sellCurrency,
    buyCurrency,
  )

  // The recorded buy amount stands until the sell side changes or the user
  // asks for the market rate.
  const setBuyAmount = useCallback(
    (value: number) => setValue("buyAmount", value),
    [setValue],
  )
  const {
    manualBuyAmount,
    overrideBuyAmount: handleBuyAmountChange,
    resumeAutoBuyAmount,
  } = useFxBuyAmount({
    sellAmount,
    fxRate,
    onBuyAmount: setBuyAmount,
    startManual: true,
  })

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
      refreshHoldingsSoon(mutate, trn.portfolio.code)
      onClose()
    })
  }

  const fieldProps = {
    control,
    labelClassName: labelClass,
    inputClassName: inputClass,
  }
  const settled = trn.status === "SETTLED"

  return (
    <TrnFormDialog
      title="Exchange currency"
      subtitle={[trn.portfolio.code, trn.portfolio.name]
        .filter(Boolean)
        .join(" · ")}
      status={
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            settled
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {settled ? "Settled" : "Proposed"}
        </span>
      }
      copyRow={() => convert(buildFxFormData(getValues()))}
      actions={
        <HeaderIconButton
          title="Delete"
          icon="fa-trash-can"
          tone="text-gray-500 hover:bg-red-50 hover:text-red-700"
          onClick={onDelete}
        />
      }
      isDirty={isDirty}
      onClose={onClose}
      onSubmit={() => void rhfHandleSubmit(onSubmit)()}
      submitLabel="Save"
      submittingLabel="Saving..."
      isSubmitting={isSubmitting}
      submitDisabled={!isDirty}
      summary={
        <FxSummary
          sellAmount={sellAmount}
          sellLabel={sellDisplayName}
          buyAmount={buyAmount}
          buyLabel={buyDisplayName}
        />
      }
    >
      <form
        id="fx-edit-form"
        onSubmit={rhfHandleSubmit(onSubmit)}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <TrnDateField
            {...fieldProps}
            id="fx-trade-date"
            name="tradeDate"
            label={"Trade date"}
          />
          <TrnMathField
            {...fieldProps}
            id="fx-fees"
            name="fees"
            label={"Fees"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TrnMathField
            {...fieldProps}
            id="fx-sell-amount"
            name="sellAmount"
            label={
              <AmountLabel label={"Sell amount"} currency={sellCurrency} />
            }
            onChange={(value, applyChange) => {
              resumeAutoBuyAmount()
              applyChange(value)
            }}
            error={errors.sellAmount?.message}
          />
          <div>
            <TrnMathField
              {...fieldProps}
              id="fx-buy-amount"
              name="buyAmount"
              label={
                <AmountLabel label={"Buy amount"} currency={buyCurrency} />
              }
              onChange={handleBuyAmountChange}
              error={errors.buyAmount?.message}
            />
            <FxRateHint
              marketRate={fxRate}
              impliedRate={impliedRate}
              manual={manualBuyAmount}
              loading={fxRateLoading}
              onUseMarketRate={resumeAutoBuyAmount}
            />
          </div>
        </div>

        <TrnTextField
          {...fieldProps}
          id="fx-comments"
          name="comments"
          label={"Comments"}
          placeholder={`Buy ${buyCurrency}/Sell ${sellCurrency}`}
        />
      </form>

      <Dialog.ErrorAlert message={submitError} />
    </TrnFormDialog>
  )
}
