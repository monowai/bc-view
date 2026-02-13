import React, { useState } from "react"
import { useRouter } from "next/router"
import { useTranslation } from "next-i18next"
import { TabType } from "./accountTypes"
import { fetchAndDownloadCsv } from "@lib/csvExport"

interface AccountActionsProps {
  onImportClick: () => void
  activeTab: TabType
}

const AccountActions = ({
  onImportClick,
  activeTab,
}: AccountActionsProps): React.ReactElement => {
  const router = useRouter()
  const { t } = useTranslation("common")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      await fetchAndDownloadCsv("/api/assets/export", "assets.csv")
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex space-x-2">
      <button
        className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <i className="fas fa-spinner fa-spin mr-2"></i>
        ) : (
          <i className="fas fa-download mr-2"></i>
        )}
        {t("accounts.export")}
      </button>
      <button
        className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {t("accounts.import")}
      </button>
      <button
        className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        onClick={() => {
          // Pass category if on a specific category tab (not "overview" or "all")
          const categoryParam =
            activeTab !== "overview" && activeTab !== "all"
              ? `?category=${activeTab}`
              : ""
          router.push(`/assets/account${categoryParam}`)
        }}
      >
        {t("account.create")}
      </button>
    </div>
  )
}

export default AccountActions
