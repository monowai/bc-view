import React, { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Portfolio, QuickSellData } from "types/beancounter"
import {
  calculateTradeAmount,
  calculateTradeWeight,
  calculateNewPositionWeight,
} from "@lib/trns/tradeUtils"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { CurrencyOptionSchema } from "@lib/portfolio/schema"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import {
  onSubmit,
  useEscapeHandler,
  copyToClipboard,
} from "@lib/trns/formUtils"
import { convert } from "@lib/trns/tradeUtils"
import { currencyOptions, toCurrencyOption } from "@lib/currency"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

const TradeTypeValues = ["BUY", "SELL", "DIVI", "SPLIT"] as const

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  asset: "",
  market: "US",
  tradeDate: new Date().toISOString().split("T")[0],
  quantity: 0,
  price: 0,
  tradeCurrency: { value: "USD", label: "USD" },
  cashCurrency: { value: "USD", label: "USD" },
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
}

const schema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.label),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().default(0).required(),
  price: yup.number().required().default(0),
  tradeAmount: yup.number(),
  cashCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  comment: yup.string().notRequired(),
})

const TradeInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  initialValues?: QuickSellData
}> = ({ portfolio, modalOpen, setModalOpen, initialValues }) => {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
  })

  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle",
  )

  const handleCopy = async (): Promise<void> => {
    const formData = getValues()
    // Map form fields to TradeFormData format
    const data = {
      ...formData,
      tradeCurrency: formData.cashCurrency,
      comments: formData.comment ?? undefined,
    }
    const row = convert(data)
    const success = await copyToClipboard(row)
    setCopyStatus(success ? "success" : "error")
    setTimeout(() => setCopyStatus("idle"), 2000)
  }

  // Reset form with initial values when modal opens with quick sell data
  useEffect(() => {
    if (modalOpen && initialValues) {
      reset({
        ...defaultValues,
        type: { value: "SELL", label: "SELL" },
        asset: initialValues.asset,
        market: initialValues.market,
        quantity: initialValues.quantity,
        price: initialValues.price,
      })
    } else if (modalOpen && !initialValues) {
      reset(defaultValues)
    }
  }, [modalOpen, initialValues, reset])
  const { data: ccyData, isLoading } = useSwr(ccyKey, simpleFetcher(ccyKey))
  const { t } = useTranslation("common")

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")

  useEffect(() => {
    if (quantity && price) {
      const tradeAmount = calculateTradeAmount(
        quantity,
        price,
        tax,
        fees,
        type.value,
      )
      setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
    }
  }, [quantity, price, tax, fees, type, setValue])

  // Calculate trade weight based on type
  const weightInfo = useMemo(() => {
    if (!quantity || !price || !portfolio.marketValue) {
      return null
    }

    const tradeAmount = calculateTradeAmount(
      quantity,
      price,
      tax,
      fees,
      type.value,
    )

    if (type.value === "SELL" && initialValues) {
      // For SELL with initial values (quick sell), show new position weight
      const newWeight = calculateNewPositionWeight(
        initialValues.quantity,
        quantity,
        price,
        portfolio.marketValue,
      )
      const tradeWeight = calculateTradeWeight(
        tradeAmount,
        portfolio.marketValue,
      )
      return {
        label: "New Weight",
        value: newWeight,
        tradeWeight: tradeWeight,
      }
    } else if (type.value === "BUY") {
      // For BUY, show the weight this trade would represent
      const weight = calculateTradeWeight(tradeAmount, portfolio.marketValue)
      return {
        label: "Trade Weight",
        value: weight,
      }
    } else if (type.value === "SELL") {
      // For SELL without initial values, show trade as % of portfolio
      const weight = calculateTradeWeight(tradeAmount, portfolio.marketValue)
      return {
        label: "Selling",
        value: weight,
      }
    }
    return null
  }, [
    quantity,
    price,
    tax,
    fees,
    portfolio.marketValue,
    initialValues,
    type.value,
  ])

  useEscapeHandler(isDirty, setModalOpen)

  if (isLoading) return rootLoader(t("loading"))

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
              <h2 className="text-xl font-semibold">
                {t("trade.market.title")}
              </h2>
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
                    name: "tradeDate",
                    label: t("trn.tradeDate"),
                    component: (
                      <Controller
                        name="tradeDate"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="date"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "cashCurrency",
                    label: t("trn.currency.cash"),
                    component: (
                      <Controller
                        name="cashCurrency"
                        control={control}
                        defaultValue={toCurrencyOption(portfolio.currency)}
                        render={({ field }) => (
                          <select
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                            value={field.value.value}
                            onChange={(e) => {
                              const selected = ccyOptions.find(
                                (opt) => opt.value === e.target.value,
                              )
                              field.onChange(selected)
                            }}
                          >
                            {ccyOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    ),
                  },
                  {
                    name: "cashAmount",
                    label: t("trn.amount.cash"),
                    component: (
                      <Controller
                        name="cashAmount"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "asset",
                    label: t("trn.asset.code"),
                    component: (
                      <Controller
                        name="asset"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "market",
                    label: t("trn.market.code"),
                    component: (
                      <Controller
                        name="market"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "quantity",
                    label: t("quantity"),
                    component: (
                      <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "price",
                    label: t("trn.price"),
                    component: (
                      <Controller
                        name="price"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
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
                          <input
                            {...field}
                            type="number"
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
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "tradeAmount",
                    label: t("trn.amount.trade"),
                    component: (
                      <Controller
                        name="tradeAmount"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
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
              {weightInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-blue-800">
                        {weightInfo.label}:{" "}
                        <span className="text-lg font-bold">
                          {weightInfo.value.toFixed(2)}%
                        </span>
                      </span>
                      {weightInfo.tradeWeight !== undefined && (
                        <span className="text-sm text-blue-600">
                          (Reducing by {weightInfo.tradeWeight.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-blue-500">
                      of {portfolio.currency.symbol}
                      {portfolio.marketValue.toLocaleString()} portfolio
                    </span>
                  </div>
                </div>
              )}
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

export default TradeInputForm

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
