import React, { useState, useRef } from "react"
import { useTranslation } from "next-i18next"

interface ImportDialogProps {
  onClose: () => void
  onComplete: () => Promise<void>
}

const ImportDialog: React.FC<ImportDialogProps> = ({ onClose, onComplete }) => {
  const { t } = useTranslation(["common", "wealth"])
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
      setError(t("wealth:error.selectFile"))
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
        setError(errorData.error || t("wealth:error.importFailed"))
        return
      }

      const result = await response.json()
      const count = result.data ? Object.keys(result.data).length : 0
      setImportResult({ count })
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wealth:error.importFailed"))
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
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 sm:p-6 z-50 max-h-[90vh] overflow-y-auto"
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

export default ImportDialog
