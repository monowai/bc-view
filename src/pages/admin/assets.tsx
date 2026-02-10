import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { Asset, AssetOption, Market } from "types/beancounter"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"
import useSWR from "swr"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import AssetSearch from "@components/features/assets/AssetSearch"
import { getAssetCurrency, getDisplayCode } from "@lib/assets/assetUtils"

export default withPageAuthRequired(function AssetAdmin(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin()

  const { data: marketsData } = useSWR<{ data: Market[] }>(
    marketsKey,
    simpleFetcher(marketsKey),
  )
  const knownMarkets = (marketsData?.data || []).map((m) => m.code)
  const [selectedMarket, setSelectedMarket] = useState<string>("LOCAL")
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [editName, setEditName] = useState("")
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  if (!ready || isAdminLoading) {
    return rootLoader(t("loading"))
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
          <h1 className="text-xl font-semibold text-red-700 mb-2">
            {t("admin.accessDenied.title", "Access Denied")}
          </h1>
          <p className="text-red-600">
            {t(
              "admin.accessDenied.message",
              "You do not have permission to access the admin area.",
            )}
          </p>
          <Link
            href="/admin"
            className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            {t("admin.accessDenied.goBack", "Return to Admin")}
          </Link>
        </div>
      </div>
    )
  }

  const handleAssetSelect = async (
    option: AssetOption | null,
  ): Promise<void> => {
    if (!option) return
    setMessage(null)
    setSelectedAsset(null)

    if (!option.assetId) {
      setMessage({ type: "error", text: "No asset ID available" })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/assets/${option.assetId}`)
      if (!response.ok) {
        setMessage({
          type: "error",
          text: `Failed to load asset: ${response.status}`,
        })
        return
      }
      const data = await response.json()
      const asset: Asset = data.data
      setSelectedAsset(asset)
      setEditName(asset.name || "")
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load asset",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (): Promise<void> => {
    if (!selectedAsset) return
    setIsSaving(true)
    setMessage(null)
    try {
      const newStatus =
        selectedAsset.status === "Inactive" ? "Active" : "Inactive"
      const response = await fetch(`/api/assets/${selectedAsset.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setMessage({
          type: "error",
          text:
            errorData.message || `Failed to update status: ${response.status}`,
        })
        return
      }
      setSelectedAsset({ ...selectedAsset, status: newStatus })
      setMessage({
        type: "success",
        text: `Asset status updated to ${newStatus}`,
      })
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update status",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnrich = async (): Promise<void> => {
    if (!selectedAsset) return
    setIsEnriching(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}/enrich`, {
        method: "POST",
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setMessage({
          type: "error",
          text:
            errorData.message || `Failed to enrich asset: ${response.status}`,
        })
        return
      }
      const data = await response.json()
      if (data.data) {
        setSelectedAsset(data.data)
        setEditName(data.data.name || "")
      }
      setMessage({ type: "success", text: "Asset enriched successfully" })
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to enrich asset",
      })
    } finally {
      setIsEnriching(false)
    }
  }

  const handleSaveName = async (): Promise<void> => {
    if (!selectedAsset || editName === selectedAsset.name) return
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setMessage({
          type: "error",
          text:
            errorData.message || `Failed to update name: ${response.status}`,
        })
        return
      }
      setSelectedAsset({ ...selectedAsset, name: editName })
      setMessage({ type: "success", text: "Asset name updated" })
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update name",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const currency = selectedAsset ? getAssetCurrency(selectedAsset) : ""
  const isActive = selectedAsset?.status !== "Inactive"

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          <i className="fas fa-arrow-left mr-1"></i>
          {t("admin.title", "Administration")}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.assets.title", "Asset Administration")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t(
            "admin.assets.description",
            "Search for any asset and manage its properties.",
          )}
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 mb-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {t("admin.assets.market", "Market")}
          </label>
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm px-2 py-1 border text-sm"
          >
            <option value="LOCAL">
              {t("admin.assets.localSearch", "Local DB")}
            </option>
            {knownMarkets.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <AssetSearch
          market={selectedMarket === "LOCAL" ? undefined : selectedMarket}
          onSelect={(option) => {
            handleAssetSelect(option)
          }}
          placeholder={t(
            "admin.assets.searchPlaceholder",
            "Search by code or name...",
          )}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
          <span className="ml-2 text-gray-600">{t("loading")}</span>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-3 mb-4 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <i
            className={`fas ${message.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}
          ></i>
          {message.text}
        </div>
      )}

      {/* Asset Detail Card */}
      {selectedAsset && !isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {getDisplayCode(selectedAsset)}
                </h2>
                <p className="text-sm text-gray-600">{selectedAsset.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {isActive ? "Active" : "Inactive"}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {selectedAsset.assetCategory?.name ||
                    selectedAsset.assetCategory?.id}
                </span>
              </div>
            </div>
          </div>

          {/* Properties */}
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Market</span>
                <div className="font-medium">
                  {selectedAsset.market?.code} ({selectedAsset.market?.name})
                </div>
              </div>
              <div>
                <span className="text-gray-500">Currency</span>
                <div className="font-medium">{currency || "-"}</div>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <div className="font-medium">
                  {selectedAsset.assetCategory?.name}
                </div>
              </div>
              {selectedAsset.priceSymbol && (
                <div>
                  <span className="text-gray-500">Price Symbol</span>
                  <div className="font-medium">{selectedAsset.priceSymbol}</div>
                </div>
              )}
              {selectedAsset.accountingType && (
                <>
                  <div>
                    <span className="text-gray-500">Accounting Category</span>
                    <div className="font-medium">
                      {selectedAsset.accountingType.category}
                    </div>
                  </div>
                  {selectedAsset.accountingType.settlementDays != null && (
                    <div>
                      <span className="text-gray-500">Settlement Days</span>
                      <div className="font-medium">
                        T+{selectedAsset.accountingType.settlementDays}
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectedAsset.sector && (
                <div>
                  <span className="text-gray-500">Sector</span>
                  <div className="font-medium">{selectedAsset.sector}</div>
                </div>
              )}
              {selectedAsset.industry && (
                <div>
                  <span className="text-gray-500">Industry</span>
                  <div className="font-medium">{selectedAsset.industry}</div>
                </div>
              )}
            </div>

            {/* Edit Name */}
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.assets.editName", "Name")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={
                    isSaving ||
                    editName === selectedAsset.name ||
                    !editName.trim()
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    t("save", "Save")
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isSaving}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                } disabled:opacity-50`}
              >
                {isSaving ? (
                  <i className="fas fa-spinner fa-spin mr-1"></i>
                ) : (
                  <i
                    className={`fas ${isActive ? "fa-ban" : "fa-check-circle"} mr-1`}
                  ></i>
                )}
                {isActive
                  ? t("admin.assets.deactivate", "Deactivate")
                  : t("admin.assets.activate", "Activate")}
              </button>
              <button
                type="button"
                onClick={handleEnrich}
                disabled={isEnriching}
                className="px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {isEnriching ? (
                  <i className="fas fa-spinner fa-spin mr-1"></i>
                ) : (
                  <i className="fas fa-sync-alt mr-1"></i>
                )}
                {t("admin.assets.enrich", "Re-enrich")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
