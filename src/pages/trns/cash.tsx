import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Asset, CurrencyOption, FxResponse, Portfolio } from "types/beancounter"
import { SelectInstance } from "react-select"
import { calculateTradeAmount } from "@lib/trns/tradeUtils"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { CurrencyOptionSchema } from "@lib/portfolio/schema"
import {
  onSubmit,
  useEscapeHandler,
  copyToClipboard,
} from "@lib/trns/formUtils"
import { convert } from "@lib/trns/tradeUtils"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import { currencyOptions } from "@lib/currency"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import DateInput from "@components/ui/DateInput"
import MathInput from "@components/ui/MathInput"

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

const StatusValues = ["SETTLED", "PROPOSED"] as const

// Extended option that includes market info for accounts
interface AssetOption extends CurrencyOption {
  market?: string // CASH for currencies, PRIVATE for accounts
  currency?: string // For accounts, the currency of the account
}

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
}> = ({ portfolio, modalOpen, setModalOpen }) => {
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
      reset(defaultValues)
    }
  }, [modalOpen, reset])

  // Focus type select when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        typeSelectRef.current?.focus()
      }, 100)
    }
  }, [modalOpen])

  const [selectedMarket, setSelectedMarket] = useState("CASH")

  const handleCopy = async (): Promise<void> => {
    const formData = getValues()
    // Map form fields to TradeFormData format
    const data = {
      ...formData,
      market: selectedMarket,
      price: 1, // Cash transactions always have price of 1
      comments: formData.comment ?? undefined,
    }
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

  useEscapeHandler(isDirty, setModalOpen)

  // Combine currency options with account options (must be before FX rate logic)
  const combinedOptions = useMemo(() => {
    const options: AssetOption[] = []

    // Add currencies (market: CASH)
    if (ccyData?.data) {
      currencyOptions(ccyData.data).forEach((opt: CurrencyOption) => {
        options.push({ ...opt, market: "CASH", currency: opt.value })
      })
    }

    // Add user's bank accounts (market: PRIVATE, category: ACCOUNT)
    // For ACCOUNT assets, the currency is stored in priceSymbol
    if (accountsData?.data) {
      Object.values(accountsData.data as Record<string, Asset>).forEach(
        (account) => {
          const accountCurrency =
            account.priceSymbol || account.market?.currency?.code || "?"
          options.push({
            value: account.code,
            label: `${account.name} (${accountCurrency})`,
            market: "PRIVATE",
            currency: accountCurrency,
          })
        },
      )
    }

    // Add user's trade accounts (market: PRIVATE, category: TRADE)
    if (tradeAccountsData?.data) {
      Object.values(tradeAccountsData.data as Record<string, Asset>).forEach(
        (account) => {
          const accountCurrency =
            account.priceSymbol || account.market?.currency?.code || "?"
          options.push({
            value: account.code,
            label: `${account.name} (${accountCurrency})`,
            market: "TRADE",
            currency: accountCurrency,
          })
        },
      )
    }

    return options
  }, [ccyData?.data, accountsData?.data, tradeAccountsData?.data])

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

    // Get the sell currency (from asset or its currency property)
    const sellCurrency = combinedOptions.find(
      (opt) => opt.value === asset,
    )?.currency

    // Get the buy currency - could be a currency code or an account with a currency property
    const buyOption = combinedOptions.find(
      (opt) => opt.value === cashCurrency.value,
    )
    const buyCurrency = buyOption?.currency || cashCurrency.value

    if (!sellCurrency || sellCurrency === buyCurrency) {
      setFxRate(null)
      return
    }

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
  }, [type.value, asset, cashCurrency?.value, combinedOptions])

  // Auto-calculate buy amount when sell amount or rate changes
  useEffect(() => {
    if (type.value === "FX" && fxRate && qty > 0 && !manualBuyAmount) {
      const buyAmount = qty * fxRate
      setValue("cashAmount", parseFloat(buyAmount.toFixed(2)))
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
      const selected = combinedOptions.find((opt) => opt.value === asset)
      if (selected) {
        setSelectedMarket(selected.market || "CASH")
        const currency = selected.currency || asset
        setValue("tradeCurrency", { value: currency, label: currency })
        // For FX transactions, don't sync cashCurrency to sell currency
        // User needs to select a different buy currency
        if (type.value !== "FX") {
          setValue("cashCurrency", { value: currency, label: currency })
        }
        setValue("market", selected.market || "CASH")
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

  // Only wait for currencies - accounts are optional enhancement
  if (ccyLoading) return rootLoader(t("loading"))

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setModalOpen(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-xl font-semibold">
                {type.value === "FX"
                  ? t("trade.fx.title", "FX Trade")
                  : t("trade.cash.title")}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </header>
            {/* FX Trade Summary */}
            {type.value === "FX" && (
              <div className="mb-4 p-3 bg-linear-to-r from-red-50 to-green-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-red-600 font-medium uppercase">
                      Sell
                    </div>
                    <div className="font-bold text-red-700">
                      {qty > 0 && <>{qty.toLocaleString()} </>}
                      {(() => {
                        const sellOpt = combinedOptions.find(
                          (opt) => opt.value === asset,
                        )
                        // Show account name for accounts, currency code for currencies
                        return sellOpt?.market !== "CASH"
                          ? sellOpt?.label || asset
                          : asset
                      })()}
                    </div>
                  </div>
                  <div className="text-center text-gray-500">
                    <i className="fas fa-arrow-right"></i>
                    {fxRateLoading ? (
                      <div className="text-xs mt-1">
                        <i className="fas fa-spinner fa-spin"></i>
                      </div>
                    ) : fxRate ? (
                      <div className="text-xs mt-1 font-mono">
                        @{fxRate.toFixed(4)}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-green-600 font-medium uppercase">
                      Buy
                    </div>
                    <div className="font-bold text-green-700">
                      {(watch("cashAmount") ?? 0) > 0 && (
                        <>{(watch("cashAmount") ?? 0).toLocaleString()} </>
                      )}
                      {(() => {
                        const buyCcy = watch("cashCurrency")
                        const buyOpt = combinedOptions.find(
                          (opt) => opt.value === buyCcy?.value,
                        )
                        // Show account name for accounts, currency code for currencies
                        return buyOpt?.market !== "CASH"
                          ? buyOpt?.label || buyCcy?.value
                          : (buyCcy?.value ?? "")
                      })()}
                    </div>
                  </div>
                </div>
                {fxRate && !manualBuyAmount && (
                  <div className="text-center text-xs text-gray-500 mt-2">
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
            <form
              onSubmit={handleSubmit((data) =>
                onSubmit(portfolio, errors, data, setModalOpen),
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: "type",
                    label: t("trn.type"),
                    component: (
                      <TradeTypeController
                        ref={typeSelectRef}
                        name="type"
                        control={control}
                        options={TradeTypeValues.map((value) => ({
                          value,
                          label: value,
                        }))}
                      />
                    ),
                  },
                  {
                    name: "status",
                    label: t("trn.status"),
                    component: (
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <select
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                            value={field.value.value}
                            onChange={(e) => {
                              field.onChange({
                                value: e.target.value,
                                label: e.target.value,
                              })
                            }}
                          >
                            {StatusValues.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    ),
                  },
                  // Trade Date - show here for non-FX, moved later for FX
                  ...(type.value !== "FX"
                    ? [
                        {
                          name: "tradeDate",
                          label: t("trn.tradeDate"),
                          component: (
                            <Controller
                              name="tradeDate"
                              control={control}
                              render={({ field }) => (
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                                />
                              )}
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    name: "asset",
                    label:
                      type.value === "FX"
                        ? t("trn.fx.sellCurrency", "Sell Currency")
                        : t("trade.cash.account"),
                    component: (
                      <Controller
                        name="asset"
                        control={control}
                        defaultValue={portfolio.currency.code}
                        render={({ field }) => (
                          <select
                            {...field}
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height ${
                              type.value === "FX"
                                ? "border-red-200 bg-red-50"
                                : ""
                            }`}
                            value={field.value}
                          >
                            <optgroup label="Currencies">
                              {combinedOptions
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
                            {combinedOptions.some(
                              (opt) => opt.market === "PRIVATE",
                            ) && (
                              <optgroup label="Bank Accounts">
                                {combinedOptions
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
                            {combinedOptions.some(
                              (opt) => opt.market === "TRADE",
                            ) && (
                              <optgroup label="Trade Accounts">
                                {combinedOptions
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
                        )}
                      />
                    ),
                  },
                  // Sell Amount - immediately after Sell Currency
                  {
                    name: "quantity",
                    label:
                      type.value === "FX"
                        ? t("trn.fx.sellAmount", "Sell Amount")
                        : t("trn.amount.trade"),
                    component: (
                      <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                          <MathInput
                            value={field.value}
                            onChange={field.onChange}
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height ${
                              type.value === "FX"
                                ? "border-red-200 bg-red-50"
                                : ""
                            }`}
                          />
                        )}
                      />
                    ),
                  },
                  // Buy Currency - only shown for FX transactions
                  ...(type.value === "FX"
                    ? [
                        {
                          name: "cashCurrency",
                          label: t("trn.fx.buyCurrency", "Buy Currency"),
                          component: (
                            <Controller
                              name="cashCurrency"
                              control={control}
                              render={({ field }) => {
                                // Get the sell currency to filter out same-currency options
                                const sellOption = combinedOptions.find(
                                  (opt) => opt.value === asset,
                                )
                                const sellCurrency = sellOption?.currency

                                // Filter options to exclude same currency
                                const buyOptions = combinedOptions.filter(
                                  (opt) => opt.currency !== sellCurrency,
                                )

                                return (
                                  <select
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height bg-green-50"
                                    value={field.value.value}
                                    onChange={(e) => {
                                      const selected = combinedOptions.find(
                                        (opt) => opt.value === e.target.value,
                                      )
                                      if (selected) {
                                        // Store the currency code for FX rate calculation
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
                                          .filter(
                                            (opt) => opt.market === "PRIVATE",
                                          )
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
                                          .filter(
                                            (opt) => opt.market === "TRADE",
                                          )
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
                          ),
                        },
                        // Buy Amount - immediately after Buy Currency
                        {
                          name: "cashAmount",
                          label: t("trn.fx.buyAmount", "Buy Amount"),
                          component: (
                            <Controller
                              name="cashAmount"
                              control={control}
                              render={({ field }) => (
                                <MathInput
                                  value={field.value}
                                  onChange={handleBuyAmountChange}
                                  className="mt-1 block w-full rounded-md shadow-sm input-height border-green-200 bg-green-50"
                                />
                              )}
                            />
                          ),
                        },
                        // Trade Date - for FX, placed after the currency pairs
                        {
                          name: "tradeDate",
                          label: t("trn.tradeDate"),
                          component: (
                            <Controller
                              name="tradeDate"
                              control={control}
                              render={({ field }) => (
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                                />
                              )}
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    name: "fees",
                    label: t("trn.amount.charges"),
                    component: (
                      <Controller
                        name="fees"
                        control={control}
                        render={({ field }) => (
                          <MathInput
                            value={field.value}
                            onChange={field.onChange}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "tax",
                    label: t("trn.amount.tax"),
                    component: (
                      <Controller
                        name="tax"
                        control={control}
                        render={({ field }) => (
                          <MathInput
                            value={field.value}
                            onChange={field.onChange}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "comment",
                    label: t("trn.comments"),
                    component: (
                      <Controller
                        name="comment"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="text"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                            value={field.value || ""}
                          />
                        )}
                      />
                    ),
                  },
                ].map(({ name, label, component }) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700">
                      {label}
                    </label>
                    {errors[name as keyof typeof errors] && (
                      <p className="text-red-500 text-xs">
                        {errors[name as keyof typeof errors]?.message}
                      </p>
                    )}
                    {component}
                  </div>
                ))}
              </div>
              <div className="text-red-500 text-xs">
                {Object.values(errors)
                  .map((error) => error?.message)
                  .join(" ")}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className={`${
                    copyStatus === "success"
                      ? "bg-green-600"
                      : copyStatus === "error"
                        ? "bg-red-500"
                        : "bg-green-500 hover:bg-green-600"
                  } text-white px-4 py-2 rounded transition-colors duration-200`}
                  onClick={handleCopy}
                >
                  <i
                    className={`fas ${copyStatus === "success" ? "fa-check fa-bounce" : copyStatus === "error" ? "fa-times fa-shake" : "fa-copy"} mr-2`}
                  ></i>
                  {copyStatus === "success"
                    ? "Copied!"
                    : copyStatus === "error"
                      ? "Failed"
                      : "Copy"}
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Submit
                </button>
                <button
                  type="button"
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
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
