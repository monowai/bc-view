import React, { useState } from "react"
import { useRouter } from "next/router"
import { fetchAndDownloadCsv } from "@lib/csvExport"
import Spinner from "@components/ui/Spinner"

interface PortfolioActionsProps {
  onImportClick: () => void
  onShareClick: () => void
}

const PortfolioActions = ({
  onImportClick,
  onShareClick,
}: PortfolioActionsProps): React.ReactElement => {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      await fetchAndDownloadCsv("/api/portfolios/export", "portfolios.csv")
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Import/Export hidden on mobile */}
      <button
        className="hidden md:flex bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors items-center"
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
        className="hidden md:flex bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {"Import"}
      </button>
      <button
        className="hidden md:flex bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors items-center"
        onClick={onShareClick}
      >
        <i className="fas fa-share-alt mr-2"></i>
        {"Share"}
      </button>
      <button
        className="bg-wealth-500 text-white py-2 px-4 rounded-lg hover:bg-wealth-600 transition-colors flex items-center shadow-sm"
        onClick={() => router.push(`/portfolios/__NEW__`)}
      >
        <i className="fas fa-plus mr-2"></i>
        <span className="hidden sm:inline">{"Add"}</span>
        <span className="sm:hidden">{"New"}</span>
      </button>
    </div>
  )
}

export default PortfolioActions
