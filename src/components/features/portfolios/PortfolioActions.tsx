import React, { useState } from "react"
import { useRouter } from "next/router"
import { fetchAndDownloadCsv } from "@lib/csvExport"
import Spinner from "@components/ui/Spinner"
import { portfoliosExportUrl } from "@utils/api/client/portfolios"

interface PortfolioActionsProps {
  onImportClick: () => void
  onShareClick: () => void
  // Present only when consolidation is possible (more than one portfolio).
  onConsolidateClick?: () => void
}

const GHOST_CLS =
  "hidden md:flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"

const PortfolioActions = ({
  onImportClick,
  onShareClick,
  onConsolidateClick,
}: PortfolioActionsProps): React.ReactElement => {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      await fetchAndDownloadCsv(portfoliosExportUrl, "portfolios.csv")
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Import/Export hidden on mobile */}
      <button
        className={GHOST_CLS}
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
      <button className={GHOST_CLS} onClick={onImportClick}>
        <i className="fas fa-upload mr-2"></i>
        {"Import"}
      </button>
      {onConsolidateClick && (
        <button
          className={GHOST_CLS}
          onClick={onConsolidateClick}
          title="Move one portfolio's transactions into another and remove it"
        >
          <i className="fas fa-object-group mr-2"></i>
          {"Consolidate"}
        </button>
      )}
      <button className={GHOST_CLS} onClick={onShareClick}>
        <i className="fas fa-share-alt mr-2"></i>
        {"Share"}
      </button>
      <button
        className="btn-primary btn-primary--sm flex items-center"
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
