import React, { useEffect, useMemo, useState, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  Portfolio,
  QuickSellData,
  BrokerWithAccounts,
  Transaction,
} from "types/beancounter"
import { ModelDto } from "types/rebalance"
import {
  calculateTradeAmount,
  hasCashImpact,
  isExpenseType,
  isIncomeType,
  isSimpleAmountType,
  deriveDefaultMarket,
} from "@lib/trns/tradeUtils"
import { useTranslation } from "next-i18next"
import useSwr, { mutate } from "swr"
import {
  marketsKey,
  simpleFetcher,
  optionalFetcher,
  tradeAccountsKey,
  accountsKey,
  ccyKey,
  cashKey,
  modelsKey,
} from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import SettlementAccountSelect from "@components/features/transactions/SettlementAccountSelect"
import BrokerSelectionDialog from "@components/features/transactions/BrokerSelectionDialog"
import TradeFormHeader from "@components/features/transactions/TradeFormHeader"
import TradeFormTabs from "@components/features/transactions/TradeFormTabs"
import AssetSearch from "@components/features/assets/AssetSearch"
import { AssetOption } from "types/beancounter"
import { useEscapeHandler, copyToClipboard } from "@lib/trns/formUtils"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import { convert } from "@lib/trns/tradeUtils"
import {
  computeWeightInfo,
  computeCurrentPositionWeight,
  calculateQuantityFromTargetWeight,
  calculateQuantityFromTradeValue,
  buildEditModeValues,
  buildQuickSellValues,
  buildCreateModeValues,
  filterBankAccountsByCurrency,
  buildAllCashBalances,
  buildDefaultCashAsset,
  resolveBrokerSettlementAccount,
  brokerHasSettlementForCurrency,
} from "@lib/trns/tradeFormHelpers"
import {
  submitEditMode,
  submitExpense,
  submitIncome,
  submitCreateMode,
} from "@lib/trns/tradeSubmit"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { getDisplayCode } from "@lib/assets/assetUtils"

const TradeTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
  "EXPENSE",
  "INCOME",
] as const

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  status: { value: "PROPOSED", label: "PROPOSED" },
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
  "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
const labelClass =
  "block text-xs font-medium text-gray-500 uppercase tracking-wide"

// Props for edit mode
interface EditModeProps {
  transaction: Transaction
  onClose: () => void
  onDelete: () => void
}

const TradeInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  initialValues?: QuickSellData
  // Edit mode props - when transaction is provided, form is in edit mode
  editMode?: EditModeProps
}> = ({ portfolio, modalOpen, setModalOpen, initialValues, editMode }) => {
  const isEditMode = !!editMode
  const transaction = editMode?.transaction
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
  const [activeTab, setActiveTab] = useState<"trade" | "invest">("trade")
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Edit mode state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    transaction?.portfolio.id || portfolio.id,
  )

  // Broker selection dialog state (for QuickSell with multiple brokers)
  const [showBrokerSelectionDialog, setShowBrokerSelectionDialog] =
    useState(false)

  // Model selection state (edit mode only)
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    transaction?.modelId,
  )
  const [suggestedModelId, setSuggestedModelId] = useState<string | undefined>(
    undefined,
  )
  const modelInitializedRef = useRef(false)
  const initialModelIdRef = useRef<string | undefined>(transaction?.modelId)

  // Track whether the user has manually overridden computed amounts.
  // When set, the auto-recalculation useEffect is skipped.
  const tradeAmountOverriddenRef = useRef(false)
  const cashAmountOverriddenRef = useRef(false)

  // Fetch portfolios for portfolio move (edit mode)
  const { data: portfoliosData } = useSwr(
    isEditMode ? "/api/portfolios" : null,
    simpleFetcher("/api/portfolios"),
  )
  const portfolios: Portfolio[] = portfoliosData?.data || []

  // Fetch models for model selection (edit mode only)
  const { data: modelsData } = useSwr(
    isEditMode ? modelsKey : null,
    simpleFetcher(modelsKey),
  )
  const models: ModelDto[] = modelsData?.data || []

  // Try to determine suggested model from callerRef (for rebalance transactions)
  // Only runs once on initial load - won't overwrite user selections
  useEffect(() => {
    if (!isEditMode || !transaction || modelInitializedRef.current) return

    // Mark as initialized so we don't overwrite user selections
    modelInitializedRef.current = true

    // If transaction already has modelId, no need to suggest - it's already set
    if (transaction.modelId) {
      return
    }

    // If callerRef has REBALANCE provider, try to get model from execution
    if (
      transaction.callerRef?.provider === "REBALANCE" &&
      transaction.callerRef.batch
    ) {
      const executionId = transaction.callerRef.batch
      fetch(`/api/rebalance/executions/${executionId}`)
        .then((res) => {
          if (res.ok) return res.json()
          return null
        })
        .then((data) => {
          if (data?.data?.modelId) {
            setSuggestedModelId(data.data.modelId)
            // Auto-select since transaction has no modelId (we only reach here if transaction.modelId is falsy)
            setSelectedModelId(data.data.modelId)
            // Update initial ref so modelChanged tracks from this auto-selected value
            initialModelIdRef.current = data.data.modelId
          }
        })
        .catch(() => {
          // Execution might have been deleted, ignore
        })
    }
  }, [isEditMode, transaction])

  // Check if portfolio changed (edit mode)
  const portfolioChanged =
    isEditMode && selectedPortfolioId !== transaction?.portfolio.id

  // Check if model changed from initial value (edit mode)
  const modelChanged =
    isEditMode && selectedModelId !== initialModelIdRef.current

  // For edit mode: get asset info from transaction
  const editAssetCode = transaction ? getDisplayCode(transaction.asset) : ""
  const editAssetName = transaction?.asset.name || ""
  const editMarketCode = transaction?.asset.market.code || ""

  // Fetch brokers with settlement accounts for dropdown
  const { data: brokersData } = useSwr(
    "/api/brokers?includeAccounts=true",
    simpleFetcher("/api/brokers?includeAccounts=true"),
  )
  const brokers: BrokerWithAccounts[] = useMemo(
    () => brokersData?.data || [],
    [brokersData?.data],
  )

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

  // Show broker selection dialog when QuickSell has multiple brokers
  useEffect(() => {
    if (modalOpen && initialValues?.held) {
      const brokerCount = Object.keys(initialValues.held).length
      if (brokerCount > 1) {
        setShowBrokerSelectionDialog(true)
      }
    }
  }, [modalOpen, initialValues?.held])

  const { data: marketsData, isLoading: marketsLoading } = useSwr(
    marketsKey,
    simpleFetcher(marketsKey),
  )

  // Derive default market from portfolio currency (e.g., NZD → NZX, AUD → ASX)
  // Falls back to user's preferred market when currency doesn't match any market
  const portfolioDefaultMarket = useMemo(
    () => deriveDefaultMarket(portfolio.currency.code, marketsData?.data || []),
    [marketsData, portfolio.currency.code],
  )

  // Reset form with initial values when modal opens
  useEffect(() => {
    if (modalOpen && isEditMode && transaction) {
      // Edit mode: populate from transaction
      reset(buildEditModeValues(transaction))
      setSelectedPortfolioId(transaction.portfolio.id)
      setTargetWeight("")
      setTradeValue("")
      setSubmitError(null)
    } else if (modalOpen && initialValues) {
      // Quick sell mode: populate from initialValues
      reset(buildQuickSellValues(initialValues, defaultValues))
      setTargetWeight("")
      setTradeValue("")
    } else if (modalOpen && !initialValues && !isEditMode) {
      // Create mode: reset to defaults, using portfolio-appropriate market
      reset(
        buildCreateModeValues(
          defaultValues,
          portfolioDefaultMarket,
          portfolio.currency.code,
        ),
      )
      setTargetWeight("")
      setTradeValue("")
    }
  }, [
    modalOpen,
    initialValues,
    reset,
    isEditMode,
    transaction,
    editAssetCode,
    editMarketCode,
    portfolioDefaultMarket,
    portfolio.currency.code,
  ])

  // Focus date input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        dateInputRef.current?.focus()
      }, 100)
    }
  }, [modalOpen])

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
  const positionQty =
    initialValues?.currentPositionQuantity ?? initialValues?.quantity ?? 0
  const currentPositionWeight = useMemo(
    () =>
      computeCurrentPositionWeight(positionQty, price, portfolio.marketValue),
    [positionQty, price, portfolio.marketValue],
  )

  const actualPositionQuantity = positionQty

  // Handle target weight change
  const handleTargetWeightChange = (newTargetWeight: string): void => {
    setTargetWeight(newTargetWeight)
    if (currentPositionWeight === null) return
    const result = calculateQuantityFromTargetWeight(
      parseFloat(newTargetWeight),
      currentPositionWeight,
      price,
      portfolio.marketValue,
    )
    if (!result) return
    setValue("quantity", result.quantity)
    setValue("type", { value: result.tradeType, label: result.tradeType })
  }

  // Handle trade value change
  const handleTradeValueChange = (newTradeValue: string): void => {
    setTradeValue(newTradeValue)
    const qty = calculateQuantityFromTradeValue(
      parseFloat(newTradeValue),
      price,
    )
    if (qty !== null) setValue("quantity", qty)
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
    // Skip price fetching for private assets - they don't have external market data
    if (market && option.value && market !== "PRIVATE" && market !== "CASH") {
      const fetchedPrice = await fetchAssetPrice(market, option.value)
      if (fetchedPrice !== null) {
        setValue("price", fetchedPrice)
      }
    }
  }

  useEffect(() => {
    if (tradeAmountOverriddenRef.current) return
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
  const weightInfo = useMemo(
    () =>
      computeWeightInfo({
        quantity,
        price,
        tax,
        fees,
        tradeType: type.value,
        portfolioMarketValue: portfolio.marketValue,
        actualPositionQuantity,
      }),
    [
      quantity,
      price,
      tax,
      fees,
      portfolio.marketValue,
      type.value,
      actualPositionQuantity,
    ],
  )

  useEscapeHandler(isDirty, setModalOpen)

  const currentTradeCurrency = tradeCurrency?.value || "USD"

  // All bank accounts - needed for broker settlement lookups by ID
  const allBankAccounts = useMemo(() => {
    const accounts = bankAccountsData?.data
      ? Object.values(bankAccountsData.data)
      : []
    return accounts as any[]
  }, [bankAccountsData])

  // Bank accounts filtered by trade currency - for settlement dropdown
  const filteredBankAccounts = useMemo(
    () => filterBankAccountsByCurrency(allBankAccounts, currentTradeCurrency),
    [allBankAccounts, currentTradeCurrency],
  )

  // All trade accounts - show all currencies, SettlementAccountSelect handles grouping
  const allTradeAccounts = useMemo(() => {
    const accounts = tradeAccountsData?.data
      ? Object.values(tradeAccountsData.data)
      : []
    return accounts as any[]
  }, [tradeAccountsData])

  // Generate cash balance options from all available currencies
  const allCashBalances = useMemo(() => {
    const existingAssets = cashAssetsData?.data
      ? (Object.values(cashAssetsData.data) as any[])
      : []
    const currencies: string[] = ccyData?.data
      ? ccyData.data.map((c: any) => c.code)
      : []
    return buildAllCashBalances(
      existingAssets,
      currencies,
      currentTradeCurrency,
    )
  }, [cashAssetsData, ccyData, currentTradeCurrency])

  // Filtered versions for default selection (matching currency only)
  const filteredCashAssets = useMemo(() => {
    return allCashBalances.filter((a: any) => a.code === currentTradeCurrency)
  }, [allCashBalances, currentTradeCurrency])

  const defaultCashAsset = useMemo(
    () => buildDefaultCashAsset(filteredCashAssets, currentTradeCurrency),
    [filteredCashAssets, currentTradeCurrency],
  )

  // Cash assets for dropdown - all currency balances are already included
  const cashAssetsForDropdown = useMemo(() => {
    return allCashBalances
  }, [allCashBalances])

  // Auto-set default settlement account when trade currency changes
  // Skip if a broker with a matching settlement account is selected
  useEffect(() => {
    const currentSettlement = watch("settlementAccount")
    const currentBrokerId = watch("brokerId")

    if (
      currentBrokerId &&
      brokerHasSettlementForCurrency({
        brokerId: currentBrokerId,
        tradeCurrency: currentTradeCurrency,
        brokers,
      })
    ) {
      return // Don't override broker's settlement account
    }

    if (
      !currentSettlement?.value ||
      currentSettlement.currency !== currentTradeCurrency
    ) {
      setValue("settlementAccount", defaultCashAsset)
    }
  }, [currentTradeCurrency, defaultCashAsset, setValue, watch, brokers])

  // Watch brokerId for auto-selecting settlement account
  const selectedBrokerId = watch("brokerId")

  // Auto-select settlement account based on broker's default for the currency
  useEffect(() => {
    if (!selectedBrokerId || !currentTradeCurrency) return

    const resolved = resolveBrokerSettlementAccount({
      brokerId: selectedBrokerId,
      tradeCurrency: currentTradeCurrency,
      brokers,
      allBankAccounts,
    })
    if (resolved) {
      setValue("settlementAccount", resolved)
    }
  }, [
    selectedBrokerId,
    currentTradeCurrency,
    brokers,
    allBankAccounts,
    setValue,
  ])

  if (marketsLoading || tradeAccountsLoading || ccyLoading)
    return rootLoader(t("loading"))

  // Get market options
  const marketOptions =
    marketsData?.data?.map((market: { code: string; name: string }) => ({
      value: market.code,
      label: market.name || market.code,
    })) || []

  const cashImpact = hasCashImpact(type?.value)
  const isExpense = isExpenseType(type?.value)
  const isIncome = isIncomeType(type?.value)
  const isSimpleAmount = isSimpleAmountType(type?.value)
  const tradeAmount = watch("tradeAmount") || 0

  return (
    <>
      {showBrokerSelectionDialog && initialValues?.held && (
        <BrokerSelectionDialog
          held={initialValues.held}
          brokers={brokers}
          quantity={initialValues.quantity}
          onSelect={(brokerId, maxQty) => {
            if (brokerId) setValue("brokerId", brokerId)
            setValue("quantity", maxQty)
            setShowBrokerSelectionDialog(false)
          }}
          onSkip={() => setShowBrokerSelectionDialog(false)}
          t={t}
        />
      )}

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
            <TradeFormHeader
              isEditMode={isEditMode}
              editAssetCode={editAssetCode}
              editAssetName={editAssetName}
              editMarketCode={editMarketCode}
              asset={asset}
              portfolio={portfolio}
              type={type}
              isExpense={isExpense}
              isSimpleAmount={isSimpleAmount}
              cashImpact={cashImpact}
              quantity={quantity}
              price={price}
              tradeAmount={tradeAmount}
              tradeCurrency={tradeCurrency}
              weightInfo={weightInfo}
              onClose={() =>
                isEditMode ? editMode?.onClose() : setModalOpen(false)
              }
              onDelete={editMode?.onDelete}
              handleCopy={handleCopy}
              copyStatus={copyStatus}
              control={control}
              t={t}
            />

            {/* Scrollable form content */}
            <form
              id="trade-form"
              onSubmit={handleSubmit(async (data) => {
                if (isEditMode && transaction && editMode) {
                  await submitEditMode({
                    data: data as any,
                    transaction,
                    selectedModelId,
                    selectedPortfolioId,
                    portfolioChanged,
                    portfolios,
                    editMode,
                    mutate,
                    setSubmitError,
                    setIsSubmitting,
                    t,
                  })
                } else if (data.type.value === "EXPENSE") {
                  await submitExpense({
                    data: data as any,
                    portfolio,
                    mutate,
                    setModalOpen,
                    setSubmitError,
                    setIsSubmitting,
                  })
                } else if (data.type.value === "INCOME") {
                  await submitIncome({
                    data: data as any,
                    portfolio,
                    mutate,
                    setModalOpen,
                    setSubmitError,
                    setIsSubmitting,
                  })
                } else {
                  submitCreateMode({
                    data: data as any,
                    portfolio,
                    errors,
                    setModalOpen,
                    mutate,
                  })
                }
              })}
              className="flex-1 overflow-y-auto py-4 space-y-4"
            >
              {/* Type and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("trn.type")}</label>
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
                  <label className={labelClass}>{t("trn.tradeDate")}</label>
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
              {isEditMode ? (
                // Edit mode: show read-only asset info
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("trn.asset.code")}</label>
                    <input
                      type="text"
                      value={editAssetCode}
                      disabled
                      className={`${inputClass} bg-gray-100 cursor-not-allowed text-xs`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("trn.market.code")}</label>
                    <input
                      type="text"
                      value={editMarketCode}
                      disabled
                      className={`${inputClass} bg-gray-100 cursor-not-allowed text-xs`}
                    />
                  </div>
                </div>
              ) : (
                // Create mode: editable market and asset
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("trn.market.code")}</label>
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
                    <label className={labelClass}>
                      {isFetchingPrice
                        ? `${t("trn.asset.code")} ...`
                        : t("trn.asset.code")}
                    </label>
                    <AssetSearch
                      name="asset"
                      control={control}
                      market={watch("market")}
                      defaultValue={initialValues?.asset}
                      onSelect={handleAssetSelect}
                    />
                  </div>
                </div>
              )}

              {/* Portfolio Move (edit mode only) */}
              {isEditMode && portfolios.length > 0 && (
                <div>
                  <label className={labelClass}>{t("portfolio")}</label>
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    className={`${inputClass} text-xs ${portfolioChanged ? "border-amber-500 bg-amber-50" : ""}`}
                  >
                    {portfolios.map((p: Portfolio) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                  {portfolioChanged && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {t(
                        "trn.portfolio.changed",
                        "Will move to this portfolio",
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Amount - shown for EXPENSE/INCOME types */}
              {isSimpleAmount && (
                <div>
                  <label className={labelClass}>
                    {isIncome
                      ? t("trn.income.amount", "Income Amount")
                      : t("trn.expense.amount", "Expense Amount")}
                  </label>
                  <Controller
                    name="tradeAmount"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        value={field.value}
                        onChange={field.onChange}
                        className={`${inputClass} text-lg font-medium`}
                        placeholder={
                          isIncome
                            ? t("trn.income.placeholder", "Enter income amount")
                            : t(
                                "trn.expense.placeholder",
                                "Enter expense amount",
                              )
                        }
                      />
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isIncome
                      ? t(
                          "trn.income.hint",
                          "This amount will be credited to the settlement account",
                        )
                      : t(
                          "trn.expense.hint",
                          "This amount will be debited from the settlement account",
                        )}
                  </p>
                </div>
              )}

              {/* Fees - shown for EXPENSE/INCOME types */}
              {isSimpleAmount && (
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
              )}

              {/* Quantity, Price, Fees - hidden for EXPENSE/INCOME types */}
              {!isSimpleAmount && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>
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
                    <label className={labelClass}>{t("trn.price")}</label>
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
                  <div className="col-span-2 sm:col-span-1">
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
                </div>
              )}

              {/* Broker - select before settlement account (hidden for EXPENSE/INCOME) */}
              {!isSimpleAmount && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass}>
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
              )}

              {/* Settlement Account */}
              <div>
                <label className={labelClass}>
                  {isIncome
                    ? t("trn.income.creditAccount", "Credit To Account")
                    : isExpense
                      ? t("trn.expense.debitAccount", "Debit From Account")
                      : t("trn.settlement.account")}
                </label>
                <SettlementAccountSelect
                  name="settlementAccount"
                  control={control}
                  accounts={allTradeAccounts as any[]}
                  bankAccounts={filteredBankAccounts as any[]}
                  cashAssets={cashAssetsForDropdown as any[]}
                  trnType={type?.value || "BUY"}
                  tradeCurrency={currentTradeCurrency}
                  defaultValue={defaultCashAsset}
                />
              </div>

              {/* Model Selection (edit mode only) */}
              {isEditMode && models.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass}>
                      {t("trn.model", "Strategy/Model")}
                    </label>
                    {suggestedModelId &&
                      suggestedModelId !== selectedModelId && (
                        <button
                          type="button"
                          onClick={() => setSelectedModelId(suggestedModelId)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          {t("trn.model.useSuggested", "Use suggested")}
                        </button>
                      )}
                  </div>
                  <select
                    className={`${inputClass} ${suggestedModelId && selectedModelId === suggestedModelId ? "border-purple-300 bg-purple-50" : ""}`}
                    value={selectedModelId || ""}
                    onChange={(e) =>
                      setSelectedModelId(e.target.value || undefined)
                    }
                  >
                    <option value="">
                      {t("trn.model.none", "-- No model --")}
                    </option>
                    {/* Show suggested model first if available */}
                    {suggestedModelId && (
                      <optgroup label={t("trn.model.suggested", "Suggested")}>
                        {models
                          .filter((m) => m.id === suggestedModelId)
                          .map((model) => (
                            <option
                              key={`suggested-${model.id}`}
                              value={model.id}
                            >
                              {model.name} (suggested)
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label={t("trn.model.all", "All Models")}>
                      {models
                        .filter((m) => m.id !== suggestedModelId)
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                  {suggestedModelId && (
                    <p className="text-xs text-purple-600 mt-0.5">
                      {t(
                        "trn.model.deduced",
                        "Model suggested based on transaction origin",
                      )}
                    </p>
                  )}
                </div>
              )}

              <TradeFormTabs
                isExpense={isExpense}
                isSimpleAmount={isSimpleAmount}
                isEditMode={isEditMode}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                control={control}
                inputClass={inputClass}
                labelClass={labelClass}
                price={price}
                tradeValue={tradeValue}
                handleTradeValueChange={handleTradeValueChange}
                currentPositionWeight={currentPositionWeight}
                targetWeight={targetWeight}
                handleTargetWeightChange={handleTargetWeightChange}
                onTradeAmountOverride={() => {
                  tradeAmountOverriddenRef.current = true
                }}
                onCashAmountOverride={(value) => {
                  cashAmountOverriddenRef.current = true
                  // When cashAmount is cleared, recalculate tradeAmount from qty × price
                  if (!value || value === 0) {
                    const { quantity, price, tax, fees, type } = getValues()
                    const newTradeAmount = calculateTradeAmount(
                      quantity,
                      price,
                      tax,
                      fees,
                      type.value,
                    )
                    setValue(
                      "tradeAmount",
                      parseFloat(newTradeAmount.toFixed(2)),
                    )
                    tradeAmountOverriddenRef.current = false
                  }
                }}
                t={t}
              />

              {/* Error Display */}
              {Object.keys(errors).length > 0 && (
                <div className="text-red-500 text-xs bg-red-50 p-2 rounded">
                  {Object.values(errors)
                    .map((error) => error?.message)
                    .join(" ")}
                </div>
              )}
            </form>

            {/* Error Display */}
            {submitError && (
              <div className="text-red-500 text-xs bg-red-50 p-2 rounded mx-3 mb-2">
                {submitError}
              </div>
            )}

            {/* Footer */}
            <div className="shrink-0 pt-3 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() =>
                  isEditMode ? editMode?.onClose() : setModalOpen(false)
                }
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                form="trade-form"
                disabled={
                  isEditMode &&
                  (isSubmitting ||
                    (!isDirty && !portfolioChanged && !modelChanged))
                }
                className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${
                  isEditMode &&
                  (isSubmitting ||
                    (!isDirty && !portfolioChanged && !modelChanged))
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                }`}
              >
                {isEditMode
                  ? isSubmitting
                    ? t("saving")
                    : t("save")
                  : t("submit", "Submit")}
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
