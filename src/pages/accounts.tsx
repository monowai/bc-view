import React, { useState, useCallback, useRef, useMemo } from "react"
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

// Categories that can be used for user-owned custom assets
const USER_ASSET_CATEGORIES = [
  "ACCOUNT",
  "TRADE",
  "RE",
  "MUTUAL FUND",
  "POLICY",
]

interface CategoryOption {
  value: string
  label: string
}

// Extract display code without owner prefix (e.g., "userId.WISE" -> "WISE")
function getDisplayCode(code: string): string {
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
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

interface AccountActionsProps {
  onImportClick: () => void
}

const AccountActions = ({
  onImportClick,
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
        onClick={() => router.push("/assets/account")}
      >
        {t("account.create")}
      </button>
    </div>
  )
}

function AccountsPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
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

  const [editData, setEditData] = useState<EditAccountData | undefined>(
    undefined,
  )
  const [deleteData, setDeleteData] = useState<DeleteAccountData | undefined>(
    undefined,
  )
  const [setPriceData, setSetPriceData] = useState<SetPriceData | undefined>(
    undefined,
  )
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
        }),
      })
      if (!response.ok) {
        const error = new Error("Failed to update asset")
        console.error("Error updating asset:", error)
        throw error
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
    // Refresh the assets list
    await mutate("/api/assets")
    setDeleteData(undefined)
  }, [])

  const handleSetPrice = useCallback((asset: Asset) => {
    setSetPriceData({ asset })
  }, [])

  const handleSetPriceClose = useCallback(() => {
    setSetPriceData(undefined)
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

  if (!ready || isLoading || ccyLoading || categoriesLoading) {
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

  const accounts = accountsData?.data
    ? Object.values(accountsData.data as Record<string, Asset>)
    : []

  const ccyOptions = ccyData?.data ? currencyOptions(ccyData.data) : []

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">{t("accounts.title")}</h1>
        <AccountActions onImportClick={handleImportClick} />
      </div>

      {accounts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          {t("accounts.empty")}
        </div>
      ) : (
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
                    {getDisplayCode(account.code)}
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
                    {account.priceSymbol ||
                      account.market?.currency?.code ||
                      "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {account.assetCategory?.id !== "ACCOUNT" && (
                      <button
                        onClick={() => handleSetPrice(account)}
                        className="text-green-600 hover:text-green-900 mr-4"
                      >
                        <i className="fas fa-dollar-sign mr-1"></i>
                        {t("price.set")}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(account)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <i className="fas fa-edit mr-1"></i>
                      {t("edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
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
      )}

      {/* Edit Dialog */}
      {editData && (
        <EditAccountDialog
          asset={editData.asset}
          currencies={ccyOptions}
          categories={categoryOptions}
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
  onClose: () => void
  onSave: (
    assetId: string,
    code: string,
    name: string,
    currency: string,
    category: string,
  ) => Promise<void>
}

const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  asset,
  currencies,
  categories,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation("common")
  const [code, setCode] = useState(getDisplayCode(asset.code))
  const [name, setName] = useState(asset.name || "")
  const [currency, setCurrency] = useState(
    asset.priceSymbol || asset.market?.currency?.code || "USD",
  )
  const [category, setCategory] = useState(asset.assetCategory?.id || "ACCOUNT")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(asset.id, code, name, currency, category)
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
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
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
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
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
              {getDisplayCode(asset.code)} (
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
              {getDisplayCode(asset.code)} -{" "}
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
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
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
