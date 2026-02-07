import React, { useEffect, useMemo, useRef, useCallback, useState } from "react"
import { Control, Controller, useWatch, UseFormSetValue } from "react-hook-form"
import useSwr, { mutate } from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, ManualAssetCategory } from "types/independence"
import {
  Asset,
  Portfolio,
  PolicyType,
  SubAccountRequest,
} from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"
import CompositeAssetEditor from "@components/features/assets/CompositeAssetEditor"
import { buildCashRow } from "@lib/trns/tradeUtils"
import { postData } from "@components/ui/DropZone"

const msg = wizardMessages.steps.assets

// Asset category configuration with labels and growth rate info
const ASSET_CATEGORIES: {
  key: ManualAssetCategory
  label: string
  rateField: "cashReturnRate" | "equityReturnRate" | "housingReturnRate"
  rateLabel: string
}[] = [
  {
    key: "CASH",
    label: wizardMessages.assetCategories.CASH,
    rateField: "cashReturnRate",
    rateLabel: wizardMessages.rateTypes.cash,
  },
  {
    key: "EQUITY",
    label: wizardMessages.assetCategories.EQUITY,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "ETF",
    label: wizardMessages.assetCategories.ETF,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "MUTUAL_FUND",
    label: wizardMessages.assetCategories.MUTUAL_FUND,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "RE",
    label: wizardMessages.assetCategories.RE,
    rateField: "housingReturnRate",
    rateLabel: wizardMessages.rateTypes.housing,
  },
]

// Categories that count as liquid (spendable)
const LIQUID_CATEGORIES: ManualAssetCategory[] = [
  "CASH",
  "EQUITY",
  "ETF",
  "MUTUAL_FUND",
]

interface AssetsStepProps {
  control: Control<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

interface PortfoliosResponse {
  data: Portfolio[]
}

interface AssetsResponse {
  data: Record<string, Asset>
}

interface AssetPosition {
  portfolio: Portfolio
  position: unknown
  balance: number
}

interface AssetWithoutBalance {
  asset: Asset
  currentBalance: number
  targetBalance: string
  selectedPortfolioId: string
  transactionDate: string
  cashAccountId: string // For withdrawals - where to credit the cash
}

export default function AssetsStep({
  control,
  setValue,
}: AssetsStepProps): React.ReactElement {
  const hasAutoSelected = useRef(false)

  // Retirement account creation state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [accountCode, setAccountCode] = useState("")
  const [accountName, setAccountName] = useState("")
  const [policyType, setPolicyType] = useState<PolicyType | undefined>(
    undefined,
  )
  const [lockedUntilDate, setLockedUntilDate] = useState("")
  const [subAccounts, setSubAccounts] = useState<SubAccountRequest[]>([])
  // Simple asset balance (when no policyType)
  const [simpleBalance, setSimpleBalance] = useState<number>(0)
  // Income and planning fields
  const [expectedReturnRate, setExpectedReturnRate] = useState<string>("4")
  const [payoutAge, setPayoutAge] = useState<string>("65")
  const [monthlyPayoutAmount, setMonthlyPayoutAmount] = useState<string>("")
  const [contributionAmount, setContributionAmount] = useState<string>("")
  const [contributionFrequency, setContributionFrequency] = useState<
    "MONTHLY" | "ANNUAL"
  >("MONTHLY")
  const [isPension, setIsPension] = useState(true)
  const [lumpSum, setLumpSum] = useState(false)
  // Portfolio for balance transaction
  const [selectedBalancePortfolioId, setSelectedBalancePortfolioId] =
    useState<string>("")

  // Existing POLICY assets without balances
  const [assetsWithoutBalance, setAssetsWithoutBalance] = useState<
    AssetWithoutBalance[]
  >([])
  const [isCheckingBalances, setIsCheckingBalances] = useState(false)
  const [isSettingBalance, setIsSettingBalance] = useState<string | null>(null)

  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Fetch cash/bank accounts for withdrawal destination
  const { data: cashAccountsData } = useSwr<AssetsResponse>(
    "/api/assets?category=ACCOUNT",
    simpleFetcher("/api/assets?category=ACCOUNT"),
  )

  const cashAccounts = useMemo(() => {
    if (!cashAccountsData?.data) return []
    return Object.values(cashAccountsData.data)
  }, [cashAccountsData?.data])

  // Get plan currency from form
  const planCurrency = useWatch({ control, name: "expensesCurrency" }) || "NZD"

  // Filter to only show portfolios with non-zero balance
  const portfoliosWithBalance = useMemo(() => {
    return (portfoliosData?.data || []).filter(
      (p) => p.marketValue && p.marketValue !== 0,
    )
  }, [portfoliosData])

  const watchedPortfolioIds = useWatch({
    control,
    name: "selectedPortfolioIds",
  })
  const selectedPortfolioIds = useMemo(
    () => watchedPortfolioIds || [],
    [watchedPortfolioIds],
  )

  // Auto-select all portfolios with balance when data first loads
  useEffect(() => {
    if (portfoliosWithBalance.length > 0 && !hasAutoSelected.current) {
      const allIds = portfoliosWithBalance.map((p) => p.id)
      setValue("selectedPortfolioIds", allIds)
      hasAutoSelected.current = true
    }
  }, [portfoliosWithBalance, setValue])

  // Check for POLICY assets without balances
  useEffect(() => {
    const checkPolicyAssets = async (): Promise<void> => {
      setIsCheckingBalances(true)
      try {
        // Fetch all POLICY assets
        const assetsResponse = await fetch("/api/assets?category=POLICY")
        if (!assetsResponse.ok) {
          setIsCheckingBalances(false)
          return
        }

        const assetsData: AssetsResponse = await assetsResponse.json()
        const policyAssets = Object.values(assetsData.data || {})

        if (policyAssets.length === 0) {
          setAssetsWithoutBalance([])
          setIsCheckingBalances(false)
          return
        }

        // Check each asset for positions
        const assetsNeedingBalance: AssetWithoutBalance[] = []

        await Promise.all(
          policyAssets.map(async (asset) => {
            try {
              const positionsResponse = await fetch(
                `/api/assets/${asset.id}/positions?date=today`,
              )
              if (!positionsResponse.ok) {
                // If we can't check, assume it needs balance
                assetsNeedingBalance.push({
                  asset,
                  currentBalance: 0,
                  targetBalance: "",
                  selectedPortfolioId: "",
                  transactionDate: new Date().toISOString().split("T")[0],
                  cashAccountId: "",
                })
                return
              }

              const positionsData = await positionsResponse.json()
              const positions: AssetPosition[] = positionsData.data || []

              // Calculate total balance across all portfolios
              const totalBalance = positions.reduce(
                (sum, p) => sum + (p.balance || 0),
                0,
              )

              // Include assets with zero balance OR allow editing existing balances
              // For now, only show assets with zero balance
              if (totalBalance === 0) {
                assetsNeedingBalance.push({
                  asset,
                  currentBalance: totalBalance,
                  targetBalance: "",
                  selectedPortfolioId: "",
                  transactionDate: new Date().toISOString().split("T")[0],
                  cashAccountId: "",
                })
              }
            } catch (err) {
              console.error(`Error checking positions for ${asset.code}:`, err)
            }
          }),
        )

        setAssetsWithoutBalance(assetsNeedingBalance)
      } catch (err) {
        console.error("Error checking POLICY assets:", err)
      } finally {
        setIsCheckingBalances(false)
      }
    }

    checkPolicyAssets()
  }, []) // Run once on mount

  // Watch return rates for display
  const cashReturnRate = useWatch({ control, name: "cashReturnRate" }) ?? 3.5
  const equityReturnRate = useWatch({ control, name: "equityReturnRate" }) ?? 7
  const housingReturnRate =
    useWatch({ control, name: "housingReturnRate" }) ?? 4

  // Watch manual assets for display
  const manualAssets = useWatch({ control, name: "manualAssets" })

  // Calculate liquid and non-spendable totals from manual assets
  const manualAssetTotals = useMemo(() => {
    if (!manualAssets) return { liquid: 0, nonSpendable: 0, total: 0 }
    const liquid = LIQUID_CATEGORIES.reduce(
      (sum, key) => sum + (manualAssets[key] || 0),
      0,
    )
    const nonSpendable = manualAssets.RE || 0
    return { liquid, nonSpendable, total: liquid + nonSpendable }
  }, [manualAssets])

  // Get rate display value for a category
  const getRateForCategory = useCallback(
    (
      rateField: "cashReturnRate" | "equityReturnRate" | "housingReturnRate",
    ) => {
      switch (rateField) {
        case "cashReturnRate":
          return cashReturnRate
        case "equityReturnRate":
          return equityReturnRate
        case "housingReturnRate":
          return housingReturnRate
        default:
          return cashReturnRate
      }
    },
    [cashReturnRate, equityReturnRate, housingReturnRate],
  )

  // Update an existing asset's balance input
  const updateAssetBalance = useCallback(
    (
      assetId: string,
      field: keyof AssetWithoutBalance,
      value: string | number,
    ) => {
      setAssetsWithoutBalance((prev) =>
        prev.map((item) =>
          item.asset.id === assetId ? { ...item, [field]: value } : item,
        ),
      )
    },
    [],
  )

  // Set balance for an existing POLICY asset
  const handleSetExistingAssetBalance = useCallback(
    async (assetId: string) => {
      const assetEntry = assetsWithoutBalance.find(
        (a) => a.asset.id === assetId,
      )
      if (!assetEntry) return

      const targetBalance = parseFloat(assetEntry.targetBalance)
      if (isNaN(targetBalance)) return
      if (!assetEntry.selectedPortfolioId) return

      const portfolio = portfoliosData?.data?.find(
        (p) => p.id === assetEntry.selectedPortfolioId,
      )
      if (!portfolio) return

      // Calculate if this is a DEPOSIT or WITHDRAWAL
      const difference = targetBalance - assetEntry.currentBalance
      if (difference === 0) return // No change needed

      const transactionType = difference > 0 ? "DEPOSIT" : "WITHDRAWAL"
      const amount = Math.abs(difference)

      // For withdrawals, we need a cash account
      if (transactionType === "WITHDRAWAL" && !assetEntry.cashAccountId) {
        return // Can't withdraw without specifying where cash goes
      }

      setIsSettingBalance(assetId)

      try {
        const assetCurrency =
          assetEntry.asset.priceSymbol ||
          assetEntry.asset.market?.currency?.code ||
          planCurrency

        // Build the row with the specified date
        const row = buildCashRow({
          type: transactionType,
          currency: assetCurrency,
          amount,
          tradeDate: assetEntry.transactionDate,
          comments: `${transactionType === "DEPOSIT" ? "Add" : "Withdraw"} ${assetCurrency} ${amount.toLocaleString()} ${transactionType === "DEPOSIT" ? "to" : "from"} ${assetEntry.asset.name || assetEntry.asset.code}`,
          market: "PRIVATE",
          assetCode: assetEntry.asset.code,
        })

        await postData(portfolio, false, row)

        // If withdrawal, also credit the cash account
        if (transactionType === "WITHDRAWAL" && assetEntry.cashAccountId) {
          const cashAccount = cashAccounts.find(
            (a) => a.id === assetEntry.cashAccountId,
          )
          if (cashAccount) {
            const cashRow = buildCashRow({
              type: "DEPOSIT",
              currency:
                cashAccount.priceSymbol ||
                cashAccount.market?.currency?.code ||
                assetCurrency,
              amount,
              tradeDate: assetEntry.transactionDate,
              comments: `Withdrawal from ${assetEntry.asset.name || assetEntry.asset.code}`,
              market: "PRIVATE",
              assetCode: cashAccount.code,
            })
            await postData(portfolio, false, cashRow)
          }
        }

        // Remove from list after successful creation
        setAssetsWithoutBalance((prev) =>
          prev.filter((a) => a.asset.id !== assetId),
        )

        // Refresh portfolios to update balances
        await mutate(portfoliosKey)
      } catch (err) {
        console.error("Failed to set balance:", err)
      } finally {
        setIsSettingBalance(null)
      }
    },
    [assetsWithoutBalance, portfoliosData?.data, planCurrency, cashAccounts],
  )

  // Reset form state
  const resetCreateForm = useCallback(() => {
    setAccountCode("")
    setAccountName("")
    setPolicyType(undefined)
    setLockedUntilDate("")
    setSubAccounts([])
    setSimpleBalance(0)
    setExpectedReturnRate("4")
    setPayoutAge("65")
    setMonthlyPayoutAmount("")
    setContributionAmount("")
    setContributionFrequency("MONTHLY")
    setIsPension(true)
    setLumpSum(false)
    setSelectedBalancePortfolioId("")
    setCreateError(null)
    setShowCreateForm(false)
  }, [])

  // Handle creating a new retirement account
  const handleCreateRetirementAccount = useCallback(async () => {
    if (!accountCode.trim() || !accountName.trim()) {
      setCreateError("Code and name are required")
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      // Step 1: Create the asset
      const assetResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [accountCode.trim().toUpperCase()]: {
              market: "PRIVATE",
              code: accountCode.trim().toUpperCase(),
              name: accountName.trim(),
              currency: planCurrency,
              category: "POLICY",
              owner: "",
            },
          },
        }),
      })

      if (!assetResponse.ok) {
        const errorData = await assetResponse.json().catch(() => ({}))
        setCreateError(
          errorData.message ||
            `Failed to create asset: ${assetResponse.status}`,
        )
        setIsCreating(false)
        return
      }

      const assetData = await assetResponse.json()
      const createdAsset = Object.values(assetData.data)[0] as { id: string }

      if (!createdAsset?.id) {
        setCreateError("Asset created but ID not returned")
        setIsCreating(false)
        return
      }

      // Calculate the total balance
      let totalBalance = simpleBalance
      if (policyType && subAccounts.length > 0) {
        totalBalance = subAccounts.reduce(
          (sum, sa) => sum + (sa.balance || 0),
          0,
        )
      }

      // Convert contribution to monthly if annual
      const monthlyContributionValue =
        contributionFrequency === "ANNUAL"
          ? (parseFloat(contributionAmount) || 0) / 12
          : parseFloat(contributionAmount) || 0

      // Step 2: Save the policy config (always save for POLICY category)
      const configPayload: Record<string, unknown> = {
        isPension,
        payoutAge: payoutAge ? parseInt(payoutAge) : null,
        monthlyPayoutAmount: parseFloat(monthlyPayoutAmount) || 0,
        monthlyContribution: monthlyContributionValue,
        lumpSum,
        expectedReturnRate: expectedReturnRate
          ? parseFloat(expectedReturnRate) / 100
          : null,
      }

      // Add composite policy fields if policy type is selected
      if (policyType) {
        Object.assign(configPayload, {
          policyType,
          lockedUntilDate: lockedUntilDate || null,
          subAccounts,
        })
      }

      const configResponse = await fetch(
        `/api/assets/config/${createdAsset.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configPayload),
        },
      )

      if (!configResponse.ok) {
        console.error("Failed to save asset config, but asset was created")
      }

      // Step 3: Create DEPOSIT transaction for the balance
      if (totalBalance > 0 && selectedBalancePortfolioId) {
        const selectedPortfolio = portfoliosData?.data?.find(
          (p) => p.id === selectedBalancePortfolioId,
        )

        if (selectedPortfolio) {
          const row = buildCashRow({
            type: "DEPOSIT",
            currency: planCurrency,
            amount: totalBalance,
            comments: `Initial balance for ${accountName.trim()}`,
            market: "PRIVATE",
            assetCode: accountCode.trim().toUpperCase(),
          })

          try {
            await postData(selectedPortfolio, false, row)
          } catch (err) {
            console.error("Failed to create balance transaction:", err)
            // Don't fail the whole operation, asset is already created
          }
        }
      }

      // Step 4: Refresh portfolios list
      await mutate(portfoliosKey)

      // Step 4: Auto-select the new portfolio
      const currentIds = selectedPortfolioIds || []
      setValue("selectedPortfolioIds", [...currentIds, createdAsset.id])

      // Reset form and close
      resetCreateForm()
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create account",
      )
    } finally {
      setIsCreating(false)
    }
  }, [
    accountCode,
    accountName,
    planCurrency,
    policyType,
    lockedUntilDate,
    subAccounts,
    simpleBalance,
    expectedReturnRate,
    payoutAge,
    monthlyPayoutAmount,
    contributionAmount,
    contributionFrequency,
    isPension,
    lumpSum,
    selectedBalancePortfolioId,
    portfoliosData?.data,
    selectedPortfolioIds,
    setValue,
    resetCreateForm,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {msg.title}
        </h2>
        <p className="text-gray-600">{msg.description}</p>
      </div>

      {/* Portfolio Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">
          {msg.selectPortfolios}
        </h3>
        <p className="text-sm text-gray-600">
          {msg.selectPortfoliosDescription}
        </p>

        {portfoliosWithBalance.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <i className="fas fa-info-circle text-yellow-600 mt-0.5 mr-3"></i>
                <div>
                  <p className="font-medium text-yellow-800">
                    {msg.noPortfolios}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {msg.noPortfoliosDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ASSET_CATEGORIES.map((category) => (
                <div key={category.key}>
                  <label
                    htmlFor={`manualAssets.${category.key}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {category.label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      $
                    </span>
                    <Controller
                      name={`manualAssets.${category.key}`}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          id={`manualAssets.${category.key}`}
                          type="number"
                          min={0}
                          step={1000}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value) || 0)
                          }
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                        />
                      )}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.growsAt
                      .replace(
                        "{rate}",
                        String(getRateForCategory(category.rateField)),
                      )
                      .replace("{type}", category.rateLabel)}
                  </p>
                </div>
              ))}
            </div>

            {manualAssetTotals.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">{msg.liquidAssets}</span>
                  <span className="font-medium text-blue-800">
                    {planCurrency} {manualAssetTotals.liquid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">{msg.realEstate}</span>
                  <span className="font-medium text-blue-800">
                    {planCurrency}{" "}
                    {manualAssetTotals.nonSpendable.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                  <div className="flex items-center">
                    <i className="fas fa-chart-pie text-blue-600 mr-2"></i>
                    <span className="font-medium text-blue-800">
                      {msg.totalAssets}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-blue-700">
                    {planCurrency} {manualAssetTotals.total.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {portfoliosWithBalance.map((portfolio) => (
              <Controller
                key={portfolio.id}
                name="selectedPortfolioIds"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value?.includes(portfolio.id) || false}
                      onChange={(e) => {
                        const current = field.value || []
                        if (e.target.checked) {
                          field.onChange([...current, portfolio.id])
                        } else {
                          field.onChange(
                            current.filter((id: string) => id !== portfolio.id),
                          )
                        }
                      }}
                      className="h-4 w-4 text-independence-600 focus:ring-independence-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-medium text-gray-900">
                        {portfolio.code}
                      </span>
                      <span className="text-gray-500 ml-2">
                        {portfolio.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700 font-medium">
                        {portfolio.base?.code || portfolio.currency?.code}{" "}
                        {Math.round(
                          portfolio.marketValue || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </label>
                )}
              />
            ))}
          </div>
        )}

        {/* Existing POLICY Assets Without Balances */}
        {isCheckingBalances && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <i className="fas fa-spinner fa-spin text-gray-400 mr-2"></i>
            <span className="text-gray-600">{msg.checkingAssets}</span>
          </div>
        )}

        {!isCheckingBalances && assetsWithoutBalance.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="font-medium text-amber-900 flex items-center">
                <i className="fas fa-exclamation-triangle text-amber-600 mr-2"></i>
                {msg.assetsNeedingBalance}
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                {msg.assetsNeedingBalanceDescription}
              </p>
            </div>

            <div className="space-y-3">
              {assetsWithoutBalance.map((entry) => (
                <div
                  key={entry.asset.id}
                  className="bg-white border border-amber-100 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">
                        {entry.asset.name || entry.asset.code}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({entry.asset.code})
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {entry.asset.priceSymbol ||
                        entry.asset.market?.currency?.code}
                    </span>
                  </div>

                  {/* Row 1: Balance and Date */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {/* Balance Input */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {msg.currentBalance}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-gray-500 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={entry.targetBalance}
                          onChange={(e) =>
                            updateAssetBalance(
                              entry.asset.id,
                              "targetBalance",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                          className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Transaction Date */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {msg.transactionDate}
                      </label>
                      <input
                        type="date"
                        value={entry.transactionDate}
                        onChange={(e) =>
                          updateAssetBalance(
                            entry.asset.id,
                            "transactionDate",
                            e.target.value,
                          )
                        }
                        className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Portfolio and Cash Account (for withdrawals) */}
                  <div className="flex items-end space-x-2">
                    {/* Portfolio Selector */}
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">
                        {msg.selectPortfolio}
                      </label>
                      <select
                        value={entry.selectedPortfolioId}
                        onChange={(e) =>
                          updateAssetBalance(
                            entry.asset.id,
                            "selectedPortfolioId",
                            e.target.value,
                          )
                        }
                        className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="">{msg.selectPortfolioHint}</option>
                        {portfoliosData?.data?.map((portfolio) => (
                          <option key={portfolio.id} value={portfolio.id}>
                            {portfolio.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cash Account Selector - only shown for withdrawals */}
                    {entry.targetBalance &&
                      parseFloat(entry.targetBalance) <
                        entry.currentBalance && (
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">
                            {msg.cashAccount}
                          </label>
                          <select
                            value={entry.cashAccountId}
                            onChange={(e) =>
                              updateAssetBalance(
                                entry.asset.id,
                                "cashAccountId",
                                e.target.value,
                              )
                            }
                            className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          >
                            <option value="">{msg.cashAccountHint}</option>
                            {cashAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} (
                                {account.priceSymbol ||
                                  account.market?.currency?.code}
                                )
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                    {/* Set Balance Button */}
                    <button
                      type="button"
                      onClick={() =>
                        handleSetExistingAssetBalance(entry.asset.id)
                      }
                      disabled={
                        isSettingBalance === entry.asset.id ||
                        !entry.targetBalance ||
                        !entry.selectedPortfolioId ||
                        // No change needed if target equals current
                        parseFloat(entry.targetBalance) ===
                          entry.currentBalance ||
                        // For withdrawals, require cash account selection
                        (parseFloat(entry.targetBalance) <
                          entry.currentBalance &&
                          !entry.cashAccountId)
                      }
                      className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap"
                    >
                      {isSettingBalance === entry.asset.id ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-1"></i>
                          {msg.settingBalance}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check mr-1"></i>
                          {msg.setBalance}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Transaction Type Indicator */}
                  {entry.targetBalance &&
                    parseFloat(entry.targetBalance) !==
                      entry.currentBalance && (
                      <div className="mt-2 text-xs">
                        {parseFloat(entry.targetBalance) >
                        entry.currentBalance ? (
                          <span className="text-green-600">
                            <i className="fas fa-arrow-up mr-1"></i>
                            {msg.depositTransaction}:{" "}
                            {entry.asset.priceSymbol || planCurrency}{" "}
                            {(
                              parseFloat(entry.targetBalance) -
                              entry.currentBalance
                            ).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-red-600">
                            <i className="fas fa-arrow-down mr-1"></i>
                            {msg.withdrawalTransaction}:{" "}
                            {entry.asset.priceSymbol || planCurrency}{" "}
                            {(
                              entry.currentBalance -
                              parseFloat(entry.targetBalance)
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Retirement Account Button and Form */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              {msg.addRetirementAccount}
            </button>
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-indigo-900 flex items-center">
                    <i className="fas fa-piggy-bank text-indigo-600 mr-2"></i>
                    {msg.createRetirementAccount}
                  </h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    {msg.retirementAccountDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="text-indigo-400 hover:text-indigo-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Error message */}
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {createError}
                </div>
              )}

              {/* Account Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {msg.accountCode}
                </label>
                <input
                  type="text"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value.toUpperCase())}
                  placeholder={msg.accountCodeHint}
                  maxLength={20}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {msg.accountName}
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={msg.accountNameHint}
                  maxLength={50}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Currency note */}
              <div className="text-sm text-gray-600">
                <i className="fas fa-info-circle mr-1"></i>
                Currency: <span className="font-medium">
                  {planCurrency}
                </span>{" "}
                (matches your plan currency)
              </div>

              {/* Composite Asset Editor */}
              <CompositeAssetEditor
                policyType={policyType}
                lockedUntilDate={lockedUntilDate}
                subAccounts={subAccounts}
                onPolicyTypeChange={setPolicyType}
                onLockedUntilDateChange={setLockedUntilDate}
                onSubAccountsChange={setSubAccounts}
              />

              {/* Simple Asset Balance (when no policy type selected) */}
              {!policyType && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {msg.currentBalance}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={simpleBalance || ""}
                      onChange={(e) =>
                        setSimpleBalance(Number(e.target.value) || 0)
                      }
                      placeholder={msg.currentBalanceHint}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Portfolio Selection for Balance Transaction */}
              {portfoliosData?.data && portfoliosData.data.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {msg.selectPortfolio}
                  </label>
                  <select
                    value={selectedBalancePortfolioId}
                    onChange={(e) =>
                      setSelectedBalancePortfolioId(e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">{msg.selectPortfolioHint}</option>
                    {portfoliosData.data.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>
                        {portfolio.code} - {portfolio.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    A DEPOSIT transaction will be created in this portfolio
                  </p>
                </div>
              )}

              {/* Income & Planning Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <h5 className="font-medium text-gray-800 flex items-center">
                  <i className="fas fa-calendar-alt text-indigo-500 mr-2"></i>
                  {msg.incomeAndPlanning}
                </h5>

                <div className="grid grid-cols-2 gap-4">
                  {/* Expected Return Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {msg.expectedReturnRate}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={expectedReturnRate}
                        onChange={(e) => setExpectedReturnRate(e.target.value)}
                        className="w-full pr-8 py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-500">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Payout Age */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {msg.payoutAge}
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={payoutAge}
                      onChange={(e) => setPayoutAge(e.target.value)}
                      placeholder={msg.payoutAgeHint}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Contribution Amount with Frequency */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {msg.contributionAmount}
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={contributionAmount}
                          onChange={(e) =>
                            setContributionAmount(e.target.value)
                          }
                          placeholder={msg.contributionAmountHint}
                          className="w-full pl-8 py-2 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <select
                        value={contributionFrequency}
                        onChange={(e) =>
                          setContributionFrequency(
                            e.target.value as "MONTHLY" | "ANNUAL",
                          )
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="MONTHLY">{msg.monthly}</option>
                        <option value="ANNUAL">{msg.annual}</option>
                      </select>
                    </div>
                  </div>

                  {/* Monthly Payout Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {msg.monthlyPayoutAmount}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={monthlyPayoutAmount}
                        onChange={(e) => setMonthlyPayoutAmount(e.target.value)}
                        placeholder={msg.monthlyPayoutHint}
                        className="w-full pl-8 py-2 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap gap-4 pt-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPension}
                      onChange={(e) => setIsPension(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {msg.isPension}
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lumpSum}
                      onChange={(e) => setLumpSum(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {msg.lumpSum}
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCreateRetirementAccount}
                  disabled={
                    isCreating || !accountCode.trim() || !accountName.trim()
                  }
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 px-4 font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isCreating ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {msg.creating}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      {msg.createRetirementAccount}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetCreateForm}
                  disabled={isCreating}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedPortfolioIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <i className="fas fa-chart-pie text-blue-600 mr-3"></i>
                <div>
                  <span className="font-medium text-blue-800">
                    {selectedPortfolioIds.length}{" "}
                    {selectedPortfolioIds.length > 1
                      ? msg.portfoliosSelectedPlural
                      : msg.portfoliosSelected}{" "}
                    {msg.selected}
                  </span>
                  <p className="text-xs text-blue-600">
                    {msg.conversionNote.replace("{currency}", planCurrency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
