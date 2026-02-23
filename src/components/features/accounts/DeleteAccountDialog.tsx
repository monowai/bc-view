import React, { useState } from "react"
import { Asset } from "types/beancounter"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"

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
    <Dialog
      title={<span className="text-red-600">{"Delete Asset"}</span>}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleConfirm}
            label={"Delete"}
            loadingLabel={"Deleting..."}
            isSubmitting={isDeleting}
            variant="red"
          />
        </>
      }
    >
      <p className="text-gray-700">
        {"Are you sure you want to delete this asset?"}
      </p>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} ({getAssetCurrency(asset)})
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {
          "This action cannot be undone. Any transactions associated with this asset will remain but reference a deleted asset."
        }
      </p>

      {error && <Alert>{error}</Alert>}
    </Dialog>
  )
}

export default DeleteAccountDialog
