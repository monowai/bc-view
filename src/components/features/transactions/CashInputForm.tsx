import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Portfolio } from "types/beancounter"
import useSwr, { mutate } from "swr"
import {
  calculateTradeAmount,
  convert,
  getCashFlowColorScheme,
} from "@lib/trns/tradeUtils"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { CurrencyOptionSchema } from "@lib/portfolio/schema"
import { onSubmit } from "@lib/trns/formUtils"
import {
  TrnDateField,
  TrnMathField,
  TrnTextField,
} from "@components/features/transactions/TrnFormFields"
import TrnFormDialog from "@components/features/transactions/TrnFormDialog"
import {
  CashAccountSelect,
  FxRateHint,
  FxSummary,
  SegmentedChoice,
  TrnStatusField,
  TrnSummary,
} from "@components/features/transactions/TrnFormParts"
import Alert from "@components/ui/Alert"
import {
  buildCombinedAssetOptions,
  resolveFxCurrencyPair,
  resolveAssetSelection,
  filterFxBuyOptions,
  buildCashCopyData,
  resolveFxDisplayInfo,
  cashTypeOf,
  CASH_TYPES,
} from "@lib/trns/cashFormHelpers"
import { inputClass, labelClass } from "@lib/trns/trnFormStyles"
import { refreshHoldingsSoon } from "@lib/trns/refreshHoldings"
import { todayIso } from "@lib/formatters"
import { accountsKey, tradeAccountsKey } from "@utils/api/client/assets"
import { useFxBuyAmount } from "./useFxBuyAmount"
import { useFxRate } from "./useFxRate"

const defaultValues = {
  type: { value: "DEPOSIT", label: "DEPOSIT" },
  status: { value: "SETTLED", label: "SETTLED" },
  asset: "USD",
  market: "CASH",
  tradeDate: todayIso(),
  tradeCurrency: { value: "USD", label: "USD" },
  cashCurrency: { value: "USD", label: "USD", market: "CASH" },
  quantity: 0,
  price: 1,
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
}

const cashSchema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.label),
    })
    .required(),
  status: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.status.value),
      label: yup.string().required().default(defaultValues.status.label),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().notRequired(),
  tradeDate: yup.string().required(),
  tradeAmount: yup.number(),
  quantity: yup.number().required().default(defaultValues.quantity),
  tradeCurrency: CurrencyOptionSchema.required(),
  cashCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  comment: yup.string().notRequired(),
})

const typeOption = (value: string): { value: string; label: string } => ({
  value,
  label: value,
})

/**
 * Money in or out of a cash account — deposit, withdrawal, income, deduction —
 * or an exchange from one currency to another.
 */
const CashInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  initialAsset?: string
  /** Pre-select the transaction type (e.g. "FX" for Exchange Cash). */
  initialType?: string
}> = ({ portfolio, modalOpen, setModalOpen, initialAsset, initialType }) => {
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(cashSchema),
    defaultValues,
  })
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (modalOpen) {
      reset({
        ...defaultValues,
        asset: initialAsset || defaultValues.asset,
        type: initialType ? typeOption(initialType) : defaultValues.type,
      })
    }
  }, [modalOpen, reset, initialAsset, initialType])

  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const { data: accountsData } = useSwr(accountsKey, simpleFetcher(accountsKey))
  const { data: tradeAccountsData } = useSwr(
    tradeAccountsKey,
    simpleFetcher(tradeAccountsKey),
  )

  const tax = useWatch({ control, name: "tax" })
  const fees = useWatch({ control, name: "fees" })
  const type = useWatch({ control, name: "type" })
  const qty = useWatch({ control, name: "quantity" })
  const asset = useWatch({ control, name: "asset" })
  const market = useWatch({ control, name: "market" })
  const cashCurrency = useWatch({ control, name: "cashCurrency" })
  const cashAmount = useWatch({ control, name: "cashAmount" }) ?? 0

  const isFx = type.value === "FX"
  const cashType = cashTypeOf(type.value)

  const combinedOptions = useMemo(
    () =>
      buildCombinedAssetOptions(
        ccyData?.data,
        accountsData?.data,
        tradeAccountsData?.data,
      ),
    [ccyData?.data, accountsData?.data, tradeAccountsData?.data],
  )
  const sellCurrency = resolveAssetSelection(asset, combinedOptions)?.currency
  const buyOptions = useMemo(
    () => filterFxBuyOptions(combinedOptions, sellCurrency),
    [combinedOptions, sellCurrency],
  )

  // The buy side can never be the currency being sold. When it is (the
  // defaults, or the sell side just moved onto it), take the first currency
  // on offer so what the select shows is what gets saved.
  useEffect(() => {
    if (!isFx || buyOptions.length === 0) return
    if (buyOptions.some((opt) => opt.value === cashCurrency?.value)) return
    const first = buyOptions[0]
    setValue("cashCurrency", { value: first.value, label: first.label })
  }, [isFx, buyOptions, cashCurrency?.value, setValue])

  const pair = isFx
    ? resolveFxCurrencyPair(asset, cashCurrency?.value ?? "", combinedOptions)
    : null
  const {
    rate: fxRate,
    loading: fxRateLoading,
    failed: fxRateFailed,
  } = useFxRate(pair?.sellCurrency, pair?.buyCurrency)

  const setBuyAmount = useCallback(
    (value: number) => setValue("cashAmount", value),
    [setValue],
  )
  const {
    manualBuyAmount,
    overrideBuyAmount: handleBuyAmountChange,
    resumeAutoBuyAmount,
  } = useFxBuyAmount({
    sellAmount: qty,
    fxRate,
    onBuyAmount: setBuyAmount,
    enabled: isFx,
  })

  // A change of currency re-engages the market rate.
  useEffect(() => {
    resumeAutoBuyAmount()
  }, [asset, cashCurrency?.value, resumeAutoBuyAmount])

  // An account carries its own market and currency; outside FX, the cash
  // moves in that same currency.
  useEffect(() => {
    const resolved = asset && resolveAssetSelection(asset, combinedOptions)
    if (!resolved) return
    setValue("tradeCurrency", typeOption(resolved.currency))
    if (!isFx) setValue("cashCurrency", typeOption(resolved.currency))
    setValue("market", resolved.market)
  }, [asset, combinedOptions, setValue, isFx])

  // Outside FX the cash amount is the trade amount; in FX it comes from the
  // rate (above).
  useEffect(() => {
    const tradeAmount = parseFloat(
      calculateTradeAmount(qty, 1, tax, fees, type.value).toFixed(2),
    )
    setValue("tradeAmount", tradeAmount)
    if (type.value !== "FX") setValue("cashAmount", tradeAmount)
  }, [tax, fees, type, qty, setValue])

  if (ccyLoading) return rootLoader("Loading...")
  if (!modalOpen) return null

  const submit = handleSubmit(async (data) => {
    setSubmitError(null)
    const err = await onSubmit(portfolio, errors, data, (open) => {
      setModalOpen(open)
      if (!open) refreshHoldingsSoon(mutate, portfolio.code)
    })
    if (err) setSubmitError(err)
  })

  const sellInfo = resolveFxDisplayInfo(asset, combinedOptions)
  const buyInfo = resolveFxDisplayInfo(
    cashCurrency?.value ?? "",
    combinedOptions,
  )
  const fieldProps = {
    control,
    labelClassName: labelClass,
    inputClassName: inputClass,
  }
  const validationErrors = Object.values(errors)
    .map((error) => error?.message)
    .filter(Boolean)

  return (
    <TrnFormDialog
      title={cashType.title}
      subtitle={`${portfolio.code} · ${portfolio.name}`}
      status={<TrnStatusField control={control} />}
      tabs={
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SegmentedChoice
              name="cash-type"
              legend="Transaction type"
              value={cashType.value}
              options={CASH_TYPES}
              onChange={(value) => field.onChange(typeOption(value))}
            />
          )}
        />
      }
      copyRow={() => convert(buildCashCopyData(getValues(), market ?? "CASH"))}
      isDirty={isDirty}
      onClose={() => setModalOpen(false)}
      onSubmit={() => void submit()}
      submitLabel="Submit"
      summary={
        isFx ? (
          <FxSummary
            sellAmount={qty}
            sellLabel={sellInfo.label}
            buyAmount={cashAmount}
            buyLabel={buyInfo.label}
          />
        ) : (
          qty > 0 && (
            <TrnSummary
              label={cashType.label}
              amount={cashAmount}
              currency={sellCurrency}
              scheme={getCashFlowColorScheme(cashType.flow)}
            >
              {!sellInfo.isCash && (
                <span className="truncate text-xs text-gray-500">
                  {cashType.flow === "in" ? "into " : "from "}
                  {sellInfo.label}
                </span>
              )}
            </TrnSummary>
          )
        )
      }
    >
      <form
        id="cash-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cash-account" className={labelClass}>
              {isFx ? "From" : "Cash account"}
            </label>
            <Controller
              name="asset"
              control={control}
              render={({ field }) => (
                <CashAccountSelect
                  id="cash-account"
                  value={field.value}
                  options={combinedOptions}
                  onChange={(option) => field.onChange(option.value)}
                  className={inputClass}
                />
              )}
            />
          </div>
          <TrnMathField
            {...fieldProps}
            id="cash-amount"
            name="quantity"
            label={isFx ? "Sell amount" : "Amount"}
          />
        </div>

        {isFx && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cash-buy-account" className={labelClass}>
                {"To"}
              </label>
              <Controller
                name="cashCurrency"
                control={control}
                render={({ field }) => (
                  <CashAccountSelect
                    id="cash-buy-account"
                    value={field.value.value}
                    options={buyOptions}
                    onChange={(option) =>
                      field.onChange({
                        value: option.value,
                        label: option.label,
                        market: option.market ?? "CASH",
                      })
                    }
                    className={inputClass}
                  />
                )}
              />
            </div>
            <div>
              <TrnMathField
                {...fieldProps}
                id="cash-buy-amount"
                name="cashAmount"
                label={"Buy amount"}
                onChange={handleBuyAmountChange}
              />
              <FxRateHint
                marketRate={fxRate}
                impliedRate={
                  qty > 0 && cashAmount > 0 ? cashAmount / qty : null
                }
                manual={manualBuyAmount}
                loading={fxRateLoading}
                failed={fxRateFailed}
                onUseMarketRate={resumeAutoBuyAmount}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <TrnDateField
              {...fieldProps}
              id="cash-trade-date"
              name="tradeDate"
              label={"Trade date"}
            />
          </div>
          <TrnMathField
            {...fieldProps}
            id="cash-fees"
            name="fees"
            label={"Fees"}
          />
          <TrnMathField
            {...fieldProps}
            id="cash-tax"
            name="tax"
            label={"Tax"}
          />
        </div>

        <TrnTextField
          {...fieldProps}
          id="cash-comment"
          name="comment"
          label={"Comments"}
        />

        {submitError && <Alert>{submitError}</Alert>}
        {validationErrors.length > 0 && (
          <Alert>{validationErrors.join(" ")}</Alert>
        )}
      </form>
    </TrnFormDialog>
  )
}

export default CashInputForm
