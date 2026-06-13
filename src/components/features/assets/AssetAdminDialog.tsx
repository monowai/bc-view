import React, { useState } from "react"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import AssetClassifyPanel from "@components/features/assets/AssetClassifyPanel"
import { Asset, AssetCategory } from "types/beancounter"

interface AssetAdminDialogProps {
  assetId: string
  onClose: () => void
  // Notify the parent (e.g. lookup page) so it can revalidate its own view
  // after an admin edit changes the asset's name/category.
  onUpdated?: () => void
}

type Tab = "details" | "classify"

// Admin-only popup launched from the Asset Lookup screen. Lets an admin edit an
// asset's display name and category (Details tab) and manage its sector
// classification (Classify tab). Market and currency are read-only on purpose —
// changing them re-keys the asset / re-denominates every holder. See svc-data
// AssetController#updateAnyAsset.
const AssetAdminDialog: React.FC<AssetAdminDialogProps> = ({
  assetId,
  onClose,
  onUpdated,
}) => {
  const assetKey = `/api/assets/${assetId}`
  const {
    data: assetResp,
    isLoading,
    mutate,
  } = useSWR<{ data: Asset }>(assetKey, simpleFetcher(assetKey))
  const asset = assetResp?.data

  const { data: catResp } = useSWR<{ data: AssetCategory[] }>(
    "/api/categories",
    simpleFetcher("/api/categories"),
  )
  const categories = catResp?.data ?? []

  const [tab, setTab] = useState<Tab>("details")
  const [name, setName] = useState(asset?.name || "")
  const [category, setCategory] = useState(asset?.assetCategory?.id || "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Initialise the editable form fields when the loaded asset changes.
  const [prevAsset, setPrevAsset] = useState(asset)
  if (asset !== prevAsset) {
    setPrevAsset(asset)
    if (asset) {
      setName(asset.name || "")
      setCategory(asset.assetCategory?.id || "")
      setSaved(false)
      setError(null)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!asset) return
    if (!category) {
      setError("Category is required")
      return
    }
    setIsSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/assets/admin/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: asset.market.code,
          code: asset.code,
          name,
          category,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `Update failed (${res.status})`)
      }
      setSaved(true)
      await mutate()
      onUpdated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setIsSaving(false)
    }
  }

  const currencyCode =
    asset?.accountingType?.currency?.code || asset?.market.currency?.code || "?"

  const tabClass = (active: boolean): string =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-blue-500 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`

  const title = asset ? `Asset Admin · ${asset.code}` : "Asset Admin"

  return (
    <Dialog title={title} onClose={onClose} maxWidth="2xl" scrollable>
      {/* Tabs */}
      <div role="tablist" className="flex border-b border-gray-200 -mt-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "details"}
          onClick={() => setTab("details")}
          className={tabClass(tab === "details")}
        >
          {"Details"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "classify"}
          onClick={() => setTab("classify")}
          className={tabClass(tab === "classify")}
        >
          {"Classify"}
        </button>
      </div>

      {isLoading || !asset ? (
        <div className="p-6 text-center text-gray-500">
          <Spinner className="mr-2" />
          {"Loading asset..."}
        </div>
      ) : tab === "details" ? (
        <div className="space-y-4">
          {/* Read-only market + currency */}
          <div className="text-sm text-gray-500">
            {"Market "}
            <span className="font-mono text-gray-700">{asset.market.code}</span>
            {" · Currency "}
            <span className="font-mono text-gray-700">{currencyCode}</span>
            {" (read-only)"}
          </div>

          <div>
            <label
              htmlFor="asset-admin-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Name"}
            </label>
            <input
              id="asset-admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="asset-admin-category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Category"}
            </label>
            <select
              id="asset-admin-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{"— select —"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {saved && !error && (
            <Alert variant="success">{"Asset updated"}</Alert>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? <Spinner label={"Saving..."} /> : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <AssetClassifyPanel assetId={assetId} assetLabel={asset.code} />
      )}
    </Dialog>
  )
}

export default AssetAdminDialog
