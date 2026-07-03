import React, { useState } from "react"
import useSwr from "swr"
import Dialog from "@components/ui/Dialog"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { Asset, AssetCategory } from "types/beancounter"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

interface SectorInfo {
  name: string
}

interface AdminAssetEditDialogProps {
  asset: Asset
  onClose: () => void
  onSaved: () => void
}

// Admin-only escalation of the per-row Edit Asset action. Lets an admin
// re-classify ANY asset (not just user-owned PRIVATE ones) by category, name
// and sector. Currency is intentionally NOT editable — changing currency on a
// public asset silently re-denominates every user's holdings. See
// svc-data AssetController#updateAnyAsset.
const AdminAssetEditDialog: React.FC<AdminAssetEditDialogProps> = ({
  asset,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(asset.name || "")
  const [category, setCategory] = useState(asset.assetCategory?.id || "")
  const [sector, setSector] = useState(asset.sector || "")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({ fallbackError: "Update failed" })

  const { data: categoriesData } = useSwr<{ data: AssetCategory[] }>(
    "/api/categories",
    simpleFetcher("/api/categories"),
  )
  const { data: sectorsData } = useSwr<{ data: SectorInfo[] }>(
    "/api/classifications/sectors",
    simpleFetcher("/api/classifications/sectors"),
  )

  // Re-initialise form fields when the asset prop changes. Render-phase reset
  // (React's "store previous value" pattern) instead of an effect, to avoid
  // cascading renders.
  const [prevAsset, setPrevAsset] = useState(asset)
  if (asset !== prevAsset) {
    setPrevAsset(asset)
    setName(asset.name || "")
    setCategory(asset.assetCategory?.id || "")
    setSector(asset.sector || "")
  }

  const handleSave = async (): Promise<void> => {
    if (!category) {
      setError("Category is required")
      return
    }
    await handleSubmit(async () => {
      const res = await fetch(`/api/assets/admin/${asset.id}`, {
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
      if (sector && sector !== (asset.sector || "")) {
        const sectorRes = await fetch(`/api/classifications/${asset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector }),
        })
        if (!sectorRes.ok) {
          throw new Error(`Sector update failed (${sectorRes.status})`)
        }
      }
      onSaved()
    })
  }

  const categories = categoriesData?.data ?? []
  const sectors = sectorsData?.data ?? []

  return (
    <Dialog
      title={`Admin: edit ${asset.code}`}
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label="Save"
            loadingLabel="Saving…"
            isSubmitting={isSubmitting}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <div className="text-sm text-slate-500">
        Market <span className="font-mono">{asset.market.code}</span> · Currency{" "}
        <span className="font-mono">
          {asset.accountingType?.currency?.code ||
            asset.market.currency.code ||
            "?"}
        </span>{" "}
        (read-only)
      </div>
      <label className="block text-sm">
        <span className="text-slate-700">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 bg-white"
        >
          <option value="">— select —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Sector</span>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 bg-white"
        >
          <option value="">— unset —</option>
          {sectors.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </Dialog>
  )
}

export default AdminAssetEditDialog
