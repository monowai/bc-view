import React, { useState, useCallback, useRef, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { AssetSearchResult } from "types/beancounter"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"

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

interface SearchResult extends AssetSearchResult {
  currentSector?: string
}

export default withPageAuthRequired(
  function Classifications(): React.ReactElement {
    const { t, ready } = useTranslation("common")
    const { isAdmin, isLoading: isAdminLoading } = useIsAdmin()
    const [searchKeyword, setSearchKeyword] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedAsset, setSelectedAsset] = useState<SearchResult | null>(
      null,
    )
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
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [dbSectors, setDbSectors] = useState<SectorInfo[]>([])
    const [isLoadingSectors, setIsLoadingSectors] = useState(true)
    const [sectorToDelete, setSectorToDelete] = useState<SectorInfo | null>(
      null,
    )
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

    // Group sectors by standard
    const sectorsByStandard = React.useMemo(() => {
      const grouped: Record<string, SectorInfo[]> = {}
      dbSectors.forEach((sector) => {
        if (!grouped[sector.standard]) {
          grouped[sector.standard] = []
        }
        grouped[sector.standard].push(sector)
      })
      // Sort each group alphabetically
      Object.values(grouped).forEach((sectors) =>
        sectors.sort((a, b) => a.name.localeCompare(b.name)),
      )
      return grouped
    }, [dbSectors])

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current)
        }
      }
    }, [])

    // Debounced search function
    const performSearch = useCallback((keyword: string): void => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      if (keyword.length < 2) {
        setSearchResults([])
        return
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true)
        try {
          const response = await fetch(
            `/api/assets/search?keyword=${encodeURIComponent(keyword)}`,
          )
          if (response.ok) {
            const data = await response.json()
            setSearchResults(data.data || [])
          }
        } catch (error) {
          console.error("Search failed:", error)
        } finally {
          setIsSearching(false)
        }
      }, 300)
    }, [])

    const handleSearchChange = (
      e: React.ChangeEvent<HTMLInputElement>,
    ): void => {
      const value = e.target.value
      setSearchKeyword(value)
      performSearch(value)
    }

    const handleSelectAsset = async (result: SearchResult): Promise<void> => {
      setSearchKeyword("")
      setSearchResults([])
      setSelectedSector("")
      setCustomSector("")
      setMessage(null)
      setCurrentAssetSector(null)
      setSelectedAsset(result)

      // If we have an assetId, fetch current classification
      if (result.assetId) {
        try {
          const response = await fetch(`/api/classifications/${result.assetId}`)
          if (response.ok) {
            const data: { data: ClassificationResult } = await response.json()
            if (data.data?.sector) {
              setCurrentAssetSector(data.data.sector)
              // Pre-select the current sector
              const existingInDb = dbSectors.find(
                (s) => s.name === data.data.sector,
              )
              if (existingInDb) {
                setSelectedSector(data.data.sector)
              } else {
                setSelectedSector("custom")
                setCustomSector(data.data.sector)
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch classification:", error)
        }
      }
    }

    const handleSaveClassification = async (): Promise<void> => {
      if (!selectedAsset) {
        setMessage({ type: "error", text: "No asset selected" })
        return
      }

      const sector =
        selectedSector === "custom" ? customSector.trim() : selectedSector
      if (!sector) {
        setMessage({ type: "error", text: "Please select or enter a sector" })
        return
      }

      setIsSaving(true)
      setMessage(null)

      try {
        let assetId = selectedAsset.assetId

        // If no assetId, create the asset first
        if (!assetId) {
          const market = selectedAsset.market || selectedAsset.region || "US"
          const createResponse = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                [selectedAsset.symbol]: {
                  market: market,
                  code: selectedAsset.symbol,
                  name: selectedAsset.name,
                },
              },
            }),
          })

          if (!createResponse.ok) {
            const errorData = await createResponse.json().catch(() => ({}))
            setMessage({
              type: "error",
              text: errorData.error || "Failed to create asset in system",
            })
            return
          }

          const createData = await createResponse.json()
          const createdAsset = Object.values(createData.data || {})[0] as
            | { id: string }
            | undefined
          if (createdAsset?.id) {
            assetId = createdAsset.id
            setSelectedAsset((prev) => (prev ? { ...prev, assetId } : null))
          } else {
            setMessage({
              type: "error",
              text: "Failed to get asset ID after creation",
            })
            return
          }
        }

        // Now classify the asset
        const response = await fetch(`/api/classifications/${assetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector }),
        })

        if (response.ok) {
          setMessage({
            type: "success",
            text: `Sector set to "${sector}" for ${selectedAsset.symbol}`,
          })
          setCurrentAssetSector(sector)
          setSelectedAsset((prev) =>
            prev ? { ...prev, currentSector: sector, assetId } : null,
          )

          // Refresh sectors list to include new sector
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

    const handleClearSelection = (): void => {
      setSelectedAsset(null)
      setSelectedSector("")
      setCustomSector("")
      setMessage(null)
      setCurrentAssetSector(null)
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
          // Refresh sectors list
          setDbSectors((prev) =>
            prev.filter((s) => s.code !== sectorToDelete.code),
          )
          // Clear selection if deleted sector was selected
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

    if (!ready || isAdminLoading) {
      return rootLoader(t("loading"))
    }

    if (!isAdmin) {
      return (
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
            <h1 className="text-xl font-semibold text-red-700 mb-2">
              {t("admin.accessDenied.title", "Access Denied")}
            </h1>
            <p className="text-red-600">
              {t(
                "admin.accessDenied.message",
                "You do not have permission to access the admin area.",
              )}
            </p>
            <Link
              href="/portfolios"
              className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              {t("admin.accessDenied.goBack", "Return to Portfolios")}
            </Link>
          </div>
        </div>
      )
    }

    const standardLabels: Record<string, string> = {
      USER: "Custom Sectors",
      ALPHA: "AlphaVantage Sectors",
    }

    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("classifications.title", "Asset Classifications")}
          </h1>
          <p className="text-gray-600 mt-1">
            {t(
              "classifications.description",
              "Assign sectors to assets for better portfolio grouping",
            )}
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("classifications.search", "Search Assets")}
          </h2>

          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={handleSearchChange}
              placeholder={t(
                "classifications.search.placeholder",
                "Search by symbol or name (e.g., VOO, AAPL)...",
              )}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <i className="fas fa-spinner fa-spin text-gray-400"></i>
              </div>
            )}

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={`${result.symbol}-${result.market}-${index}`}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                    onClick={() => handleSelectAsset(result)}
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {result.symbol}
                      </span>
                      <span className="text-gray-500 ml-2">{result.name}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {result.market || result.region}
                      {result.type && (
                        <span className="ml-2">({result.type})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {searchKeyword.length > 0 && searchKeyword.length < 2 && (
            <p className="text-sm text-gray-500 mt-2">
              {t(
                "classifications.search.minChars",
                "Type at least 2 characters to search",
              )}
            </p>
          )}
        </div>

        {/* Selected Asset Section */}
        {selectedAsset && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedAsset.symbol}
                </h2>
                <p className="text-gray-600">{selectedAsset.name}</p>
                <p className="text-sm text-gray-500">
                  {selectedAsset.market || selectedAsset.region}
                  {selectedAsset.type && ` - ${selectedAsset.type}`}
                </p>
                {/* Show current sector prominently */}
                {currentAssetSector && (
                  <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                    <span className="mr-1">Current:</span>
                    {currentAssetSector}
                  </div>
                )}
              </div>
              <button
                onClick={handleClearSelection}
                className="text-gray-400 hover:text-gray-600"
                title={t("classifications.clear", "Clear selection")}
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            {/* Sector Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("classifications.sector", "Select Sector")}
                </label>

                {isLoadingSectors ? (
                  <div className="text-gray-500 text-sm">
                    Loading sectors...
                  </div>
                ) : (
                  <>
                    {/* Sectors grouped by standard */}
                    {Object.entries(sectorsByStandard).map(
                      ([standard, sectors]) => (
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
                                    title={t(
                                      "classifications.deleteSector",
                                      "Delete sector",
                                    )}
                                  >
                                    <i className="fas fa-times text-xs"></i>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}

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
                          {t("classifications.custom", "New")}
                        </button>

                        {selectedSector === "custom" && (
                          <input
                            type="text"
                            value={customSector}
                            onChange={(e) => setCustomSector(e.target.value)}
                            placeholder={t(
                              "classifications.custom.placeholder",
                              "Enter new sector name...",
                            )}
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
                <div
                  className={`p-3 rounded-lg text-sm ${
                    message.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {message.text}
                </div>
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
                  {isSaving ? (
                    <span className="flex items-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t("saving")}
                    </span>
                  ) : (
                    t("save")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        {!selectedAsset && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t("classifications.help.title", "How it works")}
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                {t(
                  "classifications.help.search",
                  "Search for an asset by symbol or name",
                )}
              </li>
              <li>
                {t(
                  "classifications.help.select",
                  "Select an existing sector or create a new one",
                )}
              </li>
              <li>
                {t(
                  "classifications.help.save",
                  "Save to update the asset's sector classification",
                )}
              </li>
              <li>
                {t(
                  "classifications.help.view",
                  "View your holdings by sector in the Summary or Allocation views",
                )}
              </li>
            </ul>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {sectorToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t("classifications.deleteConfirm.title", "Delete Sector?")}
              </h3>
              <p className="text-gray-600 mb-4">
                {t(
                  "classifications.deleteConfirm.message",
                  `Are you sure you want to delete "${sectorToDelete.name}"? Any assets using this sector will become unclassified.`,
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSectorToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDeleteSector}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:bg-red-300"
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t("deleting", "Deleting...")}
                    </span>
                  ) : (
                    t("delete", "Delete")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
