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
import {
  marketsKey,
  simpleFetcher,
  tradeAccountsKey,
  ccyKey,
} from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import SettlementAccountSelect from "@components/features/transactions/SettlementAccountSelect"
import AssetSearchInput, { AssetOption } from "@components/features/transactions/AssetSearchInput"
import {
  onSubmit,
  useEscapeHandler,
  copyToClipboard,
} from "@lib/trns/formUtils"
import { convert } from "@lib/trns/tradeUtils"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

const TradeTypeValues = ["BUY", "SELL", "ADD", "REDUCE", "DIVI", "SPLIT"] as const

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  asset: "",
  market: "US",
  tradeDate: new Date().toISOString().split("T")[0],
  quantity: 0,
  price: 0,
  tradeCurrency: { value: "USD", label: "USD" },
  settlementAccount: { value: "", label: "", currency: "" },
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
  tradeCurrency: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
    })
    .required(),
  tradeAmount: yup.number(),
  settlementAccount: yup
    .object()
    .shape({
      value: yup.string(),
      label: yup.string(),
      currency: yup.string(),
    })
    .nullable(),
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
  const [targetWeight, setTargetWeight] = useState<string>("")

  const handleCopy = async (): Promise<void> => {
    const formData = getValues()
    // Map form fields to TradeFormData format
    // Use settlement account's currency as tradeCurrency if available
    const settlementCurrency = formData.settlementAccount?.currency || "USD"
    const data = {
      ...formData,
      tradeCurrency: { value: settlementCurrency, label: settlementCurrency },
      cashCurrency: { value: settlementCurrency, label: settlementCurrency },
      comments: formData.comment ?? undefined,
    }
    const row = convert(data as any)
    const success = await copyToClipboard(row)
    setCopyStatus(success ? "success" : "error")
    setTimeout(() => setCopyStatus("idle"), 2000)
  }

  // Reset form with initial values when modal opens with quick sell data
  useEffect(() => {
    if (modalOpen && initialValues) {
      const tradeType = initialValues.type || "SELL"
      reset({
        ...defaultValues,
        type: { value: tradeType, label: tradeType },
        asset: initialValues.asset,
        market: initialValues.market,
        quantity: initialValues.quantity,
        price: initialValues.price,
      })
      setTargetWeight("")
    } else if (modalOpen && !initialValues) {
      reset(defaultValues)
      setTargetWeight("")
    }
  }, [modalOpen, initialValues, reset])

  const { data: marketsData, isLoading: marketsLoading } = useSwr(
    marketsKey,
    simpleFetcher(marketsKey),
  )
  const { data: tradeAccountsData, isLoading: tradeAccountsLoading } = useSwr(
    tradeAccountsKey,
    simpleFetcher(tradeAccountsKey),
  )
  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const { t } = useTranslation("common")

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")

  // Calculate current weight from position data
  // Use currentPositionQuantity if available (rebalance), otherwise use quantity (quick sell)
  const currentPositionWeight = useMemo(() => {
    const positionQty =
      initialValues?.currentPositionQuantity ?? initialValues?.quantity
    if (!positionQty || !price || !portfolio.marketValue) {
      return null
    }
    const positionValue = positionQty * price
    return (positionValue / portfolio.marketValue) * 100
  }, [
    initialValues?.currentPositionQuantity,
    initialValues?.quantity,
    price,
    portfolio.marketValue,
  ])

  // Get the actual current position quantity for calculations
  const actualPositionQuantity =
    initialValues?.currentPositionQuantity ?? initialValues?.quantity ?? 0

  // Handle target weight change - calculate and set quantity
  const handleTargetWeightChange = (newTargetWeight: string): void => {
    setTargetWeight(newTargetWeight)

    const targetWeightNum = parseFloat(newTargetWeight)
    if (
      isNaN(targetWeightNum) ||
      !price ||
      !portfolio.marketValue ||
      currentPositionWeight === null
    ) {
      return
    }

    const targetValue = (targetWeightNum / 100) * portfolio.marketValue
    const currentValue = (currentPositionWeight / 100) * portfolio.marketValue
    const valueDiff = targetValue - currentValue
    const requiredShares = Math.round(Math.abs(valueDiff) / price)

    // Set the quantity
    setValue("quantity", requiredShares)

    // Set the trade type based on direction
    const newType = valueDiff >= 0 ? "BUY" : "SELL"
    setValue("type", { value: newType, label: newType })
  }

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

    if (type.value === "SELL" && actualPositionQuantity > 0) {
      // For SELL with position data, show new position weight
      const newWeight = calculateNewPositionWeight(
        actualPositionQuantity,
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
    } else if (type.value === "BUY" && actualPositionQuantity > 0) {
      // For BUY with position data, show new position weight after buying
      const currentPositionValue = actualPositionQuantity * price
      const newPositionValue = currentPositionValue + tradeAmount
      const newWeight = (newPositionValue / portfolio.marketValue) * 100
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
  }, [quantity, price, tax, fees, portfolio.marketValue, type.value, actualPositionQuantity])

  useEscapeHandler(isDirty, setModalOpen)

  if (marketsLoading || tradeAccountsLoading || ccyLoading)
    return rootLoader(t("loading"))

  // Get trade accounts for settlement account dropdown
  const tradeAccounts = tradeAccountsData?.data
    ? Object.values(tradeAccountsData.data)
    : []
  // Get currencies for settlement account dropdown
  const currencies = ccyData?.data || []

  // Get market options from the fetched data
  // Filter out CASH and US exchange markets (use US market instead)
  const excludedMarkets = ["CASH", "AMEX", "NYSE", "NASDAQ"]
  const marketOptions =
    marketsData?.data
      ?.filter(
        (market: { code: string }) => !excludedMarkets.includes(market.code),
      )
      .map((market: { code: string; name: string }) => ({
        value: market.code,
        label: market.name || market.code,
      })) || []

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:overflow-visible overflow-hidden">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setModalOpen(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 md:mx-auto z-50 md:max-h-none max-h-[90vh] md:block flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center border-b p-6 pb-4 shrink-0">
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
              className="space-y-4 md:overflow-visible overflow-y-auto flex-1 p-6 pt-4"
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
                    name: "settlementAccount",
                    label: t("trn.settlement.account"),
                    component: (
                      <SettlementAccountSelect
                        name="settlementAccount"
                        control={control}
                        accounts={tradeAccounts as any[]}
                        currencies={currencies}
                        trnType={type?.value || "BUY"}
                        accountsLabel={t("settlement.tradeAccounts", "Trade Accounts")}
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
                      <AssetSearchInput
                        name="asset"
                        control={control}
                        market={watch("market")}
                        defaultValue={initialValues?.asset}
                        onAssetSelect={(option: AssetOption | null) => {
                          // Set the trade currency to match the asset's currency
                          if (option?.currency) {
                            setValue("tradeCurrency", {
                              value: option.currency,
                              label: option.currency,
                            })
                          }
                        }}
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
                          <select
                            {...field}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          >
                            {marketOptions.map(
                              (option: { value: string; label: string }) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                        )}
                      />
                    ),
                  },
                  {
                    name: "quantity",
                    label:
                      actualPositionQuantity > 0
                        ? `${t("quantity")} (${actualPositionQuantity.toLocaleString()} held)`
                        : t("quantity"),
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
              {/* Target Weight Input - shown when we have position data */}
              {currentPositionWeight !== null && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-purple-800">
                        {t("rebalance.currentWeight")}:
                      </span>
                      <span className="text-lg font-bold text-purple-900">
                        {currentPositionWeight.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-purple-800">
                        {t("rebalance.targetWeight")}:
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={targetWeight}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (e.target.value === "" || val >= 0) {
                            handleTargetWeightChange(e.target.value)
                          }
                        }}
                        placeholder={currentPositionWeight.toFixed(1)}
                        className="w-20 px-2 py-1 border border-purple-300 rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                      />
                      <span className="text-purple-600">%</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-800">
                      {weightInfo ? weightInfo.label : "Trade Weight"}:{" "}
                      <span className="text-lg font-bold">
                        {weightInfo ? `${weightInfo.value.toFixed(2)}%` : "—"}
                      </span>
                    </span>
                    {weightInfo?.tradeWeight !== undefined && (
                      <span className="text-sm text-blue-600">
                        ({type.value === "SELL" ? "Reducing" : "Adding"}{" "}
                        {weightInfo.tradeWeight.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-blue-500">
                    of {portfolio.currency.symbol}
                    {portfolio.marketValue.toLocaleString()} portfolio
                  </span>
                </div>
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

export default TradeInputForm

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
