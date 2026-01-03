import React, { useState, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import Link from "next/link"
import { useModelPlan } from "@components/features/rebalance/hooks/useModelPlan"
import { useModel } from "@components/features/rebalance/hooks/useModel"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import ModelWeightsEditor from "@components/features/rebalance/models/ModelWeightsEditor"
import PortfolioSelector from "@components/features/rebalance/common/PortfolioSelector"
import { PlanAssetDto, AssetWeightWithDetails } from "types/rebalance"

function PlanDetailPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { modelId, planId } = router.query

  const { model } = useModel(modelId as string)
  const { plan, isLoading, error, mutate } = useModelPlan(
    modelId as string,
    planId as string,
  )

  const [approving, setApproving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [weights, setWeights] = useState<AssetWeightWithDetails[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showPortfolioSelector, setShowPortfolioSelector] = useState(false)
  const [loadingHoldings, setLoadingHoldings] = useState(false)

  // Initialize weights from plan
  useEffect(() => {
    if (plan?.assets) {
      setWeights(
        plan.assets.map((asset) => ({
          assetId: asset.assetId,
          weight: Math.round(asset.weight * 10000) / 100, // Convert from decimal to percentage, rounded to 2dp
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          rationale: asset.rationale,
          capturedPrice: asset.capturedPrice,
          priceCurrency: asset.priceCurrency,
          sortOrder: asset.sortOrder,
        })),
      )
      setHasChanges(false)
    }
  }, [plan])

  const handleWeightsChange = (newWeights: AssetWeightWithDetails[]): void => {
    setWeights(newWeights)
    setHasChanges(true)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${planId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: weights.map((w, index) => ({
              assetId: w.assetId,
              weight: Math.round(w.weight * 100) / 10000, // Convert from percentage to decimal, rounded to 6dp
              assetCode: w.assetCode, // MARKET:CODE format (e.g., NASDAQ:VOO)
              capturedPrice: w.capturedPrice,
              priceCurrency: w.priceCurrency,
              rationale: w.rationale || undefined,
              sortOrder: w.sortOrder ?? index,
            })),
          }),
        },
      )
      if (response.ok) {
        mutate()
        setHasChanges(false)
      }
    } catch (err) {
      console.error("Failed to save plan:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (): Promise<void> => {
    if (
      !confirm(
        t(
          "rebalance.plans.approveConfirm",
          "Approve this plan? This will lock the allocations.",
        ),
      )
    ) {
      return
    }

    // Save any pending changes first
    if (hasChanges) {
      await handleSave()
    }

    setApproving(true)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${planId}/approve`,
        { method: "POST" },
      )
      if (response.ok) {
        mutate()
      }
    } catch (err) {
      console.error("Failed to approve plan:", err)
    } finally {
      setApproving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (
      !confirm(t("rebalance.plans.deleteConfirm", "Delete this draft plan?"))
    ) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${planId}`,
        { method: "DELETE" },
      )
      if (response.ok) {
        router.push(`/rebalance/models/${modelId}`)
      }
    } catch (err) {
      console.error("Failed to delete plan:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handleFetchPrices = async (): Promise<void> => {
    setFetchingPrices(true)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${planId}/prices`,
      )
      if (response.ok) {
        const data = await response.json()
        const priceMap = new Map<string, { price: number; currency: string }>(
          (data.data || []).map(
            (p: { assetId: string; price: number; currency: string }) => [
              p.assetId,
              { price: p.price, currency: p.currency },
            ],
          ),
        )
        setWeights((prev) =>
          prev.map((w) => {
            const priceData = priceMap.get(w.assetId)
            if (priceData) {
              return {
                ...w,
                capturedPrice: priceData.price,
                priceCurrency: priceData.currency,
              }
            }
            return w
          }),
        )
        setHasChanges(true)
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err)
    } finally {
      setFetchingPrices(false)
    }
  }

  // Handle portfolio selection for loading weights from holdings
  const handlePortfoliosSelected = async (
    portfolioCodes: string[],
  ): Promise<void> => {
    if (portfolioCodes.length === 0) return

    setLoadingHoldings(true)
    try {
      const response = await fetch(
        `/api/holdings/weights?portfolioIds=${portfolioCodes.join(",")}`,
      )
      if (response.ok) {
        const data = await response.json()
        const newWeights: AssetWeightWithDetails[] = (data.weights || []).map(
          (
            w: {
              assetId: string
              weight: number
              assetCode?: string
              assetName?: string
              price?: number
              priceCurrency?: string
            },
            index: number,
          ) => ({
            assetId: w.assetId,
            weight: Math.round(w.weight * 10000) / 100,
            sortOrder: index,
            assetCode: w.assetCode,
            assetName: w.assetName,
            capturedPrice: w.price,
            priceCurrency: w.priceCurrency,
          }),
        )

        // If rounding caused total > 100, adjust the largest weight
        const total = newWeights.reduce((sum, w) => sum + w.weight, 0)
        if (total > 100 && newWeights.length > 0) {
          const largestIndex = newWeights.reduce(
            (maxIdx, w, idx, arr) =>
              w.weight > arr[maxIdx].weight ? idx : maxIdx,
            0,
          )
          const excess = Math.round((total - 100) * 100) / 100
          newWeights[largestIndex].weight =
            Math.round((newWeights[largestIndex].weight - excess) * 100) / 100
        }

        setWeights(newWeights)
        setHasChanges(true)
      }
    } catch (err) {
      console.error("Failed to load holdings weights:", err)
    } finally {
      setLoadingHoldings(false)
      setShowPortfolioSelector(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatWeight = (weight: number): string => {
    return `${(weight * 100).toFixed(2)}%`
  }

  // Escape CSV field (quote if contains comma, quote, or newline)
  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Export allocations to CSV file
  // Format: Asset (MARKET:CODE), Weight %, Price, Currency
  const handleExportCSV = (): void => {
    if (!weights.length) return

    const headers = ["Asset", "Weight %", "Price", "Currency"]
    const rows = weights.map((w) => [
      escapeCSV(w.assetCode || w.assetId), // MARKET:CODE format (e.g., NASDAQ:VOO)
      w.weight.toFixed(2),
      w.capturedPrice?.toString() || "",
      w.priceCurrency || "",
    ])

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `plan-${model?.name || "model"}-v${plan?.version || "1"}-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Parse CSV line handling quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // Skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if ((char === "," || char === "\t") && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Import allocations from CSV file
  // Format: Asset (MARKET:CODE), Weight %, Price, Currency
  const handleImportCSV = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return

      const lines = text.trim().split("\n")
      const headerLine = lines[0].toLowerCase()
      const hasHeader = headerLine.includes("asset")
      const dataLines = hasHeader ? lines.slice(1) : lines

      const newWeights: AssetWeightWithDetails[] = []

      for (const line of dataLines) {
        const parts = parseCSVLine(line)
        if (parts.length >= 2) {
          // Format: Asset (MARKET:CODE), Weight %, Price, Currency
          const rawAssetCode = parts[0]
          const weightPercent = parseFloat(parts[1])
          const price = parts[2] ? parseFloat(parts[2]) : undefined
          const currency = parts[3] || undefined

          if (rawAssetCode && !isNaN(weightPercent)) {
            // Default to US market if no market code provided
            const assetCode = rawAssetCode.includes(":")
              ? rawAssetCode
              : `US:${rawAssetCode}`
            // Try to find existing asset to get its UUID
            const existing = weights.find(
              (w) => w.assetCode === assetCode || w.assetId === assetCode,
            )
            newWeights.push({
              assetId: existing?.assetId || assetCode,
              assetCode: assetCode, // MARKET:CODE format
              weight: weightPercent,
              capturedPrice: price,
              priceCurrency: currency,
              sortOrder: newWeights.length,
            })
          }
        }
      }

      if (newWeights.length > 0) {
        setWeights(newWeights)
        setHasChanges(true)
        alert(`Imported ${newWeights.length} allocations`)
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  if (isLoading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-2xl mx-auto">
          {t("rebalance.plans.error", "Failed to load plan")}
        </div>
      </div>
    )
  }

  const isDraft = plan.status === "DRAFT"

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 max-w-2xl mx-auto">
        <Link href="/rebalance/models" className="hover:text-blue-600">
          {t("rebalance.models.title", "Model Portfolios")}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/rebalance/models/${modelId}`}
          className="hover:text-blue-600"
        >
          {model?.name || "..."}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">
          {t("rebalance.plans.plan", "Plan")} v{plan.version}
        </span>
      </nav>

      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("rebalance.plans.plan", "Plan")} v{plan.version}
            </h1>
            {plan.description && (
              <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded ${
              plan.status === "APPROVED"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {plan.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">
              {t("rebalance.plans.created", "Created")}:
            </span>
            <span className="ml-2 text-gray-900">
              {formatDate(plan.createdAt)}
            </span>
          </div>
          {plan.approvedAt && (
            <div>
              <span className="text-gray-500">
                {t("rebalance.plans.approved", "Approved")}:
              </span>
              <span className="ml-2 text-gray-900">
                {formatDate(plan.approvedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {isDraft && (
          <div className="flex gap-3 mt-6 pt-4 border-t">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
              >
                {saving ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-save mr-2"></i>
                )}
                {t("save", "Save")}
              </button>
            )}
            <button
              onClick={handleApprove}
              disabled={approving || weights.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
            >
              {approving ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-check mr-2"></i>
              )}
              {t("rebalance.plans.approve", "Approve Plan")}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 transition-colors flex items-center disabled:opacity-50"
            >
              {deleting ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-trash mr-2"></i>
              )}
              {t("delete", "Delete")}
            </button>
          </div>
        )}
      </div>

      {/* Portfolio Selector for importing from holdings */}
      {showPortfolioSelector && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {t("rebalance.plans.selectPortfolios", "Select Portfolios")}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {t(
              "rebalance.plans.selectPortfoliosDesc",
              "Choose portfolios to calculate target weights from their current holdings.",
            )}
          </p>
          <PortfolioSelector
            onSelect={handlePortfoliosSelected}
            onCancel={() => setShowPortfolioSelector(false)}
            loading={loadingHoldings}
          />
        </div>
      )}

      {/* Assets Editor/Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {t("rebalance.plans.allocations", "Target Allocations")}
          </h2>
          {isDraft && (
            <div className="flex gap-2">
              {weights.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center"
                >
                  <i className="fas fa-download mr-1.5"></i>
                  {t("export", "Export CSV")}
                </button>
              )}
              <label className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center cursor-pointer">
                <i className="fas fa-upload mr-1.5"></i>
                {t("import", "Import CSV")}
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleImportCSV}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {isDraft ? (
          <ModelWeightsEditor
            weights={weights}
            onChange={handleWeightsChange}
            onFromHoldings={() => setShowPortfolioSelector(true)}
            onFetchPrices={handleFetchPrices}
            fetchingPrices={fetchingPrices}
            showPrice={true}
          />
        ) : (
          <>
            {plan.assets.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                {t("rebalance.plans.noAssets", "No assets in this plan")}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("rebalance.plans.asset", "Asset")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("rebalance.plans.weight", "Weight")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("rebalance.plans.price", "Price")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {plan.assets.map((asset: PlanAssetDto) => (
                      <tr key={asset.id}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium text-gray-900">
                              {asset.assetCode || asset.assetId}
                            </span>
                            {asset.assetName && (
                              <div className="text-xs text-gray-500">
                                {asset.assetName}
                              </div>
                            )}
                            {asset.rationale && (
                              <div className="text-xs text-blue-600 italic mt-1">
                                <i className="fas fa-comment-alt mr-1"></i>
                                {asset.rationale}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatWeight(asset.weight)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {asset.capturedPrice
                            ? `${asset.capturedPrice.toFixed(2)} ${asset.priceCurrency || ""}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    {/* Cash row */}
                    {plan.cashWeight > 0 && (
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-700">
                            <i className="fas fa-coins mr-2 text-gray-400"></i>
                            {t("rebalance.plans.cash", "Cash")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatWeight(plan.cashWeight)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default withPageAuthRequired(PlanDetailPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
