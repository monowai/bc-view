import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { Asset } from "types/beancounter"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"

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
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 sm:p-6 z-50 max-h-[90vh] overflow-y-auto"
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
              {stripOwnerPrefix(asset.code)} ({getAssetCurrency(asset)})
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

export default DeleteAccountDialog
