import React, { useState, useRef } from "react"
import { useTranslation } from "next-i18next"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"

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
      setError(
        err instanceof Error ? err.message : t("wealth:error.importFailed"),
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleDone = async (): Promise<void> => {
    await onComplete()
  }

  return (
    <Dialog
      title={t("accounts.import.title")}
      onClose={onClose}
      footer={
        !importResult ? (
          <>
            <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
            <Dialog.SubmitButton
              onClick={handleImport}
              label={t("accounts.import")}
              loadingLabel={t("accounts.importing")}
              isSubmitting={isImporting}
              disabled={!selectedFile}
              variant="blue"
            />
          </>
        ) : (
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            onClick={handleDone}
          >
            {t("done")}
          </button>
        )
      }
    >
      {!importResult ? (
        <>
          <p className="text-sm text-gray-600">{t("accounts.import.hint")}</p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
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

          {error && <Alert>{error}</Alert>}
        </>
      ) : (
        <Alert variant="success" className="p-4 text-center">
          <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
          <p className="text-green-700 font-medium">
            {t("accounts.import.success", { count: importResult.count })}
          </p>
        </Alert>
      )}
    </Dialog>
  )
}

export default ImportDialog
