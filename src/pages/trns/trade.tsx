import React, { useEffect, useMemo, useState, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Portfolio, QuickSellData, Broker } from "types/beancounter"
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
  optionalFetcher,
  tradeAccountsKey,
  accountsKey,
  ccyKey,
  cashKey,
} from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import SettlementAccountSelect from "@components/features/transactions/SettlementAccountSelect"
import AssetSearchInput, {
  AssetOption,
} from "@components/features/transactions/AssetSearchInput"
import {
  onSubmit,
  useEscapeHandler,
  copyToClipboard,
} from "@lib/trns/formUtils"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import { convert } from "@lib/trns/tradeUtils"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NumericFormat } from "react-number-format"

const TradeTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
] as const

const StatusValues = ["SETTLED", "PROPOSED"] as const

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  status: { value: "SETTLED", label: "SETTLED" },
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
  brokerId: "",
}

const schema = yup.object().shape({
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
  brokerId: yup.string().default(""),
})

// Common CSS classes
const inputClass =
  "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"

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

  const { t } = useTranslation("common")
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle",
  )
  const [targetWeight, setTargetWeight] = useState<string>("")
  const [tradeValue, setTradeValue] = useState<string>("")
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Fetch brokers for dropdown
  const { data: brokersData } = useSwr(
    "/api/brokers",
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = brokersData?.data || []

  const handleCopy = async (): Promise<void> => {
    const formData = getValues()
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
      setTradeValue("")
      setShowMore(false)
    } else if (modalOpen && !initialValues) {
      reset(defaultValues)
      setTargetWeight("")
      setTradeValue("")
      setShowMore(false)
    }
  }, [modalOpen, initialValues, reset])

  // Focus date input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        dateInputRef.current?.focus()
      }, 100)
    }
  }, [modalOpen])

  const { data: marketsData, isLoading: marketsLoading } = useSwr(
    marketsKey,
    simpleFetcher(marketsKey),
  )
  const { data: tradeAccountsData, isLoading: tradeAccountsLoading } = useSwr(
    tradeAccountsKey,
    simpleFetcher(tradeAccountsKey),
  )
  const { data: bankAccountsData } = useSwr(
    accountsKey,
    simpleFetcher(accountsKey),
  )
  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const { data: cashAssetsData } = useSwr(null, optionalFetcher(cashKey))

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")
  const tradeCurrency = watch("tradeCurrency")
  const asset = watch("asset")

  // Calculate current weight from position data
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

  const actualPositionQuantity =
    initialValues?.currentPositionQuantity ?? initialValues?.quantity ?? 0

  // Handle target weight change
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

    setValue("quantity", requiredShares)
    const newType = valueDiff >= 0 ? "BUY" : "SELL"
    setValue("type", { value: newType, label: newType })
  }

  // Handle trade value change
  const handleTradeValueChange = (newTradeValue: string): void => {
    setTradeValue(newTradeValue)

    const valueNum = parseFloat(newTradeValue)
    if (isNaN(valueNum) || !price || price <= 0) {
      return
    }

    const calculatedQuantity = Math.floor(valueNum / price)
    setValue("quantity", calculatedQuantity)
  }

  // Fetch price for selected asset
  const fetchAssetPrice = async (
    market: string,
    assetCode: string,
  ): Promise<number | null> => {
    setIsFetchingPrice(true)
    try {
      const response = await fetch(`/api/prices/${market}/${assetCode}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      if (data.data && data.data.length > 0) {
        return data.data[0].close
      }
      return null
    } catch {
      return null
    } finally {
      setIsFetchingPrice(false)
    }
  }

  // Handle asset selection
  const handleAssetSelect = async (
    option: AssetOption | null,
  ): Promise<void> => {
    if (!option) {
      return
    }

    if (option.currency) {
      setValue("tradeCurrency", {
        value: option.currency,
        label: option.currency,
      })
    }

    const market = option.market || watch("market")
    if (market && option.value) {
      const fetchedPrice = await fetchAssetPrice(market, option.value)
      if (fetchedPrice !== null) {
        setValue("price", fetchedPrice)
      }
    }
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

  // Calculate trade weight
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
      const weight = calculateTradeWeight(tradeAmount, portfolio.marketValue)
      return {
        label: "Trade Weight",
        value: weight,
      }
    } else if (type.value === "SELL") {
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
    type.value,
    actualPositionQuantity,
  ])

  useEscapeHandler(isDirty, setModalOpen)

  // Helper to get currency from an asset
  const getAssetCurrency = (assetData: any): string => {
    if (assetData.market?.code === "CASH") {
      return assetData.code
    }
    return assetData.priceSymbol || assetData.market?.currency?.code || ""
  }

  const currentTradeCurrency = tradeCurrency?.value || "USD"

  // All bank accounts - show all currencies for settlement flexibility
  const allBankAccounts = useMemo(() => {
    const accounts = bankAccountsData?.data
      ? Object.values(bankAccountsData.data)
      : []
    // Sort: matching currency first, then alphabetically
    return (accounts as any[]).sort((a, b) => {
      const aCurrency = getAssetCurrency(a)
      const bCurrency = getAssetCurrency(b)
      const aMatches = aCurrency === currentTradeCurrency ? 0 : 1
      const bMatches = bCurrency === currentTradeCurrency ? 0 : 1
      if (aMatches !== bMatches) return aMatches - bMatches
      return (a.name || a.code).localeCompare(b.name || b.code)
    })
  }, [bankAccountsData, currentTradeCurrency])

  // All trade accounts - show all currencies, SettlementAccountSelect handles grouping
  const allTradeAccounts = useMemo(() => {
    const accounts = tradeAccountsData?.data
      ? Object.values(tradeAccountsData.data)
      : []
    return accounts as any[]
  }, [tradeAccountsData])

  // Generate cash balance options from all available currencies
  const allCashBalances = useMemo(() => {
    // Start with any existing cash assets from the backend
    const existingAssets = cashAssetsData?.data
      ? Object.values(cashAssetsData.data)
      : []

    // Get all currency codes from the currencies endpoint
    const allCurrencies: string[] = ccyData?.data
      ? ccyData.data.map((c: any) => c.code)
      : []

    // Build a map of existing cash assets by currency code
    const existingByCurrency = new Map<string, any>()
    ;(existingAssets as any[]).forEach((asset: any) => {
      existingByCurrency.set(asset.code, asset)
    })

    // Create cash balance entries for all currencies
    const balances = allCurrencies.map((code: string) => {
      const existing = existingByCurrency.get(code)
      if (existing) {
        return existing
      }
      // Create synthetic cash balance for this currency
      return {
        id: "", // Empty - backend will create/find generic balance
        code,
        name: code,
        market: { code: "CASH" },
      }
    })

    // Sort: matching currency first, then alphabetically
    return balances.sort((a: any, b: any) => {
      const aMatches = a.code === currentTradeCurrency ? 0 : 1
      const bMatches = b.code === currentTradeCurrency ? 0 : 1
      if (aMatches !== bMatches) return aMatches - bMatches
      return a.code.localeCompare(b.code)
    })
  }, [cashAssetsData, ccyData, currentTradeCurrency])

  // Filtered versions for default selection (matching currency only)
  const filteredCashAssets = useMemo(() => {
    return allCashBalances.filter((a: any) => a.code === currentTradeCurrency)
  }, [allCashBalances, currentTradeCurrency])

  const defaultCashAsset = useMemo(() => {
    const cashAsset = filteredCashAssets[0] as any
    if (cashAsset) {
      return {
        value: cashAsset.id,
        label: `${cashAsset.name || cashAsset.code} Balance`,
        currency: cashAsset.code,
        market: "CASH",
      }
    }
    return {
      value: "",
      label: `${currentTradeCurrency} Balance`,
      currency: currentTradeCurrency,
      market: "CASH",
    }
  }, [filteredCashAssets, currentTradeCurrency])

  // Cash assets for dropdown - all currency balances are already included
  const cashAssetsForDropdown = useMemo(() => {
    return allCashBalances
  }, [allCashBalances])

  // Auto-set default settlement account when trade currency changes
  useEffect(() => {
    const currentSettlement = watch("settlementAccount")
    if (
      !currentSettlement?.value ||
      currentSettlement.currency !== currentTradeCurrency
    ) {
      setValue("settlementAccount", defaultCashAsset)
    }
  }, [currentTradeCurrency, defaultCashAsset, setValue, watch])

  if (marketsLoading || tradeAccountsLoading || ccyLoading)
    return rootLoader(t("loading"))

  // Get market options
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

  const hasCashImpact = !["ADD", "REDUCE", "SPLIT"].includes(type?.value)
  const tradeAmount = watch("tradeAmount") || 0

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setModalOpen(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 z-50 text-sm flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with trade summary */}
            <header className="flex-shrink-0 pb-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <button
                  className="text-gray-400 hover:text-gray-600 p-1"
                  onClick={() => setModalOpen(false)}
                  title={t("cancel")}
                >
                  <i className="fas fa-times"></i>
                </button>
                <div className="text-center flex-1 px-2">
                  <div className="font-semibold">
                    {asset || t("trade.market.title")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {portfolio.code} - {portfolio.name}
                  </div>
                </div>
                <button
                  type="button"
                  className={`p-1 ${
                    copyStatus === "success"
                      ? "text-green-600"
                      : copyStatus === "error"
                        ? "text-red-500"
                        : "text-green-600 hover:text-green-700"
                  }`}
                  onClick={handleCopy}
                  title={t("copy")}
                >
                  <i
                    className={`fas ${copyStatus === "success" ? "fa-check" : copyStatus === "error" ? "fa-times" : "fa-copy"}`}
                  ></i>
                </button>
              </div>

              {/* Trade Value Summary */}
              <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className={`text-xs font-medium uppercase ${
                      type?.value === "SELL"
                        ? "text-red-600"
                        : type?.value === "ADD" || type?.value === "REDUCE"
                          ? "text-blue-600"
                          : "text-green-600"
                    }`}
                  >
                    {type?.value || "BUY"}
                  </div>
                  <div className="font-bold">
                    <NumericFormat
                      value={quantity || 0}
                      displayType="text"
                      thousandSeparator
                      decimalScale={2}
                    />
                    {!hasCashImpact && (
                      <span className="text-gray-500 text-sm ml-1">
                        {t("trn.units", "units")}
                      </span>
                    )}
                  </div>
                  {hasCashImpact && (
                    <div className="text-xs text-gray-500">
                      @ {price?.toFixed(2)} {tradeCurrency?.value}
                    </div>
                  )}
                </div>
                {hasCashImpact && tradeAmount > 0 && (
                  <>
                    <div className="text-gray-300 px-3">
                      <i className="fas fa-arrow-right text-xs"></i>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.trade")}
                      </div>
                      <div className="font-bold">
                        <NumericFormat
                          value={tradeAmount}
                          displayType="text"
                          thousandSeparator
                          decimalScale={2}
                          fixedDecimalScale
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {tradeCurrency?.value}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Weight info */}
              {weightInfo && (
                <div className="mt-2 text-center text-xs text-blue-600">
                  {weightInfo.label}: {weightInfo.value.toFixed(2)}%
                  {weightInfo.tradeWeight !== undefined && (
                    <span className="text-gray-500 ml-2">
                      ({type.value === "SELL" ? "-" : "+"}
                      {weightInfo.tradeWeight.toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}
            </header>

            {/* Scrollable form content */}
            <form
              id="trade-form"
              onSubmit={handleSubmit((data) => {
                // Derive cashCurrency from settlement account (settlement account is source of truth)
                const settlementCurrency =
                  data.settlementAccount?.currency ||
                  data.tradeCurrency?.value ||
                  "USD"
                const dataWithCashCurrency = {
                  ...data,
                  cashCurrency: {
                    value: settlementCurrency,
                    label: settlementCurrency,
                  },
                }
                onSubmit(portfolio, errors, dataWithCashCurrency, setModalOpen)
              })}
              className="flex-1 overflow-y-auto py-3 space-y-3"
            >
              {/* Type and Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.type")}
                  </label>
                  <TradeTypeController
                    name="type"
                    control={control}
                    options={TradeTypeValues.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.tradeDate")}
                  </label>
                  <Controller
                    name="tradeDate"
                    control={control}
                    render={({ field }) => (
                      <DateInput
                        ref={dateInputRef}
                        value={field.value}
                        onChange={field.onChange}
                        className={inputClass}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Market and Asset */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.market.code")}
                  </label>
                  <Controller
                    name="market"
                    control={control}
                    render={({ field }) => (
                      <select {...field} className={inputClass}>
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
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {isFetchingPrice
                      ? `${t("trn.asset.code")} ...`
                      : t("trn.asset.code")}
                  </label>
                  <AssetSearchInput
                    name="asset"
                    control={control}
                    market={watch("market")}
                    defaultValue={initialValues?.asset}
                    onAssetSelect={handleAssetSelect}
                  />
                </div>
              </div>

              {/* Quantity, Price, Fees */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {actualPositionQuantity > 0
                      ? `${t("quantity")} (${actualPositionQuantity.toLocaleString()})`
                      : t("quantity")}
                  </label>
                  <Controller
                    name="quantity"
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
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.price")}
                  </label>
                  <Controller
                    name="price"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        value={field.value}
                        onChange={field.onChange}
                        step="0.01"
                        className={inputClass}
                      />
                    )}
                  />
                </div>
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
              </div>

              {/* Settlement Account */}
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  {t("trn.settlement.account")}
                </label>
                <SettlementAccountSelect
                  name="settlementAccount"
                  control={control}
                  accounts={allTradeAccounts as any[]}
                  bankAccounts={allBankAccounts as any[]}
                  cashAssets={cashAssetsForDropdown as any[]}
                  trnType={type?.value || "BUY"}
                  tradeCurrency={currentTradeCurrency}
                  defaultValue={defaultCashAsset}
                />
              </div>

              {/* Broker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.broker", "Broker")}
                  </label>
                  <a
                    href="/brokers"
                    target="_blank"
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    {t("brokers.manage", "Manage")}
                  </a>
                </div>
                <Controller
                  name="brokerId"
                  control={control}
                  render={({ field }) => (
                    <select
                      className={inputClass}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">
                        {t("trn.broker.none", "-- No broker --")}
                      </option>
                      {brokers.map((broker) => (
                        <option key={broker.id} value={broker.id}>
                          {broker.name}
                          {broker.accountNumber
                            ? ` (${broker.accountNumber})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>

              {/* Expandable "More" section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMore(!showMore)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i
                    className={`fas fa-chevron-${showMore ? "up" : "down"} text-xs`}
                  ></i>
                  {showMore
                    ? t("trn.showLess", "Less")
                    : t("trn.showMore", "More options")}
                </button>

                {showMore && (
                  <div className="mt-2 space-y-2 pt-2 border-t border-gray-100">
                    {/* Status */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.status")}
                      </label>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <select
                            className={inputClass}
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
                    </div>

                    {/* Invest Value - calculate quantity from total */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.invest.value", "Invest Value")}
                      </label>
                      <div className="relative">
                        <MathInput
                          value={tradeValue ? parseFloat(tradeValue) : 0}
                          onChange={(value) =>
                            handleTradeValueChange(String(value))
                          }
                          placeholder={
                            price > 0
                              ? t(
                                  "trn.invest.placeholder",
                                  "Enter amount to invest",
                                )
                              : t("trn.invest.needPrice", "Set price first")
                          }
                          disabled={!price || price <= 0}
                          className={`${inputClass} disabled:bg-gray-100`}
                        />
                        {price > 0 && tradeValue && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                            = {Math.floor(parseFloat(tradeValue) / price)}{" "}
                            shares
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target Weight - if position data available */}
                    {currentPositionWeight !== null && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-purple-800">
                            {t("rebalance.currentWeight")}:{" "}
                            {currentPositionWeight.toFixed(2)}%
                          </span>
                          <span className="text-xs text-purple-600">→</span>
                          <span className="text-xs font-medium text-purple-800">
                            {t("rebalance.targetWeight")}:
                          </span>
                          <MathInput
                            value={targetWeight ? parseFloat(targetWeight) : 0}
                            onChange={(value) => {
                              if (value >= 0) {
                                handleTargetWeightChange(String(value))
                              }
                            }}
                            placeholder={currentPositionWeight.toFixed(1)}
                            className="w-16 px-2 py-1 border border-purple-300 rounded text-xs"
                          />
                          <span className="text-purple-600 text-xs">%</span>
                        </div>
                      </div>
                    )}

                    {/* Trade/Cash Amounts */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          {t("trn.amount.trade")}
                        </label>
                        <Controller
                          name="tradeAmount"
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
                        <label className="block text-xs font-medium text-gray-600">
                          {t("trn.amount.cash")}
                        </label>
                        <Controller
                          name="cashAmount"
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

                    {/* Tax */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.amount.tax")}
                      </label>
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

                    {/* Comments */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.comments", "Comments")}
                      </label>
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
                  </div>
                )}
              </div>

              {/* Error Display */}
              {Object.keys(errors).length > 0 && (
                <div className="text-red-500 text-xs bg-red-50 p-2 rounded">
                  {Object.values(errors)
                    .map((error) => error?.message)
                    .join(" ")}
                </div>
              )}
            </form>

            {/* Sticky footer */}
            <div className="flex-shrink-0 pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setModalOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                form="trade-form"
                className="px-4 py-2 rounded text-white text-sm bg-blue-500 hover:bg-blue-600"
              >
                {t("submit", "Submit")}
              </button>
            </div>
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
