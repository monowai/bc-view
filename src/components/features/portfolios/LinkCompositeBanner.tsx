import React, { useState } from "react"
import { useStandaloneCompositeAssets } from "@hooks/useStandaloneCompositeAssets"
import LinkCompositeDialog from "./LinkCompositeDialog"

/**
 * Prompts the user to link a standalone composite-policy asset (CPF / ILP
 * / generic pension) to a portfolio. The asset's balance lives in
 * svc-data's PrivateAssetConfig today; linking emits a BALANCE trn with
 * sub-accounts so svc-position holdings reflect the value and the asset
 * appears under the user's portfolio rather than as a hidden side-bucket.
 *
 * Server-side rollup (svc-retire PlanAllocationService) still surfaces
 * the value in plan totals before the user links — this banner is purely
 * a visibility / UX nudge.
 */
export default function LinkCompositeBanner(): React.ReactElement | null {
  const { standalone, isLoading } = useStandaloneCompositeAssets()
  const [targetId, setTargetId] = useState<string | null>(null)

  if (isLoading || standalone.length === 0) return null

  const first = standalone[0]
  const more = standalone.length - 1

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-amber-900">
            {first.assetName}{" "}
            <span className="font-normal">
              ({first.currency} {Math.round(first.total).toLocaleString()})
            </span>{" "}
            isn&apos;t in a portfolio yet.
          </p>
          <p className="text-amber-800">
            Link it so the balance shows up in your holdings and counts against
            your wealth without a fresh entry every month.
          </p>
          {more > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              +{more} more standalone composite asset
              {more === 1 ? "" : "s"} to link.
            </p>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-white hover:bg-amber-700"
          onClick={() => setTargetId(first.assetId)}
        >
          Link to portfolio
        </button>
      </div>
      {targetId && (
        <LinkCompositeDialog
          config={standalone.find((c) => c.assetId === targetId)!}
          onClose={() => setTargetId(null)}
        />
      )}
    </div>
  )
}
