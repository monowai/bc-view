import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { FxResponse, Portfolio } from "types/beancounter"
import { SelectInstance } from "react-select"
import { calculateTradeAmount } from "@lib/trns/tradeUtils"
import { useTranslation } from "next-i18next"
import useSwr, { mutate } from "swr"
import { ccyKey, holdingKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { CurrencyOptionSchema } from "@lib/portfolio/schema"
import {
  onSubmit,
  useEscapeHandler,
  copyToClipboard,
} from "@lib/trns/formUtils"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { convert } from "@lib/trns/tradeUtils"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import TradeStatusToggle from "@components/ui/TradeStatusToggle"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import DateInput from "@components/ui/DateInput"
import MathInput from "@components/ui/MathInput"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import {
  buildCombinedAssetOptions,
  resolveFxCurrencyPair,
  resolveAssetSelection,
  calculateFxBuyAmount,
  filterFxBuyOptions,
  buildCashCopyData,
  resolveFxDisplayInfo,
} from "@lib/trns/cashFormHelpers"

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

const TradeTypeValues = [
  "DEPOSIT",
  "WITHDRAWAL",
  "INCOME",
  "DEDUCTION",
  "FX",
] as const



const defaultValues = {
  type: { value: "DEPOSIT", label: "DEPOSIT" },
  status: { value: "SETTLED", label: "SETTLED" },
  asset: "USD",
  market: "CASH",
  tradeDate: new Date().toISOString().split("T")[0],
  tradeCurrency: { value: "USD", label: "USD" },
  cashCurrency: { value: "USD", label: "USD" },
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

const CashInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  initialAsset?: string
}> = ({ portfolio, modalOpen, setModalOpen, initialAsset }) => {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(cashSchema),
    defaultValues,
  })

  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle",
  )
  const typeSelectRef =
    useRef<SelectInstance<{ value: string; label: string }>>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (modalOpen) {
      reset({
        ...defaultValues,
        asset: initialAsset || defaultValues.asset,
      })
    }
  }, [modalOpen, reset, initialAsset])

  // Focus type select when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        typeSelectRef.current?.focus()
      }, 100)
    }
  }, [modalOpen])

  const [selectedMarket, setSelectedMarket] = useState("CASH")
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleCopy = async (): Promise<void> => {
    const data = buildCashCopyData(getValues(), selectedMarket)
    const row = convert(data)
    const success = await copyToClipboard(row)
    setCopyStatus(success ? "success" : "error")
    setTimeout(() => setCopyStatus("idle"), 2000)
  }

  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const { data: accountsData, error: accountsError } = useSwr(
    "/api/assets?category=ACCOUNT",
    simpleFetcher("/api/assets?category=ACCOUNT"),
  )
  const { data: tradeAccountsData } = useSwr(
    "/api/assets?category=TRADE",
    simpleFetcher("/api/assets?category=TRADE"),
  )

  // Log accounts fetch status for debugging
  useEffect(() => {
    if (accountsError) {
      console.log("Failed to fetch accounts:", accountsError)
    }
  }, [accountsData, accountsError])

  const { t } = useTranslation("common")

  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")
  const qty = watch("quantity")
  const asset = watch("asset")
  const cashCurrency = watch("cashCurrency")

  const { showEscapeConfirm, onEscapeConfirm, onEscapeCancel } =
    useEscapeHandler(isDirty, setModalOpen)

  // Combine currency options with account options (must be before FX rate logic)
  const combinedOptions = useMemo(
    () =>
      buildCombinedAssetOptions(
        ccyData?.data,
        accountsData?.data,
        tradeAccountsData?.data,
      ),
    [ccyData?.data, accountsData?.data, tradeAccountsData?.data],
  )

  // FX rate state
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxRateLoading, setFxRateLoading] = useState(false)
  const [manualBuyAmount, setManualBuyAmount] = useState(false)

  // Fetch FX rate when currencies change (for FX transactions)
  useEffect(() => {
    if (type.value !== "FX" || !asset || !cashCurrency?.value) {
      setFxRate(null)
      return
    }

    const pair = resolveFxCurrencyPair(
      asset,
      cashCurrency.value,
      combinedOptions,
    )
    if (!pair) {
      setFxRate(null)
      return
    }

    setFxRateLoading(true)
    fxFetcher(pair.sellCurrency, pair.buyCurrency)
      .then((response) => {
        if (response?.data?.rates) {
          const key = `${pair.sellCurrency}:${pair.buyCurrency}`
          const rate = response.data.rates[key]?.rate
          setFxRate(rate ?? null)
        } else {
          setFxRate(null)
        }
      })
      .catch(() => setFxRate(null))
      .finally(() => setFxRateLoading(false))
  }, [type.value, asset, cashCurrency?.value, combinedOptions])

  // Auto-calculate buy amount when sell amount or rate changes
  useEffect(() => {
    if (type.value === "FX" && fxRate && qty > 0 && !manualBuyAmount) {
      setValue("cashAmount", calculateFxBuyAmount(qty, fxRate))
    }
  }, [type.value, fxRate, qty, manualBuyAmount, setValue])

  // Reset manual override when currencies change
  useEffect(() => {
    setManualBuyAmount(false)
  }, [asset, cashCurrency?.value])

  // Handle manual buy amount change
  const handleBuyAmountChange = useCallback(
    (value: number) => {
      setManualBuyAmount(true)
      setValue("cashAmount", value)
    },
    [setValue],
  )

  // Update market and currency when asset changes
  useEffect(() => {
    if (asset) {
      const resolved = resolveAssetSelection(asset, combinedOptions)
      if (resolved) {
        setSelectedMarket(resolved.market)
        setValue("tradeCurrency", {
          value: resolved.currency,
          label: resolved.currency,
        })
        // For FX transactions, don't sync cashCurrency to sell currency
        if (type.value !== "FX") {
          setValue("cashCurrency", {
            value: resolved.currency,
            label: resolved.currency,
          })
        }
        setValue("market", resolved.market)
      }
    }
  }, [asset, combinedOptions, setValue, type.value])

  useEffect(() => {
    const tradeAmount = calculateTradeAmount(qty, 1, tax, fees, type.value)
    setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
    // For FX transactions, cashAmount is calculated from FX rate, not tradeAmount
    if (type.value !== "FX") {
      setValue("cashAmount", parseFloat(tradeAmount.toFixed(2)))
    }
  }, [tax, fees, type, qty, setValue])

  // Common CSS classes (matching trade form)
  const inputClass =
    "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
  const labelClass =
    "block text-xs font-medium text-gray-500 uppercase tracking-wide"

  // Only wait for currencies - accounts are optional enhancement
  if (ccyLoading) return rootLoader(t("loading"))

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          ></div>
          <div
            className="bg-white sm:rounded-xl shadow-2xl w-full sm:max-w-lg sm:mx-4 p-4 sm:p-5 z-50 text-sm flex flex-col max-h-[95vh] sm:max-h-[90vh] rounded-t-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="flex-shrink-0 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <button
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  onClick={() => setModalOpen(false)}
                  title={t("cancel")}
                >
                  <i className="fas fa-times"></i>
                </button>
                <div className="text-center flex-1 px-3">
                  <div className="font-semibold text-gray-900">
                    {type.value === "FX"
                      ? t("trade.fx.title", "FX Trade")
                      : t("trade.cash.title")}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {portfolio.code} - {portfolio.name}
                  </div>
                </div>
                <button
                  type="button"
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    copyStatus === "success"
                      ? "text-green-600 bg-green-50"
                      : copyStatus === "error"
                        ? "text-red-500 bg-red-50"
                        : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                  }`}
                  onClick={handleCopy}
                  title={t("copy")}
                >
                  <i
                    className={`fas ${copyStatus === "success" ? "fa-check" : copyStatus === "error" ? "fa-times" : "fa-copy"} text-xs`}
                  ></i>
                </button>
              </div>

              {/* Cash Transaction Summary */}
              {type.value !== "FX" && qty > 0 && (
                <div
                  className={`rounded-lg p-3 flex items-center justify-center gap-4 ${
                    type.value === "WITHDRAWAL" || type.value === "DEDUCTION"
                      ? "bg-red-50 border border-red-100"
                      : "bg-emerald-50 border border-emerald-100"
                  }`}
                >
                  <div className="text-center">
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        type.value === "WITHDRAWAL" ||
                        type.value === "DEDUCTION"
                          ? "text-red-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {type.value}
                    </div>
                    <div className="font-bold text-lg text-gray-900">
                      {qty.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {resolveFxDisplayInfo(asset, combinedOptions).label}
                    </div>
                  </div>
                </div>
              )}

              {/* FX Trade Summary */}
              {type.value === "FX" && (
                <div className="rounded-lg p-3 bg-linear-to-r from-red-50 to-green-50 border border-gray-200">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                        Sell
                      </div>
                      <div className="font-bold text-lg text-gray-900">
                        {qty > 0 ? qty.toLocaleString() : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {resolveFxDisplayInfo(asset, combinedOptions).label}
                      </div>
                    </div>
                    <div className="text-center text-gray-300">
                      <i className="fas fa-arrow-right text-xs"></i>
                      {fxRateLoading ? (
                        <div className="text-xs mt-1 text-gray-400">
                          <Spinner />
                        </div>
                      ) : fxRate ? (
                        <div className="text-xs mt-1 font-mono text-gray-500">
                          @{fxRate.toFixed(4)}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                        Buy
                      </div>
                      <div className="font-bold text-lg text-gray-900">
                        {(watch("cashAmount") ?? 0) > 0
                          ? (watch("cashAmount") ?? 0).toLocaleString()
                          : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {
                          resolveFxDisplayInfo(
                            cashCurrency?.value ?? "",
                            combinedOptions,
                          ).label
                        }
                      </div>
                    </div>
                  </div>
                  {fxRate && !manualBuyAmount && (
                    <div className="text-center text-xs text-gray-400 mt-2">
                      Rate auto-applied from FX service
                    </div>
                  )}
                  {manualBuyAmount && (
                    <div className="text-center text-xs text-amber-600 mt-2">
                      Manual amount entered
                    </div>
                  )}
                </div>
              )}
            </header>

            <form
              onSubmit={handleSubmit(async (data) => {
                setSubmitError(null)
                const err = await onSubmit(portfolio, errors, data, (open) => {
                  setModalOpen(open)
                  if (!open) {
                    setTimeout(() => {
                      mutate(holdingKey(portfolio.code, "today"))
                      mutate("/api/holdings/aggregated?asAt=today")
                    }, 1500)
                  }
                })
                if (err) setSubmitError(err)
              })}
              className="flex-1 overflow-y-auto py-4 space-y-4"
            >
              {submitError && (
                <Alert>{submitError}</Alert>
              )}
              {/* Type, Status, Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("trn.type")}</label>
                  <TradeTypeController
                    ref={typeSelectRef}
                    name="type"
                    control={control}
                    options={TradeTypeValues.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("trn.status")}</label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <div className="mt-2">
                        <TradeStatusToggle
                          isSettled={field.value.value === "SETTLED"}
                          onChange={(isSettled) => {
                            const newStatus = isSettled ? "SETTLED" : "PROPOSED"
                            field.onChange({ value: newStatus, label: newStatus })
                          }}
                          size="sm"
                        />
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Date - for non-FX */}
              {type.value !== "FX" && (
                <div>
                  <label className={labelClass}>{t("trn.tradeDate")}</label>
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
              )}

              {/* Account/Currency and Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    {type.value === "FX"
                      ? t("trn.fx.sellCurrency", "Sell Currency")
                      : t("trade.cash.account")}
                  </label>
                  <Controller
                    name="asset"
                    control={control}
                    defaultValue={portfolio.currency.code}
                    render={({ field }) => (
                      <select
                        {...field}
                        className={`${inputClass} ${
                          type.value === "FX"
                            ? "border-red-200 bg-red-50 focus:border-red-400 focus:ring-red-400"
                            : ""
                        }`}
                        value={field.value}
                      >
                        <optgroup label="Currencies">
                          {combinedOptions
                            .filter((opt) => opt.market === "CASH")
                            .map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </optgroup>
                        {combinedOptions.some(
                          (opt) => opt.market === "PRIVATE",
                        ) && (
                          <optgroup label="Bank Accounts">
                            {combinedOptions
                              .filter((opt) => opt.market === "PRIVATE")
                              .map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                          </optgroup>
                        )}
                        {combinedOptions.some(
                          (opt) => opt.market === "TRADE",
                        ) && (
                          <optgroup label="Trade Accounts">
                            {combinedOptions
                              .filter((opt) => opt.market === "TRADE")
                              .map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  />
                  {errors.asset && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.asset.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    {type.value === "FX"
                      ? t("trn.fx.sellAmount", "Sell Amount")
                      : t("trn.amount.trade")}
                  </label>
                  <Controller
                    name="quantity"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        value={field.value}
                        onChange={field.onChange}
                        className={`${inputClass} ${
                          type.value === "FX"
                            ? "border-red-200 bg-red-50 focus:border-red-400 focus:ring-red-400"
                            : ""
                        }`}
                      />
                    )}
                  />
                </div>
              </div>

              {/* FX-specific: Buy Currency, Buy Amount, Date */}
              {type.value === "FX" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        {t("trn.fx.buyCurrency", "Buy Currency")}
                      </label>
                      <Controller
                        name="cashCurrency"
                        control={control}
                        render={({ field }) => {
                          const sellCurrency = resolveAssetSelection(
                            asset,
                            combinedOptions,
                          )?.currency
                          const buyOptions = filterFxBuyOptions(
                            combinedOptions,
                            sellCurrency,
                          )

                          return (
                            <select
                              className={`${inputClass} border-emerald-200 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-400`}
                              value={field.value.value}
                              onChange={(e) => {
                                const selected = combinedOptions.find(
                                  (opt) => opt.value === e.target.value,
                                )
                                if (selected) {
                                  field.onChange({
                                    value: selected.value,
                                    label: selected.label,
                                    currency: selected.currency,
                                    market: selected.market,
                                  })
                                }
                              }}
                            >
                              <optgroup label="Currencies">
                                {buyOptions
                                  .filter((opt) => opt.market === "CASH")
                                  .map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                              </optgroup>
                              {buyOptions.some(
                                (opt) => opt.market === "PRIVATE",
                              ) && (
                                <optgroup label="Bank Accounts">
                                  {buyOptions
                                    .filter((opt) => opt.market === "PRIVATE")
                                    .map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                </optgroup>
                              )}
                              {buyOptions.some(
                                (opt) => opt.market === "TRADE",
                              ) && (
                                <optgroup label="Trade Accounts">
                                  {buyOptions
                                    .filter((opt) => opt.market === "TRADE")
                                    .map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                </optgroup>
                              )}
                            </select>
                          )
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("trn.fx.buyAmount", "Buy Amount")}
                      </label>
                      <Controller
                        name="cashAmount"
                        control={control}
                        render={({ field }) => (
                          <MathInput
                            value={field.value}
                            onChange={handleBuyAmountChange}
                            className={`${inputClass} border-emerald-200 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-400`}
                          />
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{t("trn.tradeDate")}</label>
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
                </>
              )}

              {/* Fees, Tax, Comments */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
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
                <div>
                  <label className={labelClass}>{t("trn.amount.tax")}</label>
                  <Controller
                    name="tax"
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
              </div>

              <div>
                <label className={labelClass}>{t("trn.comments")}</label>
                <Controller
                  name="comment"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className={inputClass}
                      value={field.value || ""}
                    />
                  )}
                />
              </div>

              {Object.keys(errors).length > 0 && (
                <Alert>
                  {Object.values(errors)
                    .map((error) => error?.message)
                    .join(" ")}
                </Alert>
              )}
            </form>

            {/* Footer */}
            <div className="flex-shrink-0 pt-3 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                form="cash-form"
                className="px-5 py-2.5 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors"
                onClick={handleSubmit(async (data) => {
                  setSubmitError(null)
                  const err = await onSubmit(portfolio, errors, data, (open) => {
                    setModalOpen(open)
                    if (!open) {
                      setTimeout(() => {
                        mutate(holdingKey(portfolio.code, "today"))
                        mutate("/api/holdings/aggregated?asAt=today")
                      }, 1500)
                    }
                  })
                  if (err) setSubmitError(err)
                })}
              >
                {t("submit", "Submit")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEscapeConfirm && (
        <ConfirmDialog
          title="Unsaved Changes"
          message="You have unsaved changes. Do you really want to close?"
          confirmLabel="Close"
          cancelLabel="Cancel"
          variant="amber"
          onConfirm={onEscapeConfirm}
          onCancel={onEscapeCancel}
        />
      )}
    </>
  )
}

export default CashInputForm

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
