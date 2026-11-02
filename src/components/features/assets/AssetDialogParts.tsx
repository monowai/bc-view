import React from "react"
import { Asset } from "types/beancounter"
import DateInput from "@components/ui/DateInput"
import Dialog from "@components/ui/Dialog"

const CATEGORY_LABELS: Record<string, string> = {
  PENSION: "Policies",
  ACCOUNT: "Bank Account",
  TRADE: "Trade Account",
  RE: "Real Estate",
  "MUTUAL FUND": "Mutual Fund",
  POLICY: "Policies",
}

export const ASSET_DIALOG_INPUT_CLASS =
  "w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"

export function AssetIdentityCard({
  asset,
  categoryFallback,
}: {
  asset: Asset
  /** Shown when the asset has no category; omit to show nothing. */
  categoryFallback?: string
}): React.ReactElement {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="font-semibold text-lg">{asset.name}</div>
      <div className="text-sm text-gray-600">
        {asset.displayCode} -{" "}
        {CATEGORY_LABELS[asset.assetCategory?.id || ""] ||
          asset.assetCategory?.name ||
          categoryFallback}
      </div>
    </div>
  )
}

export function AssetDateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <DateInput
        value={value}
        onChange={onChange}
        className={ASSET_DIALOG_INPUT_CLASS}
      />
    </div>
  )
}

export function AssetSaveFooter({
  onClose,
  onSave,
  isSubmitting,
  disabled,
}: {
  onClose: () => void
  onSave: () => void
  isSubmitting: boolean
  disabled?: boolean
}): React.ReactElement {
  return (
    <>
      <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
      <Dialog.SubmitButton
        onClick={onSave}
        label={"Save"}
        loadingLabel={"Saving..."}
        isSubmitting={isSubmitting}
        disabled={disabled}
      />
    </>
  )
}
