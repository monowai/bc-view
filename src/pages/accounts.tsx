import React, { useState, useCallback, useMemo } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useTranslation } from "next-i18next"
import useSwr, { mutate } from "swr"
import { simpleFetcher, ccyKey, categoriesKey } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { Asset, AssetCategory } from "types/beancounter"
import { currencyOptions } from "@lib/currency"
import SetAccountBalancesDialog from "@components/features/accounts/SetAccountBalancesDialog"
import SetBalanceDialog from "@components/features/holdings/SetBalanceDialog"
import AccountActions from "@components/features/accounts/AccountActions"
import OverviewTab from "@components/features/accounts/OverviewTab"
import AssetTable from "@components/features/accounts/AssetTable"
import EditAccountDialog from "@components/features/accounts/EditAccountDialog"
import DeleteAccountDialog from "@components/features/accounts/DeleteAccountDialog"
import SetPriceDialog from "@components/features/accounts/SetPriceDialog"
import ImportDialog from "@components/features/accounts/ImportDialog"
import {
  SectorInfo,
  SectorOption,
  CategoryOption,
  EditAccountData,
  DeleteAccountData,
  SetPriceData,
  SetBalancesData,
  SetBalanceData,
  TabType,
  USER_ASSET_CATEGORIES,
} from "@components/features/accounts/accountTypes"

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
      const errorData = await response.json().catch(() => ({}))
      const message =
        (errorData as Record<string, string>).error || "Failed to delete asset"
      const error = new Error(message)
      console.error("Error deleting asset:", message)
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

export default withPageAuthRequired(AccountsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common", "wealth"])),
  },
})
