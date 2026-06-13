import React, { useState, useEffect } from "react"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"

interface SectorInfo {
  code: string
  name: string
  standard: string
}

interface ClassificationResult {
  assetId: string
  sector?: string
  industry?: string
}

interface ExposureItem {
  item: {
    name: string
  }
  weight: number
}

interface AssetClassifyPanelProps {
  assetId: string
  assetLabel: string // e.g. "AAPL", used only in success messages
}

const standardLabels: Record<string, string> = {
  USER: "Custom Sectors",
  ALPHA: "AlphaVantage Sectors",
}

const AssetClassifyPanel: React.FC<AssetClassifyPanelProps> = ({
  assetId,
  assetLabel,
}) => {
  const [currentAssetSector, setCurrentAssetSector] = useState<string | null>(
    null,
  )
  const [selectedSector, setSelectedSector] = useState("")
  const [customSector, setCustomSector] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [dbSectors, setDbSectors] = useState<SectorInfo[]>([])
  const [isLoadingSectors, setIsLoadingSectors] = useState(true)
  const [sectorToDelete, setSectorToDelete] = useState<SectorInfo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch sectors from database on mount
  useEffect(() => {
    async function fetchSectors(): Promise<void> {
      try {
        const response = await fetch("/api/classifications/sectors")
        if (response.ok) {
          const data = await response.json()
          setDbSectors(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch sectors:", error)
      } finally {
        setIsLoadingSectors(false)
      }
    }
    fetchSectors()
  }, [])

  // Fetch current classification whenever assetId changes
  useEffect(() => {
    if (!assetId) return

    setSelectedSector("")
    setCustomSector("")
    setMessage(null)
    setCurrentAssetSector(null)

    async function fetchCurrentSector(): Promise<void> {
      try {
        const [classResponse, exposuresResponse] = await Promise.all([
          fetch(`/api/classifications/${assetId}`),
          fetch(`/api/classifications/${assetId}/exposures`),
        ])

        let sector: string | undefined

        // Check direct classification first (equities)
        if (classResponse.ok) {
          const classData: { data: ClassificationResult } =
            await classResponse.json()
          if (classData.data?.sector) {
            sector = classData.data.sector
          }
        }

        // If no direct classification, check exposures (ETFs) for primary sector
        if (!sector && exposuresResponse.ok) {
          const exposuresData: { data: ExposureItem[] } =
            await exposuresResponse.json()
          if (exposuresData.data && exposuresData.data.length > 0) {
            const primaryExposure = exposuresData.data.reduce((max, exp) =>
              exp.weight > max.weight ? exp : max,
            )
            sector = primaryExposure.item.name
          }
        }

        if (sector) {
          setCurrentAssetSector(sector)
          const existingInDb = dbSectors.find((s) => s.name === sector)
          if (existingInDb) {
            setSelectedSector(sector)
          } else {
            setSelectedSector("custom")
            setCustomSector(sector)
          }
        }
      } catch (error) {
        console.error("Failed to fetch classification:", error)
      }
    }

    fetchCurrentSector()
    // dbSectors intentionally omitted: we only want to re-fetch when assetId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId])

  // Group sectors by standard
  const sectorsByStandard = React.useMemo(() => {
    const grouped: Record<string, SectorInfo[]> = {}
    dbSectors.forEach((sector) => {
      if (!grouped[sector.standard]) {
        grouped[sector.standard] = []
      }
      grouped[sector.standard].push(sector)
    })
    Object.values(grouped).forEach((sectors) =>
      sectors.sort((a, b) => a.name.localeCompare(b.name)),
    )
    return grouped
  }, [dbSectors])

  const handleSaveClassification = async (): Promise<void> => {
    const sector =
      selectedSector === "custom" ? customSector.trim() : selectedSector
    if (!sector) {
      setMessage({ type: "error", text: "Please select or enter a sector" })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/classifications/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector }),
      })

      if (response.ok) {
        setMessage({
          type: "success",
          text: `Sector set to "${sector}" for ${assetLabel}`,
        })
        setCurrentAssetSector(sector)

        // Refresh sectors list to include any newly created sector
        const sectorsResponse = await fetch("/api/classifications/sectors")
        if (sectorsResponse.ok) {
          const sectorsData = await sectorsResponse.json()
          setDbSectors(sectorsData.data || [])
        }
      } else {
        const errorData = await response.json()
        setMessage({
          type: "error",
          text: errorData.error || "Failed to save classification",
        })
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save classification" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSector = async (): Promise<void> => {
    if (!sectorToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/classifications/sectors/${encodeURIComponent(sectorToDelete.code)}`,
        {
          method: "DELETE",
        },
      )

      if (response.ok) {
        const data = await response.json()
        const affectedAssets = data.data?.affectedAssets || 0
        setMessage({
          type: "success",
          text: `Deleted sector "${sectorToDelete.name}"${affectedAssets > 0 ? ` (${affectedAssets} asset${affectedAssets !== 1 ? "s" : ""} unclassified)` : ""}`,
        })
        setDbSectors((prev) =>
          prev.filter((s) => s.code !== sectorToDelete.code),
        )
        if (selectedSector === sectorToDelete.name) {
          setSelectedSector("")
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        setMessage({
          type: "error",
          text: errorData.error || "Failed to delete sector",
        })
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete sector" })
    } finally {
      setIsDeleting(false)
      setSectorToDelete(null)
    }
  }

  return (
    <div>
      {/* Current sector badge */}
      {currentAssetSector && (
        <div className="mb-4">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
            <span className="mr-1">Current:</span>
            {currentAssetSector}
          </div>
        </div>
      )}

      {/* Sector Selection */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {"Sector"}
          </label>

          {isLoadingSectors ? (
            <div className="text-gray-500 text-sm">Loading sectors...</div>
          ) : (
            <>
              {/* Sectors grouped by standard */}
              {Object.entries(sectorsByStandard).map(([standard, sectors]) => (
                <div key={standard} className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    {standardLabels[standard] || standard}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sectors.map((sector) => (
                      <div key={sector.code} className="relative group">
                        <button
                          onClick={() => {
                            setSelectedSector(sector.name)
                            setCustomSector("")
                          }}
                          className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                            selectedSector === sector.name
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:border-gray-300 text-gray-700"
                          } ${standard === "USER" ? "pr-8" : ""}`}
                        >
                          {sector.name}
                        </button>
                        {standard === "USER" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSectorToDelete(sector)
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={"Delete sector"}
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* No sectors message */}
              {Object.keys(sectorsByStandard).length === 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  No sectors in database yet. Create one below.
                </p>
              )}

              {/* Custom Sector Input */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Create New Sector
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedSector("custom")}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedSector === "custom"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    {"Custom"}
                  </button>

                  {selectedSector === "custom" && (
                    <input
                      type="text"
                      value={customSector}
                      onChange={(e) => setCustomSector(e.target.value)}
                      placeholder={"Enter custom sector..."}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Message */}
        {message && (
          <Alert variant={message.type === "success" ? "success" : "error"}>
            {message.text}
          </Alert>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveClassification}
            disabled={
              isSaving ||
              !selectedSector ||
              (selectedSector === "custom" && !customSector.trim())
            }
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              isSaving ||
              !selectedSector ||
              (selectedSector === "custom" && !customSector.trim())
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isSaving ? <Spinner label={"Saving..."} /> : "Save"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {sectorToDelete && (
        <Dialog
          title={"Delete Sector?"}
          onClose={() => setSectorToDelete(null)}
          footer={
            <>
              <Dialog.CancelButton
                onClick={() => setSectorToDelete(null)}
                label={"Cancel"}
              />
              <Dialog.SubmitButton
                onClick={handleDeleteSector}
                label={"Delete"}
                loadingLabel={"Deleting..."}
                isSubmitting={isDeleting}
                variant="red"
              />
            </>
          }
        >
          <p className="text-gray-600">
            {`Are you sure you want to delete "${sectorToDelete.name}"? Any assets using this sector will become unclassified.`}
          </p>
        </Dialog>
      )}
    </div>
  )
}

export default AssetClassifyPanel
