import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"

interface PortfolioActionsProps {
  onImportClick: () => void
  onShareClick: () => void
}

const PortfolioActions = ({
  onImportClick,
  onShareClick,
}: PortfolioActionsProps): React.ReactElement => {
  const router = useRouter()
  const { t } = useTranslation("common")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/portfolios/export")
      if (!response.ok) {
        console.error("Export failed: HTTP", response.status)
        return
      }
      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "portfolios.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
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
          <i className="fas fa-spinner fa-spin mr-2"></i>
        ) : (
          <i className="fas fa-download mr-2"></i>
        )}
        {t("portfolios.export")}
      </button>
      <button
        className="hidden md:flex bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {t("portfolios.import")}
      </button>
      <button
        className="hidden md:flex bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors items-center"
        onClick={onShareClick}
      >
        <i className="fas fa-share-alt mr-2"></i>
        {t("shares.share")}
      </button>
      <button
        className="bg-wealth-500 text-white py-2 px-4 rounded-lg hover:bg-wealth-600 transition-colors flex items-center shadow-sm"
        onClick={() => router.push(`/portfolios/__NEW__`)}
      >
        <i className="fas fa-plus mr-2"></i>
        <span className="hidden sm:inline">{t("portfolio.create")}</span>
        <span className="sm:hidden">{t("new")}</span>
      </button>
    </div>
  )
}

export default PortfolioActions
