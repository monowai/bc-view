import React, { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import useSwr, { mutate as globalMutate } from "swr"
import { Asset, AssetCategory } from "types/beancounter"
import { ccyKey, categoriesKey, simpleFetcher } from "@utils/api/fetchHelper"
import {
  USER_ASSET_CATEGORIES,
  type CategoryOption,
  type SectorInfo,
  type SectorOption,
} from "@components/features/accounts/accountTypes"
import { currencyOptions } from "@lib/currency"
import { usePermissions } from "@hooks/usePermissions"
import { assetsKey, updateAsset } from "@utils/api/client/assets"
import { sectorsKey, setAssetSector } from "@utils/api/client/classifications"

const EditAccountDialog = dynamic(
  () => import("@components/features/accounts/EditAccountDialog"),
  { ssr: false },
)
const AdminAssetEditDialog = dynamic(
  () => import("@components/features/admin/AdminAssetEditDialog"),
  { ssr: false },
)

interface UseAssetEditorReturn {
  handleEditAsset: (asset: Asset) => void
  /** Render once; holds whichever edit dialog is open. */
  assetEditDialogs: React.ReactElement
}

/**
 * Edit-asset flow for a holdings view. Asset metadata is global, not
 * portfolio-scoped, so it works the same on one portfolio and in the aggregate.
 * `refreshHoldings` reloads the calling view after a save.
 */
export function useAssetEditor(
  refreshHoldings: () => Promise<unknown>,
): UseAssetEditorReturn {
  const { admin: isAdmin } = usePermissions()
  const [editAsset, setEditAsset] = useState<Asset | undefined>(undefined)
  const [adminEditAsset, setAdminEditAsset] = useState<Asset | undefined>(
    undefined,
  )

  // Edit-asset dialog needs the same reference data as the accounts page.
  // Lazy-fetch — only after the user opens the dialog. Holdings is a hot
  // path; editing is incidental, so we skip the three round-trips on the
  // common case.
  const { data: ccyData } = useSwr(
    editAsset ? ccyKey : null,
    simpleFetcher(ccyKey),
  )
  const { data: categoriesData } = useSwr(
    editAsset ? categoriesKey : null,
    simpleFetcher(categoriesKey),
  )
  const { data: sectorsData } = useSwr<{ data: SectorInfo[] }>(
    editAsset ? sectorsKey : null,
    simpleFetcher(sectorsKey),
  )
  const ccyOptions = ccyData?.data ? currencyOptions(ccyData.data) : []
  const categoryOptions: CategoryOption[] = categoriesData?.data
    ? categoriesData.data
        .filter((cat: AssetCategory) => USER_ASSET_CATEGORIES.includes(cat.id))
        .map((cat: AssetCategory) => ({ value: cat.id, label: cat.name }))
    : []
  const sectorOptions: SectorOption[] = sectorsData?.data
    ? sectorsData.data.map((sector: SectorInfo) => ({
        value: sector.name,
        label: sector.name,
      }))
    : []

  const handleEditAsset = useCallback(
    (asset: Asset) => {
      // PRIVATE assets are user-owned → use the existing owner-scoped dialog.
      // Non-PRIVATE assets are public; only admins can edit those, and they
      // go through the slim admin dialog (category / name / sector only).
      if (asset.market?.code === "PRIVATE") {
        setEditAsset(asset)
      } else if (isAdmin) {
        setAdminEditAsset(asset)
      }
    },
    [isAdmin],
  )

  const handleEditAssetClose = useCallback(() => {
    setEditAsset(undefined)
  }, [])

  const handleEditAssetSave = useCallback(
    async (
      assetId: string,
      code: string,
      name: string,
      currency: string,
      category: string,
      sector?: string,
      expectedReturnRate?: number,
    ): Promise<void> => {
      const response = await updateAsset(assetId, {
        market: "PRIVATE",
        code,
        name,
        currency,
        category,
        expectedReturnRate,
      })
      if (!response.ok) {
        throw new Error("Failed to update asset")
      }
      if (sector) {
        try {
          await setAssetSector(assetId, sector)
        } catch (err) {
          console.error("Failed to update sector classification:", err)
        }
      }
      // Refresh holdings (this page) and the assets list (accounts page cache)
      await refreshHoldings()
      await globalMutate(assetsKey)
      setEditAsset(undefined)
    },
    [refreshHoldings],
  )

  const assetEditDialogs = (
    <>
      {editAsset && (
        <EditAccountDialog
          asset={editAsset}
          currencies={ccyOptions}
          categories={categoryOptions}
          sectors={sectorOptions}
          onClose={handleEditAssetClose}
          onSave={handleEditAssetSave}
        />
      )}
      {adminEditAsset && (
        <AdminAssetEditDialog
          asset={adminEditAsset}
          onClose={() => setAdminEditAsset(undefined)}
          onSaved={async () => {
            setAdminEditAsset(undefined)
            await refreshHoldings()
            await globalMutate(assetsKey)
          }}
        />
      )}
    </>
  )

  return { handleEditAsset, assetEditDialogs }
}
