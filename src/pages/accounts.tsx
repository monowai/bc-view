import React, { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useTranslation } from "next-i18next"
import useSwr, { mutate } from "swr"
import { simpleFetcher, ccyKey, categoriesKey } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { Asset, AssetCategory, CurrencyOption } from "types/beancounter"
import { currencyOptions } from "@lib/currency"
import { useRouter } from "next/router"
import SetAccountBalancesDialog from "@components/features/accounts/SetAccountBalancesDialog"
import SetBalanceDialog from "@components/features/holdings/SetBalanceDialog"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import MathInput from "@components/ui/MathInput"
import CompositeAssetEditor from "@components/features/assets/CompositeAssetEditor"
import { PolicyType, SubAccountRequest } from "types/beancounter"

interface SectorInfo {
  code: string
  name: string
  standard: string
}

interface SectorOption {
  value: string
  label: string
}

// Categories that can be used for user-owned custom assets
const USER_ASSET_CATEGORIES = ["ACCOUNT", "RE", "MUTUAL FUND", "POLICY"]

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  ACCOUNT: "fa-university",
  RE: "fa-home",
  "MUTUAL FUND": "fa-chart-pie",
  POLICY: "fa-piggy-bank",
}

interface CategoryOption {
  value: string
  label: string
}

interface EditAccountData {
  asset: Asset
}

interface DeleteAccountData {
  asset: Asset
}

interface SetPriceData {
  asset: Asset
}

interface SetBalancesData {
  asset: Asset
}

interface SetBalanceData {
  asset: Asset
}

type TabType = "overview" | "all" | string

interface AccountActionsProps {
  onImportClick: () => void
  activeTab: TabType
}

const AccountActions = ({
  onImportClick,
  activeTab,
}: AccountActionsProps): React.ReactElement => {
  const router = useRouter()
  const { t } = useTranslation("common")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/assets/export")
      if (!response.ok) {
        console.error("Export failed: HTTP", response.status)
        return
      }
      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "assets.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex space-x-2">
      <button
        className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <i className="fas fa-spinner fa-spin mr-2"></i>
        ) : (
          <i className="fas fa-download mr-2"></i>
        )}
        {t("accounts.export")}
      </button>
      <button
        className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {t("accounts.import")}
      </button>
      <button
        className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        onClick={() => {
          // Pass category if on a specific category tab (not "overview" or "all")
          const categoryParam =
            activeTab !== "overview" && activeTab !== "all"
              ? `?category=${activeTab}`
              : ""
          router.push(`/assets/account${categoryParam}`)
        }}
      >
        {t("account.create")}
      </button>
    </div>
  )
}

interface CategoryCardProps {
  categoryId: string
  categoryName: string
  count: number
  onSelect: (category: string) => void
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  categoryId,
  categoryName,
  count,
  onSelect,
}) => {
  const { t } = useTranslation("common")
  const icon = CATEGORY_ICONS[categoryId] || "fa-folder"
  const description = t(`category.${categoryId}.desc`)

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
      onClick={() => onSelect(categoryId)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <i className={`fas ${icon} text-blue-600 text-xl`}></i>
        </div>
        <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
          {count}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {categoryName}
      </h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

interface OverviewTabProps {
  accounts: Asset[]
  categoryOptions: CategoryOption[]
  onSelectCategory: (category: string) => void
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  accounts,
  categoryOptions,
  onSelectCategory,
}) => {
  const { t } = useTranslation("common")

  // Count assets per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    USER_ASSET_CATEGORIES.forEach((cat) => {
      counts[cat] = 0
    })
    accounts.forEach((account) => {
      const catId = account.assetCategory?.id
      if (catId && counts[catId] !== undefined) {
        counts[catId]++
      }
    })
    return counts
  }, [accounts])

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">{t("accounts.overview.description")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryOptions.map((cat) => (
          <CategoryCard
            key={cat.value}
            categoryId={cat.value}
            categoryName={cat.label}
            count={categoryCounts[cat.value] || 0}
            onSelect={onSelectCategory}
          />
        ))}
      </div>
    </div>
  )
}

interface AssetTableProps {
  accounts: Asset[]
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
  onSetPrice: (asset: Asset) => void
  onSetBalances: (asset: Asset) => void
  onSetBalance: (asset: Asset) => void
  emptyMessage?: string
}

const AssetTable: React.FC<AssetTableProps> = ({
  accounts,
  onEdit,
  onDelete,
  onSetPrice,
  onSetBalances,
  onSetBalance,
  emptyMessage,
}) => {
  const { t } = useTranslation("common")

  if (accounts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <p>{emptyMessage || t("accounts.empty")}</p>
        <p className="text-sm mt-2">{t("accounts.tab.empty.hint")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("accounts.code")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("accounts.name")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("accounts.category")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("accounts.currency")}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("accounts.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {accounts.map((account) => (
            <tr key={account.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {stripOwnerPrefix(account.code)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {account.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {t(`category.${account.assetCategory?.id}`) ||
                  account.assetCategory?.name ||
                  "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {account.priceSymbol || account.market?.currency?.code || "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {account.assetCategory?.id === "ACCOUNT" ? (
                  <button
                    onClick={() => onSetBalances(account)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                  >
                    <i className="fas fa-balance-scale mr-1"></i>
                    {t("accounts.setBalances")}
                  </button>
                ) : account.assetCategory?.id === "POLICY" ? (
                  <button
                    onClick={() => onSetBalance(account)}
                    className="text-amber-600 hover:text-amber-900 mr-4"
                  >
                    <i className="fas fa-piggy-bank mr-1"></i>
                    {t("balance.set")}
                  </button>
                ) : (
                  <button
                    onClick={() => onSetPrice(account)}
                    className="text-green-600 hover:text-green-900 mr-4"
                  >
                    <i className="fas fa-dollar-sign mr-1"></i>
                    {t("price.set")}
                  </button>
                )}
                <button
                  onClick={() => onEdit(account)}
                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                >
                  <i className="fas fa-edit mr-1"></i>
                  {t("edit")}
                </button>
                <button
                  onClick={() => onDelete(account)}
                  className="text-red-600 hover:text-red-900"
                >
                  <i className="fas fa-trash mr-1"></i>
                  {t("delete")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountsPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const {
    data: accountsData,
    error,
    isLoading,
  } = useSwr("/api/assets", simpleFetcher("/api/assets"))
  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const { data: categoriesData, isLoading: categoriesLoading } = useSwr(
    categoriesKey,
    simpleFetcher(categoriesKey),
  )
  const { data: sectorsData, isLoading: sectorsLoading } = useSwr<{
    data: SectorInfo[]
  }>(
    "/api/classifications/sectors",
    simpleFetcher("/api/classifications/sectors"),
  )

  // Convert backend categories to select options, filtering to user asset types
  const categoryOptions = useMemo((): CategoryOption[] => {
    if (!categoriesData?.data) return []
    return categoriesData.data
      .filter((cat: AssetCategory) => USER_ASSET_CATEGORIES.includes(cat.id))
      .map((cat: AssetCategory) => ({
        value: cat.id,
        label: cat.name,
      }))
  }, [categoriesData?.data])

  // Convert sectors to select options
  const sectorOptions = useMemo((): SectorOption[] => {
    if (!sectorsData?.data) return []
    return sectorsData.data.map((sector: SectorInfo) => ({
      value: sector.name,
      label: sector.name,
    }))
  }, [sectorsData?.data])

  const [editData, setEditData] = useState<EditAccountData | undefined>(
    undefined,
  )
  const [deleteData, setDeleteData] = useState<DeleteAccountData | undefined>(
    undefined,
  )
  const [setPriceData, setSetPriceData] = useState<SetPriceData | undefined>(
    undefined,
  )
  const [setBalancesData, setSetBalancesData] = useState<
    SetBalancesData | undefined
  >(undefined)
  const [setBalanceData, setSetBalanceData] = useState<
    SetBalanceData | undefined
  >(undefined)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const handleEdit = useCallback((asset: Asset) => {
    setEditData({ asset })
  }, [])

  const handleDelete = useCallback((asset: Asset) => {
    setDeleteData({ asset })
  }, [])

  const handleEditClose = useCallback(() => {
    setEditData(undefined)
  }, [])

  const handleDeleteClose = useCallback(() => {
    setDeleteData(undefined)
  }, [])

  const handleEditSave = useCallback(
    async (
      assetId: string,
      code: string,
      name: string,
      currency: string,
      category: string,
      sector?: string,
      expectedReturnRate?: number,
    ) => {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: "PRIVATE",
          code,
          name,
          currency,
          category,
          expectedReturnRate,
        }),
      })
      if (!response.ok) {
        const error = new Error("Failed to update asset")
        console.error("Error updating asset:", error)
        throw error
      }
      // Update sector classification if provided
      if (sector) {
        try {
          await fetch(`/api/classifications/${assetId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sector }),
          })
        } catch (err) {
          console.error("Failed to update sector classification:", err)
        }
      }
      // Refresh the assets list
      await mutate("/api/assets")
      setEditData(undefined)
    },
    [],
  )

  const handleDeleteConfirm = useCallback(async (assetId: string) => {
    const response = await fetch(`/api/assets/${assetId}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const error = new Error("Failed to delete asset")
      console.error("Error deleting asset:", error)
      throw error
    }
    // Refresh the assets list and invalidate holdings
    await mutate("/api/assets")
    mutate("/api/holdings/aggregated?asAt=today")
    setDeleteData(undefined)
  }, [])

  const handleSetPrice = useCallback((asset: Asset) => {
    setSetPriceData({ asset })
  }, [])

  const handleSetPriceClose = useCallback(() => {
    setSetPriceData(undefined)
  }, [])

  const handleSetBalances = useCallback((asset: Asset) => {
    setSetBalancesData({ asset })
  }, [])

  const handleSetBalancesClose = useCallback(() => {
    setSetBalancesData(undefined)
  }, [])

  const handleSetBalancesComplete = useCallback(() => {
    setSetBalancesData(undefined)
  }, [])

  // POLICY asset balance handlers
  const handleSetBalance = useCallback((asset: Asset) => {
    setSetBalanceData({ asset })
  }, [])

  const handleSetBalanceClose = useCallback(() => {
    setSetBalanceData(undefined)
  }, [])

  const handleSetBalanceComplete = useCallback(async () => {
    await mutate("/api/assets")
    setSetBalanceData(undefined)
  }, [])

  const handleImportClick = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleImportClose = useCallback(() => {
    setShowImportDialog(false)
  }, [])

  const handleImportComplete = useCallback(async () => {
    await mutate("/api/assets")
    setShowImportDialog(false)
  }, [])

  const handleSetPriceSave = useCallback(
    async (assetId: string, date: string, price: string) => {
      const response = await fetch("/api/prices/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          date,
          closePrice: parseFloat(price),
        }),
      })
      if (!response.ok) {
        const error = new Error("Failed to set price")
        console.error("Error setting price:", error)
        throw error
      }
      setSetPriceData(undefined)
    },
    [],
  )

  const handleSelectCategory = useCallback((category: string) => {
    setActiveTab(category)
  }, [])

  // Convert accounts data to array
  const accounts = useMemo(() => {
    if (!accountsData?.data) return []
    return Object.values(accountsData.data as Record<string, Asset>)
  }, [accountsData?.data])

  // Currency options
  const ccyOptions = useMemo(() => {
    if (!ccyData?.data) return []
    return currencyOptions(ccyData.data)
  }, [ccyData?.data])

  // Filter accounts based on active tab
  const filteredAccounts = useMemo(() => {
    if (activeTab === "overview") return []
    if (activeTab === "all") return accounts
    return accounts.filter((account) => account.assetCategory?.id === activeTab)
  }, [accounts, activeTab])

  // Tab definitions
  const tabs = useMemo(
    (): { id: TabType; label: string }[] => [
      { id: "overview", label: t("accounts.overview") },
      { id: "all", label: t("accounts.all") },
      ...categoryOptions.map((cat) => ({ id: cat.value, label: cat.label })),
    ],
    [categoryOptions, t],
  )

  if (
    !ready ||
    isLoading ||
    ccyLoading ||
    categoriesLoading ||
    sectorsLoading
  ) {
    return rootLoader(t("loading"))
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {t("accounts.error.load")}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">{t("accounts.title")}</h1>
        <AccountActions
          onImportClick={handleImportClick}
          activeTab={activeTab}
        />
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav
          className="-mb-px flex space-x-8 overflow-x-auto"
          aria-label="Tabs"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.id !== "overview" && (
                <span
                  className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.id
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tab.id === "all"
                    ? accounts.length
                    : accounts.filter((a) => a.assetCategory?.id === tab.id)
                        .length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" ? (
        <OverviewTab
          accounts={accounts}
          categoryOptions={categoryOptions}
          onSelectCategory={handleSelectCategory}
        />
      ) : (
        <AssetTable
          accounts={filteredAccounts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSetPrice={handleSetPrice}
          onSetBalances={handleSetBalances}
          onSetBalance={handleSetBalance}
          emptyMessage={
            activeTab === "all"
              ? t("accounts.empty")
              : t("accounts.tab.empty", {
                  category: t(`category.${activeTab}`),
                })
          }
        />
      )}

      {/* Edit Dialog */}
      {editData && (
        <EditAccountDialog
          asset={editData.asset}
          currencies={ccyOptions}
          categories={categoryOptions}
          sectors={sectorOptions}
          onClose={handleEditClose}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteData && (
        <DeleteAccountDialog
          asset={deleteData.asset}
          onClose={handleDeleteClose}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Set Price Dialog */}
      {setPriceData && (
        <SetPriceDialog
          asset={setPriceData.asset}
          onClose={handleSetPriceClose}
          onSave={handleSetPriceSave}
        />
      )}

      {/* Set Balances Dialog (for ACCOUNT category) */}
      {setBalancesData && (
        <SetAccountBalancesDialog
          asset={setBalancesData.asset}
          onClose={handleSetBalancesClose}
          onComplete={handleSetBalancesComplete}
        />
      )}

      {/* Set Balance Dialog (for POLICY/Retirement Fund category) */}
      {setBalanceData && (
        <SetBalanceDialog
          asset={setBalanceData.asset}
          onClose={handleSetBalanceClose}
          onComplete={handleSetBalanceComplete}
        />
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog
          onClose={handleImportClose}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  )
}

interface EditAccountDialogProps {
  asset: Asset
  currencies: CurrencyOption[]
  categories: CategoryOption[]
  sectors: SectorOption[]
  onClose: () => void
  onSave: (
    assetId: string,
    code: string,
    name: string,
    currency: string,
    category: string,
    sector?: string,
    expectedReturnRate?: number,
  ) => Promise<void>
}

// Private Asset Config state interface
interface AssetConfigState {
  monthlyRentalIncome: string
  rentalCurrency: string
  countryCode: string
  monthlyManagementFee: string
  managementFeePercent: string
  monthlyBodyCorporateFee: string
  annualPropertyTax: string
  annualInsurance: string
  monthlyOtherExpenses: string
  deductIncomeTax: boolean
  isPrimaryResidence: boolean
  liquidationPriority: string
  transactionDayOfMonth: string
  creditAccountId: string
  autoGenerateTransactions: boolean
  // Pension/Policy specific fields
  isPension: boolean
  payoutAge: string
  monthlyPayoutAmount: string
  monthlyContribution: string
  lumpSum: boolean
  expectedReturnRate: string
  // Composite policy support
  policyType: PolicyType | undefined
  lockedUntilDate: string
  subAccounts: SubAccountRequest[]
  // For projection calculation (client-side only)
  currentAge: string
}

const defaultConfigState: AssetConfigState = {
  monthlyRentalIncome: "0",
  rentalCurrency: "NZD",
  countryCode: "NZ",
  monthlyManagementFee: "0",
  managementFeePercent: "0",
  monthlyBodyCorporateFee: "0",
  annualPropertyTax: "0",
  annualInsurance: "0",
  monthlyOtherExpenses: "0",
  deductIncomeTax: false,
  isPrimaryResidence: false,
  liquidationPriority: "100",
  transactionDayOfMonth: "1",
  creditAccountId: "",
  autoGenerateTransactions: false,
  // Pension/Policy specific fields
  isPension: false,
  payoutAge: "",
  monthlyPayoutAmount: "0",
  monthlyContribution: "0",
  lumpSum: false,
  expectedReturnRate: "",
  policyType: undefined,
  lockedUntilDate: "",
  subAccounts: [],
  currentAge: "",
}

// Common country codes for tax jurisdictions
const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
]

type EditTab = "details" | "income"

const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  asset,
  currencies,
  categories,
  sectors,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation("common")
  const [activeTab, setActiveTab] = useState<EditTab>("details")
  const [code, setCode] = useState(stripOwnerPrefix(asset.code))
  const [name, setName] = useState(asset.name || "")
  const [currency, setCurrency] = useState(
    asset.priceSymbol || asset.market?.currency?.code || "USD",
  )
  const [category, setCategory] = useState(asset.assetCategory?.id || "ACCOUNT")
  const [sector, setSector] = useState("")
  // Expected return rate as percentage (e.g., 3.0 for 3%)
  const [expectedReturnRate, setExpectedReturnRate] = useState(
    asset.expectedReturnRate ? (asset.expectedReturnRate * 100).toString() : "",
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Private Asset Config state (for RE category)
  const [config, setConfig] = useState<AssetConfigState>(defaultConfigState)
  const [configLoading, setConfigLoading] = useState(false)

  // Country-based tax rates for income tax calculation
  const [countryTaxRates, setCountryTaxRates] = useState<
    Record<string, number>
  >({})

  // Lump sum projection from backend
  const [lumpSumProjection, setLumpSumProjection] = useState<{
    projectedPayout: number
    totalContributions: number
    interestEarned: number
    yearsToMaturity: number
  } | null>(null)
  const [projectionLoading, setProjectionLoading] = useState(false)

  // User's plan data for age-based calculations
  const [planData, setPlanData] = useState<{
    currentAge: number
    retirementAge: number
  } | null>(null)

  // Show income/planning tab for RE and POLICY categories
  const showIncomeTab = category === "RE" || category === "POLICY"

  // Fetch country tax rates on mount
  useEffect(() => {
    async function fetchCountryTaxRates(): Promise<void> {
      try {
        const response = await fetch("/api/tax-rates")
        if (response.ok) {
          const data = await response.json()
          if (data.data) {
            const rates: Record<string, number> = {}
            data.data.forEach(
              (taxRate: { countryCode: string; rate: number }) => {
                rates[taxRate.countryCode] = taxRate.rate || 0
              },
            )
            setCountryTaxRates(rates)
          }
        }
      } catch (err) {
        console.error("Failed to fetch country tax rates:", err)
      }
    }
    fetchCountryTaxRates()
  }, [])

  // Fetch user's independence plan for age data (used for POLICY projections)
  useEffect(() => {
    async function fetchPlanData(): Promise<void> {
      // Only fetch for POLICY assets
      const categoryId = asset.assetCategory?.id
      if (categoryId !== "POLICY") return

      try {
        const response = await fetch("/api/independence/plans")
        if (response.ok) {
          const data = await response.json()
          const plans = data.data || []
          if (plans.length > 0) {
            // Use the first plan's data
            const plan = plans[0]
            const currentYear = new Date().getFullYear()
            const currentAge = plan.yearOfBirth
              ? currentYear - plan.yearOfBirth
              : null
            const lifeExpectancy = plan.lifeExpectancy || 90
            const retirementAge = plan.planningHorizonYears
              ? lifeExpectancy - plan.planningHorizonYears
              : 65

            if (currentAge) {
              setPlanData({ currentAge, retirementAge })
              // Also set currentAge in config for projection calculation
              setConfig((prev) => ({
                ...prev,
                currentAge: String(currentAge),
              }))
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch plan data:", err)
      }
    }
    fetchPlanData()
  }, [asset.assetCategory?.id])

  // Fetch current sector classification on mount
  useEffect(() => {
    async function fetchCurrentSector(): Promise<void> {
      try {
        const response = await fetch(`/api/classifications/${asset.id}`)
        if (response.ok) {
          const data = await response.json()
          // Response is { data: [{ level: "SECTOR", item: { name: "..." }, ... }] }
          const classifications = data.data || []
          const sectorClassification = classifications.find(
            (c: { level: string }) => c.level === "SECTOR",
          )
          if (sectorClassification?.item?.name) {
            setSector(sectorClassification.item.name)
          }
        }
      } catch (err) {
        console.error("Failed to fetch sector:", err)
      }
    }
    fetchCurrentSector()
  }, [asset.id])

  // Fetch existing private asset config for RE and POLICY assets
  useEffect(() => {
    async function fetchAssetConfig(): Promise<void> {
      const categoryId = asset.assetCategory?.id
      if (categoryId !== "RE" && categoryId !== "POLICY") return

      setConfigLoading(true)
      try {
        const response = await fetch(`/api/assets/config/${asset.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.data) {
            setConfig({
              // Round monetary values to 2 decimal places to avoid floating point display issues
              monthlyRentalIncome: String(
                Math.round((data.data.monthlyRentalIncome || 0) * 100) / 100,
              ),
              rentalCurrency: data.data.rentalCurrency || "NZD",
              countryCode: data.data.countryCode || "NZ",
              monthlyManagementFee: String(
                Math.round((data.data.monthlyManagementFee || 0) * 100) / 100,
              ),
              // Round percentage to 1 decimal place
              managementFeePercent: String(
                Math.round((data.data.managementFeePercent || 0) * 1000) / 10,
              ),
              monthlyBodyCorporateFee: String(
                Math.round((data.data.monthlyBodyCorporateFee || 0) * 100) /
                  100,
              ),
              // Round annual values to whole numbers
              annualPropertyTax: String(
                Math.round(data.data.annualPropertyTax) || 0,
              ),
              annualInsurance: String(
                Math.round(data.data.annualInsurance) || 0,
              ),
              monthlyOtherExpenses: String(
                Math.round((data.data.monthlyOtherExpenses || 0) * 100) / 100,
              ),
              deductIncomeTax: data.data.deductIncomeTax || false,
              isPrimaryResidence: data.data.isPrimaryResidence || false,
              liquidationPriority: String(data.data.liquidationPriority || 100),
              transactionDayOfMonth: String(
                data.data.transactionDayOfMonth || 1,
              ),
              creditAccountId: data.data.creditAccountId || "",
              autoGenerateTransactions:
                data.data.autoGenerateTransactions || false,
              // Pension/Policy specific fields
              isPension: data.data.isPension || false,
              payoutAge: data.data.payoutAge ? String(data.data.payoutAge) : "",
              monthlyPayoutAmount: String(
                Math.round((data.data.monthlyPayoutAmount || 0) * 100) / 100,
              ),
              monthlyContribution: String(
                Math.round((data.data.monthlyContribution || 0) * 100) / 100,
              ),
              lumpSum: data.data.lumpSum || false,
              // Round to 1 decimal place for percentage display (e.g., 3.0%, 5.5%)
              expectedReturnRate: data.data.expectedReturnRate
                ? String(Math.round(data.data.expectedReturnRate * 1000) / 10)
                : "",
              // Composite policy support
              policyType: data.data.policyType || undefined,
              lockedUntilDate: data.data.lockedUntilDate || "",
              subAccounts: (data.data.subAccounts || []).map(
                (sa: {
                  code: string
                  displayName?: string
                  balance: number
                  expectedReturnRate?: number
                  feeRate?: number
                  liquid: boolean
                }) => ({
                  code: sa.code,
                  displayName: sa.displayName,
                  balance: sa.balance || 0,
                  expectedReturnRate: sa.expectedReturnRate,
                  feeRate: sa.feeRate,
                  liquid: sa.liquid,
                }),
              ),
              // Client-side only for projection calculation
              currentAge: "",
            })
          } else if (categoryId === "POLICY") {
            // Set default isPension for POLICY category even if no config exists
            setConfig((prev) => ({
              ...prev,
              isPension: false,
            }))
          }
        }
      } catch (err) {
        console.error("Failed to fetch asset config:", err)
      } finally {
        setConfigLoading(false)
      }
    }
    fetchAssetConfig()
  }, [asset.id, asset.assetCategory?.id])

  // Fetch lump sum projection from backend when parameters change
  useEffect(() => {
    async function fetchLumpSumProjection(): Promise<void> {
      // Only fetch for lump sum policies with required fields
      if (!config.lumpSum || !config.payoutAge || !config.currentAge) {
        setLumpSumProjection(null)
        return
      }

      const monthlyContribution = parseFloat(config.monthlyContribution) || 0
      const currentAge = parseInt(config.currentAge) || 0
      const payoutAge = parseInt(config.payoutAge) || 0
      const expectedReturn = (parseFloat(config.expectedReturnRate) || 0) / 100

      if (
        monthlyContribution <= 0 ||
        currentAge <= 0 ||
        payoutAge <= currentAge
      ) {
        setLumpSumProjection(null)
        return
      }

      setProjectionLoading(true)
      try {
        const response = await fetch("/api/projection/lump-sum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyContribution,
            expectedReturnRate: expectedReturn,
            currentAge,
            payoutAge,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setLumpSumProjection(data.data)
        } else {
          setLumpSumProjection(null)
        }
      } catch (err) {
        console.error("Failed to fetch lump sum projection:", err)
        setLumpSumProjection(null)
      } finally {
        setProjectionLoading(false)
      }
    }

    // Debounce the fetch to avoid too many requests
    const timeoutId = setTimeout(fetchLumpSumProjection, 500)
    return () => clearTimeout(timeoutId)
  }, [
    config.lumpSum,
    config.payoutAge,
    config.currentAge,
    config.monthlyContribution,
    config.expectedReturnRate,
  ])

  const handleSave = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      // Convert percentage to decimal (e.g., 3.0 -> 0.03)
      const returnRate = expectedReturnRate
        ? parseFloat(expectedReturnRate) / 100
        : undefined
      await onSave(
        asset.id,
        code,
        name,
        currency,
        category,
        sector || undefined,
        returnRate,
      )

      // Save private asset config for RE and POLICY categories
      if (category === "RE" || category === "POLICY") {
        const configPayload: Record<string, unknown> = {
          liquidationPriority: parseInt(config.liquidationPriority) || 100,
        }

        // RE-specific fields
        if (category === "RE") {
          Object.assign(configPayload, {
            monthlyRentalIncome: parseFloat(config.monthlyRentalIncome) || 0,
            rentalCurrency: config.rentalCurrency,
            countryCode: config.countryCode,
            monthlyManagementFee: parseFloat(config.monthlyManagementFee) || 0,
            managementFeePercent:
              (parseFloat(config.managementFeePercent) || 0) / 100,
            monthlyBodyCorporateFee:
              parseFloat(config.monthlyBodyCorporateFee) || 0,
            annualPropertyTax: parseFloat(config.annualPropertyTax) || 0,
            annualInsurance: parseFloat(config.annualInsurance) || 0,
            monthlyOtherExpenses: parseFloat(config.monthlyOtherExpenses) || 0,
            deductIncomeTax: config.deductIncomeTax,
            isPrimaryResidence: config.isPrimaryResidence,
            transactionDayOfMonth: parseInt(config.transactionDayOfMonth) || 1,
            creditAccountId: config.creditAccountId || null,
            autoGenerateTransactions: config.autoGenerateTransactions,
          })
        }

        // Policy-specific fields
        if (category === "POLICY") {
          Object.assign(configPayload, {
            isPension: config.isPension,
            payoutAge: config.payoutAge ? parseInt(config.payoutAge) : null,
            monthlyPayoutAmount: parseFloat(config.monthlyPayoutAmount) || 0,
            monthlyContribution: parseFloat(config.monthlyContribution) || 0,
            lumpSum: config.lumpSum,
            expectedReturnRate: config.expectedReturnRate
              ? parseFloat(config.expectedReturnRate) / 100
              : null,
          })

          // Composite policy support
          if (config.policyType) {
            Object.assign(configPayload, {
              policyType: config.policyType,
              lockedUntilDate: config.lockedUntilDate || null,
              subAccounts: config.subAccounts,
            })
          }
        }

        await fetch(`/api/assets/config/${asset.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configPayload),
        })
      }

      // Show success and auto-close
      setSubmitSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 sm:p-6 z-50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">{t("accounts.edit.title")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        {/* Tabs - only show if RE category */}
        {showIncomeTab && (
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-6">
              <button
                onClick={() => setActiveTab("details")}
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === "details"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t("asset.tab.details", "Details")}
              </button>
              <button
                onClick={() => setActiveTab("income")}
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === "income"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t("asset.tab.income", "Income & Planning")}
              </button>
            </nav>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accounts.code")}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accounts.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accounts.currency")}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
              >
                {currencies.map((ccy) => (
                  <option key={ccy.value} value={ccy.value}>
                    {ccy.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accounts.category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Only show sector for MUTUAL FUND category */}
            {category === "MUTUAL FUND" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("account.sector", "Sector")}
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">
                    {t("account.sector.hint", "Select sector (optional)")}
                  </option>
                  {sectors.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Expected Return Rate - for retirement projections */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("asset.expectedReturn", "Expected Return (%)")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={expectedReturnRate}
                  onChange={(e) => setExpectedReturnRate(e.target.value)}
                  placeholder="3.0"
                  className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-gray-500">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t(
                  "asset.expectedReturn.hint",
                  "Annual return rate for retirement projections (default 3%)",
                )}
              </p>
            </div>
          </div>
        )}

        {/* Income & Planning Tab (RE, POLICY) */}
        {activeTab === "income" && showIncomeTab && (
          <div className="space-y-4">
            {configLoading ? (
              <div className="text-sm text-gray-500">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("loading")}
              </div>
            ) : (
              <>
                {/* POLICY specific fields */}
                {category === "POLICY" && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 mb-4">
                      <i className="fas fa-info-circle mr-2"></i>
                      {t(
                        "asset.config.policy.hint",
                        "Configure your retirement fund for projections.",
                      )}
                    </div>

                    {/* Payout Type */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="lumpSum"
                        checked={config.lumpSum}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            lumpSum: e.target.checked,
                            monthlyPayoutAmount: e.target.checked
                              ? "0"
                              : config.monthlyPayoutAmount,
                          })
                        }
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label
                        htmlFor="lumpSum"
                        className="ml-2 text-sm text-gray-700"
                      >
                        {t(
                          "asset.config.lumpSum",
                          "Lump Sum Payout (vs Monthly Payments)",
                        )}
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Payout Age */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("asset.config.payoutAge", "Payout Age")}
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="50"
                          max="100"
                          value={config.payoutAge}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              payoutAge: e.target.value,
                            })
                          }
                          placeholder="65"
                          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t(
                            "asset.config.payoutAge.hint",
                            "Age when payouts begin",
                          )}
                        </p>
                      </div>

                      {/* Monthly Payout (only for non-lump sum) */}
                      {!config.lumpSum && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t(
                              "asset.config.monthlyPayout",
                              "Monthly Payout Amount",
                            )}
                          </label>
                          <MathInput
                            value={config.monthlyPayoutAmount}
                            onChange={(val) =>
                              setConfig({
                                ...config,
                                monthlyPayoutAmount: String(val),
                              })
                            }
                            placeholder="e.g. 2k, 500*12"
                            className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t(
                              "asset.config.monthlyPayout.hint",
                              "Monthly income after payout age",
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Monthly Contribution */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t(
                            "asset.config.monthlyContribution",
                            "Monthly Contribution",
                          )}
                        </label>
                        <MathInput
                          value={config.monthlyContribution}
                          onChange={(val) =>
                            setConfig({
                              ...config,
                              monthlyContribution: String(val),
                            })
                          }
                          placeholder="e.g. 500, 1k"
                          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t(
                            "asset.config.monthlyContribution.hint",
                            "Your regular contributions",
                          )}
                        </p>
                      </div>

                      {/* Expected Return Rate */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t(
                            "asset.config.expectedReturn",
                            "Expected Return (%)",
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="20"
                            value={config.expectedReturnRate}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                expectedReturnRate: e.target.value,
                              })
                            }
                            placeholder="3.0"
                            className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500 pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-gray-500">
                            %
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {t(
                            "asset.config.expectedReturn.hint",
                            "Annual growth rate",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Projection for lump sum */}
                    {config.lumpSum && config.payoutAge && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-green-700 font-medium">
                            <i className="fas fa-calculator mr-2"></i>
                            {t(
                              "asset.config.lumpSum.projection",
                              "Projected Payout at Independence",
                            )}
                          </label>
                          {planData && (
                            <span className="text-green-600 text-xs">
                              Based on your plan (age {planData.currentAge})
                            </span>
                          )}
                        </div>
                        {!planData ? (
                          <p className="text-green-600 text-xs">
                            <i className="fas fa-info-circle mr-1"></i>
                            {t(
                              "asset.config.lumpSum.noPlan",
                              "Create an Independence Plan to see projected payout based on your age.",
                            )}
                          </p>
                        ) : projectionLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <i className="fas fa-spinner fa-spin text-green-600 mr-2"></i>
                            <span className="text-green-600 text-sm">
                              {t("loading", "Loading...")}
                            </span>
                          </div>
                        ) : lumpSumProjection ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-green-700">
                                {t("asset.config.atAge", "At age {{age}}:", {
                                  age: config.payoutAge,
                                })}
                              </span>
                              <span className="text-green-800 font-bold text-lg">
                                $
                                {lumpSumProjection.projectedPayout.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  },
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-green-600 space-y-1">
                              <div className="flex justify-between">
                                <span>
                                  {t(
                                    "asset.config.yearsToMaturity",
                                    "Years to maturity:",
                                  )}
                                </span>
                                <span>{lumpSumProjection.yearsToMaturity}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>
                                  {t(
                                    "asset.config.totalContributions",
                                    "Total contributions:",
                                  )}
                                </span>
                                <span>
                                  $
                                  {lumpSumProjection.totalContributions.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    },
                                  )}
                                </span>
                              </div>
                              {lumpSumProjection.interestEarned > 0 && (
                                <div className="flex justify-between">
                                  <span>
                                    {t(
                                      "asset.config.interestEarned",
                                      "Interest earned:",
                                    )}
                                  </span>
                                  <span>
                                    $
                                    {lumpSumProjection.interestEarned.toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                      },
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-green-600 text-xs">
                            {parseFloat(config.monthlyContribution || "0") <= 0
                              ? t(
                                  "asset.config.lumpSum.enterContribution",
                                  "Enter monthly contribution to see projected payout.",
                                )
                              : t(
                                  "asset.config.lumpSum.calculating",
                                  "Calculating projection...",
                                )}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Composite Policy Editor */}
                {category === "POLICY" && (
                  <div className="border-t border-gray-200 pt-4">
                    <CompositeAssetEditor
                      policyType={config.policyType}
                      lockedUntilDate={config.lockedUntilDate}
                      subAccounts={config.subAccounts}
                      onPolicyTypeChange={(val) =>
                        setConfig({ ...config, policyType: val })
                      }
                      onLockedUntilDateChange={(val) =>
                        setConfig({ ...config, lockedUntilDate: val })
                      }
                      onSubAccountsChange={(accounts) =>
                        setConfig({ ...config, subAccounts: accounts })
                      }
                    />
                  </div>
                )}

                {/* RE-specific fields */}
                {category === "RE" && (
                  <>
                    {/* Primary Residence Toggle */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPrimaryResidence"
                        checked={config.isPrimaryResidence}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            isPrimaryResidence: e.target.checked,
                            monthlyRentalIncome: e.target.checked
                              ? "0"
                              : config.monthlyRentalIncome,
                          })
                        }
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label
                        htmlFor="isPrimaryResidence"
                        className="ml-2 text-sm text-gray-700"
                      >
                        {t(
                          "asset.config.primaryResidence",
                          "Primary Residence",
                        )}
                      </label>
                    </div>

                    {/* Rental Income & Management Fees (hidden for primary residence) */}
                    {!config.isPrimaryResidence && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t(
                                "asset.config.monthlyRental",
                                "Monthly Rental",
                              )}
                            </label>
                            <MathInput
                              value={config.monthlyRentalIncome}
                              onChange={(val) =>
                                setConfig({
                                  ...config,
                                  monthlyRentalIncome: String(val),
                                })
                              }
                              placeholder="e.g. 2k, 500*4"
                              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t("asset.config.rentalCurrency", "Currency")}
                            </label>
                            <select
                              value={config.rentalCurrency}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  rentalCurrency: e.target.value,
                                })
                              }
                              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              {currencies.map((ccy) => (
                                <option key={ccy.value} value={ccy.value}>
                                  {ccy.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t("asset.config.countryCode", "Tax Country")}
                            </label>
                            <select
                              value={config.countryCode}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  countryCode: e.target.value,
                                })
                              }
                              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              {COUNTRY_OPTIONS.map((country) => (
                                <option key={country.code} value={country.code}>
                                  {country.code} - {country.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Management Fee */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t(
                                "asset.config.mgmtFeeFixed",
                                "Mgmt Fee (Fixed)",
                              )}
                            </label>
                            <MathInput
                              value={config.monthlyManagementFee}
                              onChange={(val) =>
                                setConfig({
                                  ...config,
                                  monthlyManagementFee: String(val),
                                })
                              }
                              placeholder="e.g. 200, 2.5k/12"
                              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t("asset.config.mgmtFeePercent", "Mgmt Fee (%)")}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={config.managementFeePercent}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  managementFeePercent: e.target.value,
                                })
                              }
                              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Property Expenses */}
                        <div className="border-t pt-4 mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">
                            {t("asset.config.expenses", "Property Expenses")}
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t(
                                  "asset.config.bodyCorporate",
                                  "Body Corp (Monthly)",
                                )}
                              </label>
                              <MathInput
                                value={config.monthlyBodyCorporateFee}
                                onChange={(val) =>
                                  setConfig({
                                    ...config,
                                    monthlyBodyCorporateFee: String(val),
                                  })
                                }
                                placeholder="e.g. 300, 3.6k/12"
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t(
                                  "asset.config.propertyTax",
                                  "Property Tax (Annual)",
                                )}
                              </label>
                              <MathInput
                                value={config.annualPropertyTax}
                                onChange={(val) =>
                                  setConfig({
                                    ...config,
                                    annualPropertyTax: String(val),
                                  })
                                }
                                placeholder="e.g. 5k, 400*12"
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t(
                                  "asset.config.insurance",
                                  "Insurance (Annual)",
                                )}
                              </label>
                              <MathInput
                                value={config.annualInsurance}
                                onChange={(val) =>
                                  setConfig({
                                    ...config,
                                    annualInsurance: String(val),
                                  })
                                }
                                placeholder="e.g. 2k, 180*12"
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t(
                                  "asset.config.otherExpenses",
                                  "Other (Monthly)",
                                )}
                              </label>
                              <MathInput
                                value={config.monthlyOtherExpenses}
                                onChange={(val) =>
                                  setConfig({
                                    ...config,
                                    monthlyOtherExpenses: String(val),
                                  })
                                }
                                placeholder="e.g. 100, 50+75"
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Income Tax Toggle */}
                        <div className="flex items-center mt-4">
                          <input
                            type="checkbox"
                            id="deductIncomeTax"
                            checked={config.deductIncomeTax}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                deductIncomeTax: e.target.checked,
                              })
                            }
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label
                            htmlFor="deductIncomeTax"
                            className="ml-2 text-sm text-gray-700"
                          >
                            {t(
                              "asset.config.deductIncomeTax",
                              "Deduct Income Tax",
                            )}
                            {countryTaxRates[config.countryCode] ? (
                              <span className="text-gray-500 ml-1">
                                (
                                {(
                                  countryTaxRates[config.countryCode] * 100
                                ).toFixed(0)}
                                % for {config.countryCode})
                              </span>
                            ) : (
                              <span className="text-orange-500 ml-1">
                                (no rate configured for {config.countryCode})
                              </span>
                            )}
                          </label>
                        </div>

                        {/* Net Income Display */}
                        {(() => {
                          const rental =
                            parseFloat(config.monthlyRentalIncome) || 0
                          const fixedFee =
                            parseFloat(config.monthlyManagementFee) || 0
                          const percentFee =
                            rental *
                            ((parseFloat(config.managementFeePercent) || 0) /
                              100)
                          const effectiveMgmtFee = Math.max(
                            fixedFee,
                            percentFee,
                          )
                          const bodyCorp =
                            parseFloat(config.monthlyBodyCorporateFee) || 0
                          const monthlyPropertyTax =
                            (parseFloat(config.annualPropertyTax) || 0) / 12
                          const monthlyInsurance =
                            (parseFloat(config.annualInsurance) || 0) / 12
                          const otherExpenses =
                            parseFloat(config.monthlyOtherExpenses) || 0
                          const totalExpenses =
                            effectiveMgmtFee +
                            bodyCorp +
                            monthlyPropertyTax +
                            monthlyInsurance +
                            otherExpenses
                          // Taxable income (cannot be negative)
                          const taxableIncome = Math.max(
                            0,
                            rental - totalExpenses,
                          )
                          // Income tax (only if deductIncomeTax is checked, uses country-based rate)
                          const taxRate =
                            countryTaxRates[config.countryCode] || 0
                          const incomeTax = config.deductIncomeTax
                            ? taxableIncome * taxRate
                            : 0
                          // Net after tax
                          const netIncome = taxableIncome - incomeTax
                          return (
                            <div className="bg-gray-50 rounded-md p-3 text-sm mt-4">
                              <div className="flex justify-between text-gray-600">
                                <span>
                                  {t("asset.config.netIncome", "Net Monthly")}:
                                </span>
                                <span
                                  className={`font-medium ${netIncome >= 0 ? "text-green-700" : "text-red-600"}`}
                                >
                                  {config.rentalCurrency}{" "}
                                  {netIncome.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              {totalExpenses > 0 && (
                                <div className="flex justify-between text-gray-500 text-xs mt-1">
                                  <span>
                                    {t(
                                      "asset.config.totalExpenses",
                                      "Expenses",
                                    )}
                                    :{" "}
                                    {totalExpenses.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              )}
                              {config.deductIncomeTax && incomeTax > 0 && (
                                <div className="flex justify-between text-gray-500 text-xs mt-1">
                                  <span>
                                    {t("asset.config.incomeTax", "Income Tax")}{" "}
                                    ({config.countryCode}{" "}
                                    {(taxRate * 100).toFixed(0)}%):{" "}
                                    {incomeTax.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </>
                )}

                {/* Liquidation Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t(
                      "asset.config.liquidationPriority",
                      "Liquidation Priority",
                    )}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={config.liquidationPriority}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        liquidationPriority: e.target.value,
                      })
                    }
                    className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "asset.config.liquidationPriority.hint",
                      "Lower number = sold first during retirement",
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mt-4">
            {error}
          </div>
        )}

        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 text-center">
            <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
            <p className="text-green-700 font-medium">{t("saved")}</p>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          {!submitSuccess && (
            <button
              type="button"
              className={`px-4 py-2 rounded transition-colors text-white ${
                isSubmitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-600"
              }`}
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {t("saving")}
                </span>
              ) : (
                t("save")
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface DeleteAccountDialogProps {
  asset: Asset
  onClose: () => void
  onConfirm: (assetId: string) => Promise<void>
}

const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  asset,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation("common")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm(asset.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 sm:p-6 z-50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold text-red-600">
            {t("accounts.delete.title")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          <p className="text-gray-700">{t("accounts.delete.confirm")}</p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="font-semibold text-lg">{asset.name}</div>
            <div className="text-sm text-gray-600">
              {stripOwnerPrefix(asset.code)} (
              {asset.priceSymbol || asset.market?.currency?.code})
            </div>
          </div>

          <p className="text-sm text-gray-500">
            {t("accounts.delete.warning")}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded transition-colors text-white ${
              isDeleting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600"
            }`}
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("deleting")}
              </span>
            ) : (
              t("delete")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SetPriceDialogProps {
  asset: Asset
  onClose: () => void
  onSave: (assetId: string, date: string, price: string) => Promise<void>
}

const SetPriceDialog: React.FC<SetPriceDialogProps> = ({
  asset,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation("common")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [price, setPrice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    if (!price || parseFloat(price) <= 0) {
      setError("Please enter a valid price greater than 0")
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(asset.id, date, price)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set price")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">{t("price.set.title")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="font-semibold text-lg">{asset.name}</div>
            <div className="text-sm text-gray-600">
              {stripOwnerPrefix(asset.code)} -{" "}
              {t(`category.${asset.assetCategory?.id}`) ||
                asset.assetCategory?.name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("price.date")}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("price.value")} (
              {asset.priceSymbol || asset.market?.currency?.code || "USD"})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("price.value.hint")}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded transition-colors text-white ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("saving")}
              </span>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ImportDialogProps {
  onClose: () => void
  onComplete: () => Promise<void>
}

const ImportDialog: React.FC<ImportDialogProps> = ({ onClose, onComplete }) => {
  const { t } = useTranslation("common")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ count: number } | null>(
    null,
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setImportResult(null)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!selectedFile) {
      setError("Please select a file")
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const csvContent = await selectedFile.text()
      const response = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Import failed")
        return
      }

      const result = await response.json()
      const count = result.data ? Object.keys(result.data).length : 0
      setImportResult({ count })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const handleDone = async (): Promise<void> => {
    await onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 sm:p-6 z-50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">
            {t("accounts.import.title")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          {!importResult ? (
            <>
              <p className="text-sm text-gray-600">
                {t("accounts.import.hint")}
              </p>

              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <i className="fas fa-file-csv text-4xl text-gray-400 mb-2"></i>
                {selectedFile ? (
                  <p className="text-sm text-gray-700 font-medium">
                    {selectedFile.name}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {t("accounts.import.select")}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
              <p className="text-green-700 font-medium">
                {t("accounts.import.success", { count: importResult.count })}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          {!importResult ? (
            <>
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded transition-colors text-white ${
                  isImporting || !selectedFile
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
                onClick={handleImport}
                disabled={isImporting || !selectedFile}
              >
                {isImporting ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("accounts.importing")}
                  </span>
                ) : (
                  t("accounts.import")
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              onClick={handleDone}
            >
              {t("done")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default withPageAuthRequired(AccountsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
