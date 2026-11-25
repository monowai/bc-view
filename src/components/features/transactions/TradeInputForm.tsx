import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import { Portfolio, QuickSellData, BrokerWithAccounts } from "types/beancounter"
import { ModelDto } from "types/rebalance"
import {
  acceptsBroker,
  calculateTradeAmount,
  calculateCashAmount,
  hasCashImpact,
  isExpenseType,
  isIncomeType,
  isSimpleAmountType,
  isSellSide,
  deriveDefaultMarket,
  getTradeColorScheme,
  getQtyPriceTint,
  hasCostDate,
} from "@lib/trns/tradeUtils"
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
import TrnFormDialog, {
  HeaderIconButton,
} from "@components/features/transactions/TrnFormDialog"
import {
  BrokerAccountField,
  Money,
  PortfolioSwitch,
  TrnStatusField,
  TrnSummary,
} from "@components/features/transactions/TrnFormParts"
import Alert from "@components/ui/Alert"
import AssetSearch from "@components/features/assets/AssetSearch"
import { AssetOption } from "types/beancounter"
import { NumericFormat } from "react-number-format"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import { convert } from "@lib/trns/tradeUtils"
import {
  computeWeightInfo,
  computeCurrentPositionWeight,
  computeResultingPositionWeight,
  calculateQuantityFromTargetWeight,
  calculateNewPositionQuantityFromTargetWeight,
  calculateQuantityFromTradeValue,
  buildEditModeValues,
  buildQuickSellValues,
  buildCreateModeValues,
  buildAllCashBalances,
  buildDefaultCashAsset,
  resolveSelfSettleAccount,
  resolveBrokerSettlementAccount,
  brokerHasSettlementForCurrency,
  resolveSellableQuantity,
  heldQuantityForBroker,
  brokersOfferedForTrade,
  singleHeldBrokerId,
} from "@lib/trns/tradeFormHelpers"
import {
  submitEditMode,
  submitExpense,
  submitIncome,
  submitCreateMode,
} from "@lib/trns/tradeSubmit"
import { getDisplayCode, stripOwnerPrefix } from "@lib/assets/assetUtils"
import {
  TradeTypeValues,
  defaultValues,
  schema,
  EditModeProps,
  COST_DATE_HELP,
} from "@lib/trns/tradeFormConfig"
import { inputClass, labelClass } from "@lib/trns/trnFormStyles"
import Tooltip from "@components/ui/Tooltip"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { showPortfolioPicker } from "@lib/user/zenMode"
import { getExecution } from "@utils/api/client/rebalance"
import { activePortfoliosKey } from "@utils/api/client/portfolios"
import { brokersWithAccountsKey } from "@utils/api/client/brokers"
import { marketPriceUrl } from "@utils/api/client/prices"

/** Two decimals is the resolution money and weights are quoted at here. */
const round2 = (value: number): number => Math.round(value * 100) / 100

// Private and cash assets have no external market data to fetch.
const hasMarketPrice = (market: string): boolean =>
  market !== "PRIVATE" && market !== "CASH"

// A changed trade date re-checks the cost date, which must not fall after it.
const tradeDateRules: { deps: string[] } = { deps: ["costDate"] }

const TradeInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  initialValues?: QuickSellData
  // Aggregate context: the trade lands in `portfolio`, but weights should be
  // expressed against the whole aggregate. When set, these drive the displayed
  // current weight and the target-weight slider instead of `portfolio.marketValue`.
  weightBasisMarketValue?: number
  currentWeightOverride?: number | null
  // Edit mode props - when transaction is provided, form is in edit mode
  editMode?: EditModeProps
}> = ({
  portfolio,
  modalOpen,
  setModalOpen,
  initialValues,
  weightBasisMarketValue,
  currentWeightOverride,
  editMode,
}) => {
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
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)
  const [activeTab, setActiveTab] = useState<"trade" | "invest" | "settlement">(
    "trade",
  )

  // Edit mode state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([])
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

  // Track whether the user has manually overridden computed trade amount.
  // When set, the auto-recalculation useEffect is skipped.
  const tradeAmountOverriddenRef = useRef(false)

  // Set the first time the Invest tab is opened. From then on the Invest tab
  // owns the trade size, so the Quick Sell quantity prefills stay out of it.
  const investSeededRef = useRef(false)

  // Fetch portfolios for portfolio selection
  const { data: portfoliosData } = useSwr(
    activePortfoliosKey,
    simpleFetcher(activePortfoliosKey),
  )
  const portfolios: Portfolio[] = useMemo(
    () => portfoliosData?.data || [],
    [portfoliosData?.data],
  )
  const { preferences } = useUserPreferences()

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
      getExecution(executionId)
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

  // Resolve the effective portfolio from the dropdown selection
  const effectivePortfolio = useMemo(
    () => portfolios.find((p) => p.id === selectedPortfolioId) || portfolio,
    [portfolios, selectedPortfolioId, portfolio],
  )

  // Check if portfolio changed from initial
  const portfolioChanged =
    selectedPortfolioId !== (transaction?.portfolio.id || portfolio.id)

  // Check if model changed from initial value (edit mode)
  const modelChanged =
    isEditMode && selectedModelId !== initialModelIdRef.current

  // For edit mode: get asset info from transaction
  const editAssetCode = transaction ? getDisplayCode(transaction.asset) : ""
  const editAssetName = transaction?.asset.name || ""
  const editMarketCode = transaction?.asset.market.code || ""

  // Fetch brokers with settlement accounts for dropdown
  const { data: brokersData } = useSwr(
    brokersWithAccountsKey,
    simpleFetcher(brokersWithAccountsKey),
  )
  const brokers: BrokerWithAccounts[] = useMemo(
    () => brokersData?.data || [],
    [brokersData?.data],
  )

  const copyRow = (): string => {
    const formData = getValues()
    const settlementCurrency = formData.settlementAccount?.currency || "USD"
    const data = {
      ...formData,
      tradeCurrency: { value: settlementCurrency, label: settlementCurrency },
      cashCurrency: { value: settlementCurrency, label: settlementCurrency },
      comments: formData.comment ?? undefined,
    }
    return convert(data as any)
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
      investSeededRef.current = false
      setSubmitError(null)
      setActiveTab("trade")
    } else if (modalOpen && initialValues) {
      // Quick sell mode: populate from initialValues
      reset(buildQuickSellValues(initialValues, defaultValues))
      investSeededRef.current = false
      setActiveTab("trade")
    } else if (modalOpen && !initialValues && !isEditMode) {
      // Create mode: reset to defaults, using portfolio-appropriate market
      reset(
        buildCreateModeValues(
          defaultValues,
          portfolioDefaultMarket,
          portfolio.currency.code,
        ),
      )
      investSeededRef.current = false
      setActiveTab("trade")
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
  const { data: cashAssetsData } = useSwr(cashKey, optionalFetcher(cashKey))

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")
  const tradeCurrency = watch("tradeCurrency")
  const asset = watch("asset")
  const brokerId = watch("brokerId")
  const offeredBrokers = useMemo(
    () => brokersOfferedForTrade(brokers, brokerId),
    [brokers, brokerId],
  )

  // Weight basis: aggregate market value when supplied (aggregated view),
  // otherwise the single portfolio's own market value.
  const weightBasis = weightBasisMarketValue ?? portfolio.marketValue
  // `price` is the asset's trade currency but `weightBasis` is base currency.
  // fxRate (trade->base) reconciles them so weights/target-sizing are correct
  // for foreign-currency holdings. Defaults to 1 for same-currency positions.
  const fxRate = initialValues?.fxRate ?? 1
  // Available quantity to trade. When a broker is selected and per-broker
  // holdings are known, this is what THAT broker holds (split-adjusted), not
  // the whole-holding total.
  const positionQty = useMemo(
    () =>
      resolveSellableQuantity({
        held: initialValues?.held,
        brokerId,
        brokers,
        currentPositionQuantity: initialValues?.currentPositionQuantity,
        quantity: initialValues?.quantity,
      }),
    [
      initialValues?.held,
      initialValues?.currentPositionQuantity,
      initialValues?.quantity,
      brokerId,
      brokers,
    ],
  )
  const currentPositionWeight = useMemo(
    () =>
      currentWeightOverride ??
      computeCurrentPositionWeight(positionQty, price, weightBasis, fxRate),
    [currentWeightOverride, positionQty, price, weightBasis, fxRate],
  )

  const actualPositionQuantity = positionQty
  // Quick Sell: the Qty label offers a brokerage picker only when the asset is
  // held at MORE than one brokerage. A single brokerage is auto-defaulted (see
  // effect below), so a picker there would be redundant.
  const hasHeldBrokers = Object.keys(initialValues?.held ?? {}).length > 1

  // A trade can be sized three equivalent ways — cash amount, share count,
  // target weight. `quantity` is the one truth; the other two are derived from
  // it, so editing any one of them moves the other two in the same render.
  // (MathInput ignores incoming values while focused, so the field being typed
  // into is never overwritten mid-keystroke.)
  const investAmount = round2(quantity * price)
  const resultingPositionQuantity = Math.max(
    positionQty + (isSellSide(type?.value) ? -quantity : quantity),
    0,
  )
  const resultingPositionWeight = useMemo(
    () =>
      computeResultingPositionWeight({
        currentPositionQuantity: positionQty,
        tradeQuantity: quantity,
        tradeType: type?.value,
        price,
        portfolioMarketValue: weightBasis,
        fxRate,
      }),
    [positionQty, quantity, type?.value, price, weightBasis, fxRate],
  )
  // A brand-new position has no current weight, but it can still be sized to a
  // target weight of the resulting, post-trade portfolio — provided the
  // portfolio already has value to weigh against.
  const canTargetNewPositionWeight =
    currentPositionWeight === null && price > 0 && weightBasis > 0
  const canSizeByWeight =
    (currentPositionWeight !== null && price > 0 && weightBasis > 0) ||
    canTargetNewPositionWeight
  const targetWeightValue =
    resultingPositionWeight === null ? 0 : round2(resultingPositionWeight)

  // Target weight is the weight the POSITION lands on. An existing holding is
  // re-weighed against the same portfolio value; a new one grows it.
  const handleTargetWeightChange = (newTargetWeight: number): void => {
    if (newTargetWeight < 0) return
    const result =
      currentPositionWeight === null
        ? calculateNewPositionQuantityFromTargetWeight(
            newTargetWeight,
            price,
            weightBasis,
            fxRate,
          )
        : calculateQuantityFromTargetWeight(
            newTargetWeight,
            currentPositionWeight,
            price,
            weightBasis,
            fxRate,
          )
    if (!result) return
    setValue("quantity", result.quantity)
    setValue("type", { value: result.tradeType, label: result.tradeType })
  }

  // Cash amount → the whole shares that amount buys at the current price.
  const handleInvestAmountChange = (newInvestAmount: number): void => {
    const qty = calculateQuantityFromTradeValue(newInvestAmount, price)
    if (qty !== null && Number.isFinite(qty))
      setValue("quantity", Math.max(qty, 0))
  }

  // Guarded: a non-finite quantity would propagate NaN through every derived
  // figure on the tab (amount, weight, the whole ledger).
  const handleTradeQuantityChange = (newQuantity: number): void => {
    if (!Number.isFinite(newQuantity)) return
    setValue("quantity", Math.max(newQuantity, 0))
  }

  // Opened from a holding, `quantity` arrives prefilled with the whole
  // position — the Quick Sell affordance. On the Invest tab that reads as
  // "double this holding", so the first visit starts from a clean slate and
  // the holding is shown as context instead.
  const openInvestTab = (): void => {
    setActiveTab("invest")
    if (investSeededRef.current) return
    investSeededRef.current = true
    if (positionQty > 0 && quantity === positionQty) setValue("quantity", 0)
  }

  // Fetch price for selected asset. svc-data goes to the provider when it
  // holds nothing for the asset, so a brand-new asset still gets a price.
  const fetchAssetPrice = useCallback(
    async (
      market: string,
      assetCode: string,
      asAt?: string,
    ): Promise<number | null> => {
      setIsFetchingPrice(true)
      try {
        const qs = asAt ? `?asAt=${encodeURIComponent(asAt)}` : ""
        const response = await fetch(
          `${marketPriceUrl(market, assetCode)}${qs}`,
        )
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
    },
    [],
  )

  // Opened for an asset BC has never priced (Asset Lookup → Trade), the form
  // arrives with price 0 and nobody picks the asset from the dropdown, so the
  // select handler's fetch never fires. Pull the provider price here instead.
  const presetMarket = initialValues?.market
  const presetAsset = initialValues?.asset
  const presetPrice = initialValues?.price
  useEffect(() => {
    const unpriced =
      modalOpen &&
      !isEditMode &&
      !!presetMarket &&
      !!presetAsset &&
      !presetPrice &&
      hasMarketPrice(presetMarket)
    if (!unpriced) return undefined
    let cancelled = false
    const tradeDate = getValues("tradeDate") || undefined
    void fetchAssetPrice(presetMarket, presetAsset, tradeDate).then((p) => {
      if (!cancelled && p !== null) setValue("price", p)
    })
    return () => {
      cancelled = true
    }
  }, [
    modalOpen,
    isEditMode,
    presetMarket,
    presetAsset,
    presetPrice,
    fetchAssetPrice,
    getValues,
    setValue,
  ])

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

    // react-hook-form's watch() is a stable, non-memoizable library API; safe to read here.
    // eslint-disable-next-line react-hooks/incompatible-library
    const market = option.market || watch("market")
    const assetCode = option.symbol || option.value
    if (market && assetCode && hasMarketPrice(market)) {
      const tradeDate = watch("tradeDate") || undefined
      const fetchedPrice = await fetchAssetPrice(market, assetCode, tradeDate)
      if (fetchedPrice !== null) {
        setValue("price", fetchedPrice)
      }
    }
  }

  useEffect(() => {
    if (tradeAmountOverriddenRef.current) return
    // EXPENSE/INCOME carry a hand-entered amount with no quantity behind it —
    // never derive over the top of it.
    if (isSimpleAmountType(type.value)) return
    if (quantity || price) {
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
        portfolioMarketValue: weightBasis,
        actualPositionQuantity,
        fxRate,
      }),
    [
      quantity,
      price,
      tax,
      fees,
      weightBasis,
      type.value,
      actualPositionQuantity,
      fxRate,
    ],
  )

  const currentTradeCurrency = tradeCurrency?.value || "USD"

  // All bank accounts - needed for broker settlement lookups by ID
  const allBankAccounts = useMemo(() => {
    const accounts = bankAccountsData?.data
      ? Object.values(bankAccountsData.data)
      : []
    return accounts as any[]
  }, [bankAccountsData])

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

  // Money recorded against a cash account belongs in that account — interest
  // paid into IBRK-USD settles there, not in the generic USD balance.
  const selfSettleAccount = useMemo(
    () =>
      resolveSelfSettleAccount({
        assetId: transaction?.asset.id ?? initialValues?.assetId,
        accounts: allBankAccounts as any[],
      }),
    [transaction?.asset.id, initialValues?.assetId, allBankAccounts],
  )

  const preferredCashAsset = selfSettleAccount ?? defaultCashAsset

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

    // The accounts list arrives after the first render, so the field may already
    // hold the currency balance this effect seeded a moment ago. That seeded
    // value has to give way once a better default is known — a value the user
    // actually chose does not (the effect only re-runs when a default changes).
    const holdsSeededDefault =
      currentSettlement?.value === defaultCashAsset.value

    if (
      !currentSettlement?.value ||
      currentSettlement.currency !== currentTradeCurrency ||
      (holdsSeededDefault &&
        preferredCashAsset.value !== currentSettlement.value)
    ) {
      setValue("settlementAccount", preferredCashAsset)
    }
  }, [
    currentTradeCurrency,
    preferredCashAsset,
    defaultCashAsset,
    setValue,
    watch,
    brokers,
  ])

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

  // Auto-select the broker when there's only one — nothing to choose, and it
  // lets the broker's settlement account resolve without a manual pick. Fires
  // once (guarded by a ref) so that a later explicit "-- No account --" choice
  // sticks instead of being re-filled. Create-mode only — never an edited trn.
  const brokerAutoSelectedRef = useRef(false)
  useEffect(() => {
    if (brokerAutoSelectedRef.current || isEditMode) return
    if (
      acceptsBroker(type?.value) &&
      offeredBrokers.length === 1 &&
      !watch("brokerId")
    ) {
      brokerAutoSelectedRef.current = true
      setValue("brokerId", offeredBrokers[0].id)
    }
  }, [isEditMode, type?.value, offeredBrokers, setValue, watch])

  // Quick Sell: when the asset is held at exactly one brokerage, default to it
  // (the brokerId effect below then fills the quantity). Fires once; create
  // mode only. Multi-brokerage holdings surface the picker instead.
  const heldBrokerDefaultedRef = useRef(false)
  useEffect(() => {
    if (heldBrokerDefaultedRef.current || isEditMode) return
    if (watch("brokerId")) return
    const only = singleHeldBrokerId(initialValues?.held, brokers)
    if (!only) return
    heldBrokerDefaultedRef.current = true
    setValue("brokerId", only)
  }, [isEditMode, initialValues?.held, brokers, setValue, watch])

  // Quick Sell: choosing a broker sets the quantity to that broker's holding
  // (the intent is to sell out one custodian's split-adjusted position). Only
  // fires when per-broker holdings are known (`held`); leaves the field alone
  // for brokers that hold none, and is inert in edit mode (no `held`). Once
  // the Invest tab owns the sizing, the broker only says where the trade
  // executes — resizing the trade there would be wrong.
  useEffect(() => {
    if (investSeededRef.current) return
    const brokerQty = heldQuantityForBroker(
      initialValues?.held,
      brokerId,
      brokers,
    )
    if (brokerQty !== undefined) setValue("quantity", brokerQty)
  }, [brokerId, brokers, initialValues?.held, setValue])

  const cashAmountField = watch("cashAmount")
  const market = watch("market")

  // Derived cash amount for settlement tab display
  const displayCashAmount = useMemo(() => {
    if (cashAmountField) return cashAmountField
    return calculateCashAmount({
      type,
      market,
      quantity,
      price,
      tradeAmount: watch("tradeAmount") || 0,
      cashAmount: 0,
      fees,
      tax,
    } as any)
  }, [type, market, quantity, price, cashAmountField, fees, tax, watch])

  if (marketsLoading || tradeAccountsLoading || ccyLoading)
    return rootLoader("Loading...")

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
  // The cost date shows its error inline while its field is on screen
  const costDateInline = activeTab === "trade" && hasCostDate(type?.value)
  const formErrors = Object.entries(errors)
    .filter(([field]) => !(costDateInline && field === "costDate"))
    .map(([, error]) => error?.message)

  const needsPrice = !isSimpleAmount && (!price || price <= 0)
  const tabClass = (tab: typeof activeTab, disabled = false): string =>
    `flex-1 py-2 text-xs font-medium transition-colors ${
      disabled
        ? "text-gray-300 cursor-not-allowed"
        : activeTab === tab
          ? "border-b-2 border-blue-600 text-blue-600"
          : "text-gray-500 hover:text-gray-700"
    }`
  const closeForm = (): void =>
    isEditMode ? editMode?.onClose() : setModalOpen(false)
  const submitForm = handleSubmit(async (data) => {
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
      })
    } else if (data.type.value === "EXPENSE") {
      await submitExpense({
        data: data as any,
        portfolio: effectivePortfolio,
        mutate,
        setModalOpen,
        setSubmitError,
        setIsSubmitting,
        setSubmitWarnings,
      })
    } else if (data.type.value === "INCOME") {
      await submitIncome({
        data: data as any,
        portfolio: effectivePortfolio,
        mutate,
        setModalOpen,
        setSubmitError,
        setIsSubmitting,
        setSubmitWarnings,
      })
    } else {
      await submitCreateMode({
        data: data as any,
        portfolio: effectivePortfolio,
        errors,
        setModalOpen,
        setSubmitError,
        mutate,
      })
    }
  })
  const hasChanges = isDirty || portfolioChanged || modelChanged

  return (
    <>
      {modalOpen && (
        <TrnFormDialog
          title={
            isEditMode ? editAssetCode : stripOwnerPrefix(asset) || "New trade"
          }
          subtitle={
            <>
              {isEditMode && (
                <span className="mr-2">
                  {[editAssetName, editMarketCode].filter(Boolean).join(" · ")}
                </span>
              )}
              {showPortfolioPicker(portfolios, preferences) ? (
                <PortfolioSwitch
                  portfolios={portfolios}
                  value={selectedPortfolioId}
                  onChange={setSelectedPortfolioId}
                  changedNote={
                    portfolioChanged
                      ? isEditMode
                        ? "Will move to this portfolio"
                        : "Different from current portfolio"
                      : undefined
                  }
                />
              ) : (
                !isEditMode && `${portfolio.code} · ${portfolio.name}`
              )}
            </>
          }
          status={<TrnStatusField control={control as any} />}
          tabs={
            <div className="flex">
              <button
                type="button"
                aria-pressed={activeTab === "trade"}
                className={tabClass("trade")}
                onClick={() => setActiveTab("trade")}
              >
                {"Trade"}
              </button>
              {!isSimpleAmount && !isEditMode && (
                <button
                  type="button"
                  aria-pressed={activeTab === "invest"}
                  disabled={needsPrice}
                  title={needsPrice ? "Enter a price first" : undefined}
                  className={tabClass("invest", needsPrice)}
                  onClick={openInvestTab}
                >
                  {"Invest"}
                </button>
              )}
              <button
                type="button"
                aria-pressed={activeTab === "settlement"}
                disabled={needsPrice}
                title={needsPrice ? "Enter a price first" : undefined}
                className={tabClass("settlement", needsPrice)}
                onClick={() => setActiveTab("settlement")}
              >
                {"Settlement"}
              </button>
            </div>
          }
          actions={
            isEditMode && (
              <>
                {editMode?.onUnsettle && transaction?.status === "SETTLED" && (
                  <HeaderIconButton
                    title="Unsettle (move back to PROPOSED)"
                    icon="fa-rotate-left"
                    tone="text-gray-500 hover:bg-amber-50 hover:text-amber-800"
                    onClick={editMode.onUnsettle}
                  />
                )}
                <HeaderIconButton
                  title="Delete"
                  icon="fa-trash-can"
                  tone="text-gray-500 hover:bg-red-50 hover:text-red-700"
                  onClick={editMode?.onDelete}
                />
              </>
            )
          }
          copyRow={copyRow}
          isDirty={hasChanges}
          onClose={closeForm}
          onSubmit={() => void submitForm()}
          submitLabel={isEditMode ? "Save" : "Submit"}
          submittingLabel="Saving..."
          isSubmitting={isSubmitting}
          submitDisabled={isEditMode && !hasChanges}
          summary={
            <TrnSummary
              testId="trade-summary"
              label={type?.value || "BUY"}
              amount={tradeAmount}
              currency={tradeCurrency?.value}
              scheme={getTradeColorScheme(type?.value)}
            >
              {/* How that amount was arrived at — the shares and the price
                  they were struck at. Reading it back is how you catch a
                  mis-keyed price before submitting. */}
              {!isSimpleAmount && quantity > 0 && price > 0 && (
                <span
                  data-testid="trade-summary-basis"
                  className="font-mono text-xs tabular-nums text-gray-500"
                >
                  {quantity.toLocaleString()}
                  {" @ "}
                  <Money value={price} />
                </span>
              )}
              {!cashImpact && (
                <span className="text-xs italic text-gray-500">
                  {"No cash impact"}
                </span>
              )}
              {weightInfo && !isSimpleAmount && (
                <span
                  data-testid="trade-summary-weight"
                  className="font-mono text-xs font-medium tabular-nums text-blue-600"
                >
                  {(resultingPositionWeight ?? weightInfo.value).toFixed(2)}%
                </span>
              )}
            </TrnSummary>
          }
        >
          <form
            id="trade-form"
            onSubmit={(e) => {
              e.preventDefault()
              void submitForm()
            }}
            className="space-y-3"
          >
            {/* === Trade Tab === */}
            {activeTab === "trade" && (
              <div className="space-y-3">
                {/* Type and Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div data-testid="trade-type">
                    <label className={labelClass}>{"Type"}</label>
                    <div className="mt-1">
                      <TradeTypeController
                        name="type"
                        control={control as any}
                        options={TradeTypeValues.map((value) => ({
                          value,
                          label: value,
                        }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="trade-date" className={labelClass}>
                      {"Trade date"}
                    </label>
                    <Controller
                      name="tradeDate"
                      control={control as any}
                      rules={tradeDateRules}
                      render={({ field }) => (
                        <DateInput
                          id="trade-date"
                          value={field.value}
                          onChange={field.onChange}
                          className={inputClass}
                        />
                      )}
                    />
                  </div>
                  {/* Cost date: an ADD only, under the trade date it defaults to */}
                  {hasCostDate(type?.value) && (
                    <div className="col-start-2">
                      <label htmlFor="cost-date" className={labelClass}>
                        <Tooltip text={COST_DATE_HELP} position="below">
                          {"Cost date"}
                        </Tooltip>
                      </label>
                      <Controller
                        name="costDate"
                        control={control as any}
                        render={({ field }) => (
                          <DateInput
                            id="cost-date"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            className={inputClass}
                          />
                        )}
                      />
                      {errors.costDate && (
                        <p className="mt-1 text-xs text-red-600">
                          {String(errors.costDate.message)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Market and Asset */}
                {isEditMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{"Asset"}</label>
                      <input
                        type="text"
                        value={editAssetCode}
                        disabled
                        className={`${inputClass} bg-gray-100 cursor-not-allowed text-xs`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{"Market"}</label>
                      <input
                        type="text"
                        value={editMarketCode}
                        disabled
                        className={`${inputClass} bg-gray-100 cursor-not-allowed text-xs`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{"Market"}</label>
                      <Controller
                        name="market"
                        control={control as any}
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
                        {isFetchingPrice ? `${"Asset"} ...` : "Asset"}
                      </label>
                      <div className="mt-1">
                        <AssetSearch
                          name="asset"
                          inputId="asset-search"
                          control={control as any}
                          market={watch("market")}
                          defaultValue={initialValues?.asset}
                          onSelect={handleAssetSelect}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount - shown for EXPENSE/INCOME types */}
                {isSimpleAmount && (
                  <div>
                    <label className={labelClass}>
                      {isIncome ? "Income Amount" : "Expense Amount"}
                    </label>
                    <Controller
                      name="tradeAmount"
                      control={control as any}
                      render={({ field }) => (
                        <MathInput
                          value={field.value}
                          onChange={field.onChange}
                          className={`${inputClass} text-lg font-medium`}
                          placeholder={
                            isIncome
                              ? "Enter income amount"
                              : "Enter expense amount"
                          }
                        />
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {isIncome
                        ? "This amount will be credited to the settlement account"
                        : "This amount will be debited from the settlement account"}
                    </p>
                  </div>
                )}

                {/* Fees - shown for EXPENSE/INCOME types */}
                {isSimpleAmount && (
                  <div>
                    <label className={labelClass}>{"Fees"}</label>
                    <Controller
                      name="fees"
                      control={control as any}
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
                  <div
                    className={`rounded-lg p-3 ${getQtyPriceTint(type?.value)}`}
                  >
                    {/* Three across at every width — wrapping Fees onto its
                      own row is what pushes Broker below the fold on a
                      phone. */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label className={labelClass}>
                          {actualPositionQuantity > 0 ? (
                            hasHeldBrokers ? (
                              <>
                                {"Qty ("}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowBrokerSelectionDialog(true)
                                  }
                                  className="underline decoration-dotted underline-offset-2 text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                  title="Choose the brokerage to sell from"
                                >
                                  {actualPositionQuantity.toLocaleString()}
                                </button>
                                {")"}
                              </>
                            ) : (
                              `${"Qty"} (${actualPositionQuantity.toLocaleString()})`
                            )
                          ) : (
                            "Qty"
                          )}
                        </label>
                        <Controller
                          name="quantity"
                          control={control as any}
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
                        <label className={labelClass}>{"Price"}</label>
                        <Controller
                          name="price"
                          control={control as any}
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
                        <label className={labelClass}>{"Fees"}</label>
                        <Controller
                          name="fees"
                          control={control as any}
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
                  </div>
                )}

                {/* Broker and the note side by side, so the note costs no
                    height. Expense and income have no broker. */}
                <div
                  className={
                    acceptsBroker(type?.value) ? "grid grid-cols-2 gap-3" : ""
                  }
                >
                  {acceptsBroker(type?.value) && (
                    <BrokerAccountField
                      id="trade-broker"
                      control={control as any}
                      brokers={offeredBrokers}
                      labelClassName={labelClass}
                      inputClassName={inputClass}
                    />
                  )}
                  <div>
                    <label htmlFor="trade-comment" className={labelClass}>
                      {isExpense
                        ? "Expense description"
                        : isIncome
                          ? "Income description"
                          : "Comments"}
                    </label>
                    <Controller
                      name="comment"
                      control={control as any}
                      render={({ field }) => (
                        <input
                          {...field}
                          id="trade-comment"
                          type="text"
                          className={inputClass}
                          value={field.value || ""}
                          placeholder={
                            isExpense
                              ? "e.g., Property rates, Insurance, Maintenance"
                              : isIncome
                                ? "e.g., Rental income, Dividend"
                                : undefined
                          }
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* === Invest Tab === */}
            {activeTab === "invest" && !isSimpleAmount && !isEditMode && (
              <div className="space-y-2.5">
                {/* Cash, shares and weight are three views of one trade —
                  set any one and the other two follow. The summary strip
                  below the form carries the headline total and direction,
                  so nothing here restates them. */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label htmlFor="invest-amount" className={labelClass}>
                      {isSellSide(type?.value) ? "Raise" : "Invest"}
                    </label>
                    <div className="relative">
                      <MathInput
                        id="invest-amount"
                        value={investAmount}
                        onChange={handleInvestAmountChange}
                        placeholder="0.00"
                        className={`${inputClass} pr-11`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-micro font-medium text-gray-500">
                        {currentTradeCurrency}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="invest-shares" className={labelClass}>
                      {"Shares"}
                    </label>
                    <MathInput
                      id="invest-shares"
                      value={quantity}
                      onChange={handleTradeQuantityChange}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invest-target-weight"
                      className={labelClass}
                    >
                      {"Target"}
                    </label>
                    <div className="relative">
                      <MathInput
                        id="invest-target-weight"
                        value={targetWeightValue}
                        onChange={handleTargetWeightChange}
                        placeholder={canSizeByWeight ? "0.0" : "—"}
                        disabled={!canSizeByWeight}
                        className={`${inputClass} pr-7 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        {"%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* What you hold now, and where this trade leaves it. */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                  <div className="grid grid-cols-[1fr_minmax(5.5rem,auto)_minmax(5.5rem,auto)] items-baseline gap-x-4 gap-y-1.5">
                    <span />
                    <span className="text-right text-micro font-medium uppercase tracking-wide text-gray-500">
                      {"Current"}
                    </span>
                    <span className="text-right text-micro font-medium uppercase tracking-wide text-gray-500">
                      {"After"}
                    </span>

                    <span className="text-sm text-gray-500">
                      {"Value"}
                      <span className="text-gray-500">
                        {" "}
                        {portfolio.currency.code}
                      </span>
                    </span>
                    <span
                      data-testid="invest-current-value"
                      className="text-right font-mono text-sm tabular-nums text-gray-600"
                    >
                      {positionQty > 0 ? (
                        <NumericFormat
                          value={positionQty * price * fxRate}
                          displayType="text"
                          thousandSeparator
                          decimalScale={2}
                          fixedDecimalScale
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                    <span
                      data-testid="invest-after-value"
                      className="text-right font-mono text-sm tabular-nums text-gray-900"
                    >
                      <NumericFormat
                        value={resultingPositionQuantity * price * fxRate}
                        displayType="text"
                        thousandSeparator
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </span>

                    <span className="text-sm text-gray-500">{"Weight"}</span>
                    <span
                      data-testid="invest-current-weight"
                      className="text-right font-mono text-base tabular-nums text-gray-600"
                    >
                      {currentPositionWeight === null
                        ? "—"
                        : `${currentPositionWeight.toFixed(2)}%`}
                    </span>
                    <span
                      data-testid="invest-after-weight"
                      className="text-right font-mono text-base font-semibold tabular-nums text-gray-900"
                    >
                      {resultingPositionWeight === null
                        ? "—"
                        : `${resultingPositionWeight.toFixed(2)}%`}
                    </span>
                  </div>
                </div>

                {/* Fees and where the trade executes. Price stays on the
                  Trade tab — it describes the asset, not the sizing. */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={acceptsBroker(type?.value) ? "" : "col-span-2"}
                  >
                    <label htmlFor="invest-fees" className={labelClass}>
                      {"Fees"}
                    </label>
                    <Controller
                      name="fees"
                      control={control as any}
                      render={({ field }) => (
                        <MathInput
                          id="invest-fees"
                          value={field.value}
                          onChange={field.onChange}
                          className={inputClass}
                        />
                      )}
                    />
                  </div>
                  {acceptsBroker(type?.value) && (
                    <BrokerAccountField
                      id="invest-broker"
                      control={control as any}
                      brokers={offeredBrokers}
                      labelClassName={labelClass}
                      inputClassName={inputClass}
                    />
                  )}
                </div>
              </div>
            )}

            {/* === Settlement Tab === */}
            {activeTab === "settlement" && (
              <div className="space-y-3">
                {/* Settlement Account */}
                <div data-testid="settlement-account">
                  <label className={labelClass}>
                    {isIncome
                      ? "Credit To Account"
                      : isExpense
                        ? "Debit From Account"
                        : "Settlement Account"}
                  </label>
                  <SettlementAccountSelect
                    name="settlementAccount"
                    control={control as any}
                    accounts={
                      isIncome || isExpense ? [] : (allTradeAccounts as any[])
                    }
                    bankAccounts={allBankAccounts as any[]}
                    cashAssets={
                      isIncome || isExpense
                        ? (filteredCashAssets as any[])
                        : (cashAssetsForDropdown as any[])
                    }
                    trnType={type?.value || "BUY"}
                    tradeCurrency={currentTradeCurrency}
                    defaultValue={preferredCashAsset}
                  />
                </div>

                {/* Charges — hidden for EXPENSE/INCOME (they have fees on Trade tab) */}
                {!isSimpleAmount && (
                  <div>
                    <label className={labelClass}>{"Fees"}</label>
                    <Controller
                      name="fees"
                      control={control as any}
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

                {/* Tax */}
                <div>
                  <label className={labelClass}>{"Tax"}</label>
                  <Controller
                    name="tax"
                    control={control as any}
                    render={({ field }) => (
                      <MathInput
                        value={field.value}
                        onChange={field.onChange}
                        className={inputClass}
                      />
                    )}
                  />
                </div>

                {/* Trade Amount (read-only display) */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">{"Amount"}</span>
                  <span className="tabular-nums text-sm text-gray-900">
                    <NumericFormat
                      value={tradeAmount}
                      displayType="text"
                      thousandSeparator
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </span>
                </div>

                {/* Cash Amount (read-only display) — hidden when no cash impact */}
                {cashImpact && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500">{"Cash"}</span>
                    <span className="tabular-nums text-sm text-gray-900">
                      <NumericFormat
                        value={displayCashAmount}
                        displayType="text"
                        thousandSeparator
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </span>
                  </div>
                )}

                {/* Model Selection (edit mode only) */}
                {isEditMode && models.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>{"Strategy/Model"}</label>
                      {suggestedModelId &&
                        suggestedModelId !== selectedModelId && (
                          <button
                            type="button"
                            onClick={() => setSelectedModelId(suggestedModelId)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            {"Use suggested"}
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
                      <option value="">{"-- No model --"}</option>
                      {suggestedModelId && (
                        <optgroup label={"Suggested"}>
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
                      <optgroup label={"All Models"}>
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
                        {"Model suggested based on transaction origin"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {formErrors.length > 0 && <Alert>{formErrors.join(" ")}</Alert>}
            {submitError && <Alert>{submitError}</Alert>}

            {/* Auto-settle warnings: trade saved but compensating cash transfer
                was skipped (e.g. funding portfolio has no balance in the trade
                currency). The form stays open so they can be read. */}
            {submitWarnings.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <i className="fas fa-triangle-exclamation"></i>
                  Saved with warnings
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-amber-900">
                  {submitWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="text-xs font-semibold text-amber-800 underline"
                  onClick={() => {
                    setSubmitWarnings([])
                    setModalOpen(false)
                  }}
                >
                  Dismiss & close
                </button>
              </div>
            )}
          </form>
        </TrnFormDialog>
      )}

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
          onSkip={() => {
            // Skip = sell the entire position with no specific broker, so
            // clear any prior broker pick and restore the whole-holding qty.
            setValue("brokerId", "")
            setValue("quantity", initialValues.quantity ?? 0)
            setShowBrokerSelectionDialog(false)
          }}
        />
      )}
    </>
  )
}

export default TradeInputForm
