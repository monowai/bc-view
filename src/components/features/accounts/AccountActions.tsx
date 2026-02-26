import React, { useState } from "react"
import { useRouter } from "next/router"
import { TabType } from "./accountTypes"
import { fetchAndDownloadCsv } from "@lib/csvExport"
import Spinner from "@components/ui/Spinner"

interface AccountActionsProps {
  onImportClick: () => void
  activeTab: TabType
}

const AccountActions = ({
  onImportClick,
  activeTab,
}: AccountActionsProps): React.ReactElement => {
  const router = useRouter()
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
    <div className="flex flex-wrap gap-2">
      <button
        className="bg-gray-500 text-white py-2 px-3 sm:px-4 text-sm rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <Spinner className="mr-2" />
        ) : (
          <i className="fas fa-download mr-2"></i>
        )}
        {"Export"}
      </button>
      <button
        className="bg-gray-500 text-white py-2 px-3 sm:px-4 text-sm rounded hover:bg-gray-600 transition-colors flex items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {"Import"}
      </button>
      <button
        className="bg-blue-500 text-white py-2 px-3 sm:px-4 text-sm rounded hover:bg-blue-600 transition-colors"
        onClick={() => {
          // Pass category if on a specific category tab (not "overview" or "all")
          const categoryParam =
            activeTab !== "overview" && activeTab !== "all"
              ? `?category=${activeTab}`
              : ""
          router.push(`/assets/account${categoryParam}`)
        }}
      >
        {"Add Asset"}
      </button>
    </div>
  )
}

export default AccountActions
