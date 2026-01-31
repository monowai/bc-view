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
import TradeStatusToggle from "@components/ui/TradeStatusToggle"
import {
  calculateTradeAmount,
  calculateTradeWeight,
  calculateNewPositionWeight,
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
  holdingKey,
  modelsKey,
} from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import SettlementAccountSelect, {
  SettlementAccountOption,
} from "@components/features/transactions/SettlementAccountSelect"
import AssetSearch from "@components/features/assets/AssetSearch"
import { AssetOption } from "types/beancounter"
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
import { updateTrn, TrnUpdatePayload } from "@lib/trns/apiHelper"
import { getDisplayCode } from "@lib/assets/assetUtils"

const TradeTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
  "EXPENSE",
] as const

const excludedMarkets = ["CASH", "AMEX", "NYSE", "NASDAQ"]

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
  "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"

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

  // Build initial settlement account from transaction (edit mode)
  const buildInitialSettlementAccount = (
    trn: Transaction,
  ): SettlementAccountOption | null => {
    if (!trn.cashAsset) return null
    return {
      value: trn.cashAsset.id,
      label:
        trn.cashAsset.name ||
        `${getDisplayCode(trn.cashAsset)} ${trn.cashAsset.market?.code === "CASH" ? "Balance" : ""}`,
      currency:
        trn.cashAsset.priceSymbol ||
        trn.cashAsset.code ||
        trn.tradeCurrency.code,
      market: trn.cashAsset.market?.code,
    }
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
  const portfolioDefaultMarket = useMemo(() => {
    const currencyCode = portfolio.currency.code
    const match = marketsData?.data?.find(
      (m: { code: string; currency: { code: string } }) =>
        !excludedMarkets.includes(m.code) && m.currency.code === currencyCode,
    )
    return match?.code || "US"
  }, [marketsData, portfolio.currency.code])

  // Reset form with initial values when modal opens
  useEffect(() => {
    if (modalOpen && isEditMode && transaction) {
      // Edit mode: populate from transaction
      reset({
        type: { value: transaction.trnType, label: transaction.trnType },
        status: { value: transaction.status, label: transaction.status },
        asset: editAssetCode,
        market: editMarketCode,
        tradeDate: transaction.tradeDate,
        quantity: transaction.quantity,
        price: transaction.price,
        tradeCurrency: {
          value: transaction.tradeCurrency.code,
          label: transaction.tradeCurrency.code,
        },
        settlementAccount: buildInitialSettlementAccount(transaction),
        tradeAmount: transaction.tradeAmount,
        cashAmount: transaction.cashAmount,
        fees: transaction.fees,
        tax: transaction.tax,
        comment: transaction.comments || "",
        brokerId: transaction.broker?.id || "",
      })
      setSelectedPortfolioId(transaction.portfolio.id)
      setTargetWeight("")
      setTradeValue("")
      setSubmitError(null)
    } else if (modalOpen && initialValues) {
      // Quick sell mode: populate from initialValues
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
    } else if (modalOpen && !initialValues && !isEditMode) {
      // Create mode: reset to defaults, using portfolio-appropriate market
      reset({
        ...defaultValues,
        market: portfolioDefaultMarket,
        tradeCurrency: {
          value: portfolio.currency.code,
          label: portfolio.currency.code,
        },
      })
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

  // All bank accounts - needed for broker settlement lookups by ID
  const allBankAccounts = useMemo(() => {
    const accounts = bankAccountsData?.data
      ? Object.values(bankAccountsData.data)
      : []
    return accounts as any[]
  }, [bankAccountsData])

  // Bank accounts filtered by trade currency - for settlement dropdown
  const filteredBankAccounts = useMemo(() => {
    return allBankAccounts
      .filter((a: any) => getAssetCurrency(a) === currentTradeCurrency)
      .sort((a: any, b: any) =>
        (a.name || a.code).localeCompare(b.name || b.code),
      )
  }, [allBankAccounts, currentTradeCurrency])

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
  // Skip if a broker with a matching settlement account is selected
  useEffect(() => {
    const currentSettlement = watch("settlementAccount")
    const currentBrokerId = watch("brokerId")

    // Check if broker has a settlement account for this currency
    if (currentBrokerId) {
      const selectedBroker = brokers.find((b) => b.id === currentBrokerId)
      const hasBrokerSettlement = selectedBroker?.settlementAccounts?.some(
        (sa) => sa.currencyCode === currentTradeCurrency,
      )
      // Don't override if broker has a matching settlement account
      if (hasBrokerSettlement) return
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

    const selectedBroker = brokers.find((b) => b.id === selectedBrokerId)
    if (!selectedBroker?.settlementAccounts) return

    // Find settlement account for current trade currency
    const brokerSettlement = selectedBroker.settlementAccounts.find(
      (sa) => sa.currencyCode === currentTradeCurrency,
    )

    if (brokerSettlement) {
      // Find the matching bank account to get full details
      const bankAccount = allBankAccounts.find(
        (a: any) => a.id === brokerSettlement.accountId,
      )
      if (bankAccount) {
        setValue("settlementAccount", {
          value: bankAccount.id,
          label: bankAccount.name || bankAccount.code,
          currency: getAssetCurrency(bankAccount),
        })
      }
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
    marketsData?.data
      ?.filter(
        (market: { code: string }) => !excludedMarkets.includes(market.code),
      )
      .map((market: { code: string; name: string }) => ({
        value: market.code,
        label: market.name || market.code,
      })) || []


  const hasCashImpact = !["ADD", "REDUCE", "SPLIT"].includes(type?.value)
  const isExpenseType = type?.value === "EXPENSE"
  const tradeAmount = watch("tradeAmount") || 0

  return (
    <>
      {/*Broker Selection Dialog for QuickSell with multiple brokers*/}
      {showBrokerSelectionDialog && initialValues?.held && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setShowBrokerSelectionDialog(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">
              {t("trn.broker.select", "Select Broker")}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t(
                "trn.broker.multipleHeld",
                "This position is held across multiple brokers. Select which broker to sell from:",
              )}
            </p>
            <div className="space-y-2">
              {Object.entries(initialValues.held).map(([brokerName, qty]) => {
                const broker = brokers.find((b) => b.name === brokerName)
                return (
                  <button
                    key={brokerName}
                    type="button"
                    onClick={() => {
                      if (broker) {
                        setValue("brokerId", broker.id)
                      }
                      // Limit quantity to this broker's holdings
                      setValue(
                        "quantity",
                        Math.min(initialValues.quantity, qty),
                      )
                      setShowBrokerSelectionDialog(false)
                    }}
                    className="w-full p-3 text-left border rounded hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span className="font-medium">{brokerName}</span>
                    <span className="text-gray-500">
                      {qty.toLocaleString()} {t("trn.shares", "shares")}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="w-full mt-4 p-2 text-gray-500 hover:text-gray-700 text-sm"
              onClick={() => setShowBrokerSelectionDialog(false)}
            >
              {t(
                "trn.broker.skipSelection",
                "Skip - sell without specifying broker",
              )}
            </button>
          </div>
        </div>
      )}

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
                  className="text-gray-400 hover:text-gray-600 p-2"
                  onClick={() =>
                    isEditMode ? editMode?.onClose() : setModalOpen(false)
                  }
                  title={t("cancel")}
                >
                  <i className="fas fa-times"></i>
                </button>
                <div
                  className="text-center flex-1 px-2"
                  title={
                    isEditMode ? editAssetName || editAssetCode : undefined
                  }
                >
                  <div className="font-semibold truncate">
                    {isEditMode
                      ? editAssetCode
                      : asset || t("trade.market.title")}
                  </div>
                  {isEditMode && editAssetName && (
                    <div className="text-xs text-gray-500 truncate">
                      {editAssetName.length > 25
                        ? `${editAssetName.substring(0, 25)}...`
                        : editAssetName}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {isEditMode
                      ? editMarketCode
                      : `${portfolio.code} - ${portfolio.name}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`p-2 ${
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
                  {isEditMode && (
                    <button
                      type="button"
                      className="p-2 text-red-500 hover:text-red-600"
                      onClick={editMode?.onDelete}
                      title={t("delete")}
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Trade Status Toggle */}
              <div className="flex justify-center mb-2">
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <TradeStatusToggle
                      isSettled={field.value.value === "SETTLED"}
                      onChange={(isSettled) => {
                        const newStatus = isSettled ? "SETTLED" : "PROPOSED"
                        field.onChange({ value: newStatus, label: newStatus })
                      }}
                      size="sm"
                    />
                  )}
                />
              </div>

              {/* Trade Value Summary */}
              <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className={`text-xs font-medium uppercase ${
                      type?.value === "SELL" || isExpenseType
                        ? "text-red-600"
                        : type?.value === "ADD" || type?.value === "REDUCE"
                          ? "text-blue-600"
                          : "text-green-600"
                    }`}
                  >
                    {type?.value || "BUY"}
                  </div>
                  {isExpenseType ? (
                    // Expense: show amount directly
                    <>
                      <div className="font-bold">
                        <NumericFormat
                          value={tradeAmount || 0}
                          displayType="text"
                          thousandSeparator
                          decimalScale={2}
                          fixedDecimalScale
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {tradeCurrency?.value}
                      </div>
                    </>
                  ) : (
                    // Regular trade: show quantity and price
                    <>
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
                    </>
                  )}
                </div>
                {hasCashImpact && tradeAmount > 0 && !isExpenseType && (
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

              {/* Weight info - not shown for EXPENSE */}
              {weightInfo && !isExpenseType && (
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
              onSubmit={handleSubmit(async (data) => {
                // Derive cashCurrency from settlement account (settlement account is source of truth)
                const settlementCurrency =
                  data.settlementAccount?.currency ||
                  data.tradeCurrency?.value ||
                  "USD"

                if (isEditMode && transaction) {
                  // Edit mode: use PATCH API
                  setIsSubmitting(true)
                  setSubmitError(null)

                  try {
                    const payload: TrnUpdatePayload = {
                      trnType: data.type.value,
                      assetId: transaction.asset.id,
                      tradeDate: data.tradeDate,
                      quantity: data.quantity,
                      price: data.price,
                      tradeCurrency: data.tradeCurrency.value,
                      tradeAmount:
                        data.tradeAmount || data.quantity * data.price,
                      cashCurrency: settlementCurrency,
                      cashAssetId: data.settlementAccount?.value || undefined,
                      cashAmount:
                        data.cashAmount ||
                        -(data.quantity * data.price + (data.fees || 0)),
                      fees: data.fees,
                      tax: data.tax,
                      comments: data.comment || "",
                      brokerId: data.brokerId || undefined,
                      status: data.status?.value || transaction.status,
                      modelId: selectedModelId,
                    }

                    const response = await updateTrn(
                      selectedPortfolioId,
                      transaction.id,
                      payload,
                    )

                    if (response.ok) {
                      // Invalidate holdings cache
                      setTimeout(() => {
                        mutate(holdingKey(transaction.portfolio.code, "today"))
                        mutate("/api/holdings/aggregated?asAt=today")
                        if (portfolioChanged) {
                          const newPortfolio = portfolios.find(
                            (p) => p.id === selectedPortfolioId,
                          )
                          if (newPortfolio) {
                            mutate(holdingKey(newPortfolio.code, "today"))
                          }
                        }
                      }, 1500)
                      editMode?.onClose()
                    } else {
                      const errorData = await response.json()
                      setSubmitError(errorData.message || t("trn.error.update"))
                    }
                  } catch (error) {
                    console.error("Failed to update transaction:", error)
                    setSubmitError(t("trn.error.update"))
                  } finally {
                    setIsSubmitting(false)
                  }
                } else {
                  // Create mode: use CSV import
                  const dataWithCashCurrency = {
                    ...data,
                    cashCurrency: {
                      value: settlementCurrency,
                      label: settlementCurrency,
                    },
                  }
                  onSubmit(
                    portfolio,
                    errors,
                    dataWithCashCurrency,
                    setModalOpen,
                  )
                }
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
              {isEditMode ? (
                // Edit mode: show read-only asset info
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      {t("trn.asset.code")}
                    </label>
                    <input
                      type="text"
                      value={editAssetCode}
                      disabled
                      className={`${inputClass} bg-gray-100 cursor-not-allowed text-xs`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      {t("trn.market.code")}
                    </label>
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
                  <label className="block text-xs font-medium text-gray-600">
                    {t("portfolio")}
                  </label>
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

              {/* Expense Amount - shown for EXPENSE type */}
              {isExpenseType && (
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.expense.amount", "Expense Amount")}
                  </label>
                  <Controller
                    name="tradeAmount"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        value={field.value}
                        onChange={field.onChange}
                        className={`${inputClass} text-lg font-medium`}
                        placeholder={t(
                          "trn.expense.placeholder",
                          "Enter expense amount",
                        )}
                      />
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "trn.expense.hint",
                      "This amount will be debited from the settlement account",
                    )}
                  </p>
                </div>
              )}

              {/* Quantity, Price, Fees - hidden for EXPENSE type */}
              {!isExpenseType && (
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
              )}

              {/* Broker - select before settlement account (hidden for EXPENSE) */}
              {!isExpenseType && (
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
              )}

              {/* Settlement Account */}
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  {isExpenseType
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
                    <label className="block text-xs font-medium text-gray-600">
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

              {/* Tabs for Trade/Invest - simplified for EXPENSE */}
              <div className="border-t border-gray-200 pt-2">
                {!isExpenseType && (
                  <div className="flex border-b border-gray-200">
                    <button
                      type="button"
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        activeTab === "trade"
                          ? "border-b-2 border-blue-500 text-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => setActiveTab("trade")}
                    >
                      {t("trn.tab.trade", "Trade")}
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        isEditMode
                          ? "text-gray-300 cursor-not-allowed"
                          : activeTab === "invest"
                            ? "border-b-2 border-blue-500 text-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => !isEditMode && setActiveTab("invest")}
                      disabled={isEditMode}
                      title={
                        isEditMode
                          ? t(
                              "trn.tab.invest.disabled",
                              "Invest calculations not available when editing",
                            )
                          : undefined
                      }
                    >
                      {t("trn.tab.invest", "Invest")}
                    </button>
                  </div>
                )}

                {/* EXPENSE: Simplified content - just comments */}
                {isExpenseType && (
                  <div className="mt-3 space-y-2">
                    {/* Comments */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.expense.description", "Expense Description")}
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
                            placeholder={t(
                              "trn.expense.descPlaceholder",
                              "e.g., Property rates, Insurance, Maintenance",
                            )}
                          />
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Trade Tab Content - for non-EXPENSE types */}
                {!isExpenseType && activeTab === "trade" && (
                  <div className="mt-3 space-y-2">
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
                    </div>

                    {/* Cash Amount */}
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

                {/* Invest Tab Content - for non-EXPENSE types */}
                {!isExpenseType && activeTab === "invest" && (
                  <div className="mt-3 space-y-3">
                    {/* Invest Value - calculate quantity from total */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        {t("trn.invest.value", "Invest Value")}
                      </label>
                      <p className="text-xs text-gray-500 mb-1">
                        {t(
                          "trn.invest.description",
                          "Enter amount to invest, quantity will be calculated",
                        )}
                      </p>
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
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <label className="block text-xs font-medium text-purple-800 mb-2">
                          {t("trn.targetWeight", "Target Weight")}
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-purple-700">
                            {t("rebalance.currentWeight")}:{" "}
                            <strong>{currentPositionWeight.toFixed(2)}%</strong>
                          </span>
                          <span className="text-purple-400">→</span>
                          <MathInput
                            value={targetWeight ? parseFloat(targetWeight) : 0}
                            onChange={(value) => {
                              if (value >= 0) {
                                handleTargetWeightChange(String(value))
                              }
                            }}
                            placeholder={currentPositionWeight.toFixed(1)}
                            className="w-20 px-2 py-2 border border-purple-300 rounded text-sm"
                          />
                          <span className="text-purple-600 text-sm">%</span>
                        </div>
                      </div>
                    )}

                    {currentPositionWeight === null && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">
                          {t(
                            "trn.invest.noPosition",
                            "Target weight is available when trading existing positions",
                          )}
                        </p>
                      </div>
                    )}
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

            {/* Error Display */}
            {submitError && (
              <div className="text-red-500 text-xs bg-red-50 p-2 rounded mx-3 mb-2">
                {submitError}
              </div>
            )}

            {/* Sticky footer */}
            <div className="flex-shrink-0 pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
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
                className={`px-4 py-2 rounded text-white text-sm ${
                  isEditMode &&
                  (isSubmitting ||
                    (!isDirty && !portfolioChanged && !modelChanged))
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
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
