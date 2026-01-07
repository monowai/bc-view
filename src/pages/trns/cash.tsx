import React, { useEffect, useState, useMemo, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Asset, CurrencyOption, Portfolio } from "types/beancounter"
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

  useEscapeHandler(isDirty, setModalOpen)

  // Combine currency options with account options
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

  // Update market and currency when asset changes
  useEffect(() => {
    if (asset) {
      const selected = combinedOptions.find((opt) => opt.value === asset)
      if (selected) {
        setSelectedMarket(selected.market || "CASH")
        const currency = selected.currency || asset
        setValue("tradeCurrency", { value: currency, label: currency })
        setValue("cashCurrency", { value: currency, label: currency })
        setValue("market", selected.market || "CASH")
      }
    }
  }, [asset, combinedOptions, setValue])

  useEffect(() => {
    const tradeAmount = calculateTradeAmount(qty, 1, tax, fees, type.value)
    setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
    setValue("cashAmount", parseFloat(tradeAmount.toFixed(2)))
  }, [tax, fees, type, qty, setValue])

  // Only wait for currencies - accounts are optional enhancement
  if (ccyLoading) return rootLoader(t("loading"))

  const ccyOptions = currencyOptions(ccyData.data)

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
              <h2 className="text-xl font-semibold">{t("trade.cash.title")}</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </header>
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
                  {
                    name: "asset",
                    label: t("trade.cash.account"),
                    component: (
                      <Controller
                        name="asset"
                        control={control}
                        defaultValue={portfolio.currency.code}
                        render={({ field }) => (
                          <select
                            {...field}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
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
                  // Cash Currency - only shown for FX transactions
                  ...(type.value === "FX"
                    ? [
                        {
                          name: "cashCurrency",
                          label: t("trn.currency.cash"),
                          component: (
                            <Controller
                              name="cashCurrency"
                              control={control}
                              render={({ field }) => (
                                <select
                                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                                  value={field.value.value}
                                  onChange={(e) => {
                                    const selected = ccyOptions.find(
                                      (opt: CurrencyOption) =>
                                        opt.value === e.target.value,
                                    )
                                    if (selected) {
                                      field.onChange(selected)
                                    }
                                  }}
                                >
                                  {ccyOptions.map((option: CurrencyOption) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    name: "quantity",
                    label: t("trn.amount.trade"),
                    component: (
                      <Controller
                        name="quantity"
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
