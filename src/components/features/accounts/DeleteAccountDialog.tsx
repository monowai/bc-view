import React, { useState } from "react"
import { useTranslation } from "next-i18next"
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
    <Dialog
      title={<span className="text-red-600">{t("accounts.delete.title")}</span>}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleConfirm}
            label={t("delete")}
            loadingLabel={t("deleting")}
            isSubmitting={isDeleting}
            variant="red"
          />
        </>
      }
    >
      <p className="text-gray-700">{t("accounts.delete.confirm")}</p>

      <Alert variant="error" className="p-4">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} ({getAssetCurrency(asset)})
        </div>
      </Alert>

      <p className="text-sm text-gray-500">{t("accounts.delete.warning")}</p>

      {error && <Alert>{error}</Alert>}
    </Dialog>
  )
}

export default DeleteAccountDialog
