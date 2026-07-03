import React, { useState, useEffect, useRef } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import Link from "next/link"
import { useModelPlan } from "@components/features/rebalance/hooks/useModelPlan"
import { useModelPlans } from "@components/features/rebalance/hooks/useModelPlans"
import { useModel } from "@components/features/rebalance/hooks/useModel"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import ModelWeightsEditor from "@components/features/rebalance/models/ModelWeightsEditor"
import ImportHoldingsDialog from "@components/features/rebalance/models/ImportHoldingsDialog"
import AssetInsightPopup from "@components/features/rebalance/models/AssetInsightPopup"
import PriceChartPopup from "@components/features/holdings/PriceChartPopup"
import { PlanAssetDto, AssetWeightWithDetails } from "types/rebalance"
import { Asset, Market } from "types/beancounter"
import { escapeCSV, downloadCsv } from "@lib/csvExport"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Spinner from "@components/ui/Spinner"
import { todayIso } from "@lib/formatters"

function PlanDetailPage(): React.ReactElement {
  const router = useRouter()
  // On client-side navigation router.query is empty until router.isReady flips
  // true. Reading the params before then yields undefined SWR keys (no fetch),
  // which would otherwise render the empty/error state and never recover until a
  // manual refresh. Gate the param reads on readiness so they fetch once known.
  const modelId = router.isReady ? (router.query.modelId as string) : undefined
  const planId = router.isReady ? (router.query.planId as string) : undefined

  const { model } = useModel(modelId)
  const { plan, isLoading, error, mutate } = useModelPlan(modelId, planId)
  const { plans } = useModelPlans(modelId)

  const [approving, setApproving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showImportHoldingsDialog, setShowImportHoldingsDialog] =
    useState(false)
  const [weights, setWeights] = useState<AssetWeightWithDetails[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [chartAsset, setChartAsset] = useState<Asset | null>(null)
  const [insightAsset, setInsightAsset] =
    useState<AssetWeightWithDetails | null>(null)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Find previous plan (any other plan that's not the current one)
  const previousPlan = plans.find((p) => p.id !== planId)

  // Close import dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        importDropdownRef.current &&
        !importDropdownRef.current.contains(event.target as Node)
      ) {
        setShowImportDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Initialize weights from plan. Render-phase "store previous value" pattern:
  // when the fetched plan reference changes, re-seed the editable weights once
  // (mirrors the prior effect keyed on [plan]) without a cascading effect.
  //
  // Guard on !hasChanges: SWR hands back a NEW plan object reference on every
  // revalidation (focus/reconnect/mutate) even when the data is unchanged. Re-
  // seeding unconditionally would wipe locally-added-but-unsaved assets the
  // moment any background revalidation fires — the asset vanishes before Save.
  // Only re-seed from the server when there are no pending local edits (initial
  // load and after a successful save, which resets hasChanges).
  const [prevPlan, setPrevPlan] = useState(plan)
  if (plan !== prevPlan) {
    setPrevPlan(plan)
    if (plan?.assets && !hasChanges) {
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
    }
  }

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
              assetName: w.assetName,
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
    setShowApproveConfirm(false)

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
    setShowDeleteConfirm(false)
    setDeleting(true)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${planId}`,
        { method: "DELETE" },
      )
      if (response.ok) {
        router.push(`/rebalance/models/${modelId}`)
      } else {
        const text = await response.text().catch(() => "")
        setActionError(
          `Delete failed (${response.status})${text ? `: ${text}` : ""}`,
        )
      }
    } catch (err) {
      console.error("Failed to delete plan:", err)
      setActionError("Delete failed — please try again")
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateNewVersion = async (): Promise<void> => {
    setCreatingVersion(true)
    try {
      const response = await fetch(`/api/rebalance/models/${modelId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePlanId: planId }),
      })
      if (response.ok) {
        const result = await response.json()
        router.push(`/rebalance/models/${modelId}/plans/${result.data.id}`)
      }
    } catch (err) {
      console.error("Failed to create new version:", err)
    } finally {
      setCreatingVersion(false)
    }
  }

  const handleImportFromPlan = async (sourcePlanId: string): Promise<void> => {
    setShowImportDropdown(false)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${sourcePlanId}`,
      )
      if (response.ok) {
        const result = await response.json()
        const sourcePlan = result.data
        if (sourcePlan?.assets) {
          const newWeights: AssetWeightWithDetails[] = sourcePlan.assets.map(
            (asset: PlanAssetDto, index: number) => ({
              assetId: asset.assetId,
              weight: Math.round(asset.weight * 10000) / 100,
              assetCode: asset.assetCode,
              assetName: asset.assetName,
              rationale: asset.rationale,
              capturedPrice: asset.capturedPrice,
              priceCurrency: asset.priceCurrency,
              sortOrder: asset.sortOrder ?? index,
            }),
          )
          setWeights(newWeights)
          setHasChanges(true)
        }
      }
    } catch (err) {
      console.error("Failed to import from plan:", err)
    }
  }

  // Check if a string looks like a UUID (vs a symbol like "VOO" or "US:VOO")
  // Supports both standard format (36 chars with hyphens) and URL-safe base64 format (22 chars)
  const isUuid = (id: string): boolean => {
    // Standard UUID format: 8-4-4-4-12 hex chars
    const standardUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    // URL-safe base64 encoded UUID: 22 chars of alphanumeric, - and _
    const base64Uuid = /^[A-Za-z0-9_-]{22}$/
    return standardUuid.test(id) || base64Uuid.test(id)
  }

  const handleShowPriceChart = (w: AssetWeightWithDetails): void => {
    const [market, code] = w.assetCode?.includes(":")
      ? w.assetCode.split(":")
      : ["US", w.assetCode || w.assetId]
    setChartAsset({
      id: w.assetId,
      code,
      name: w.assetName || code,
      assetCategory: { id: "EQUITY", name: "EQUITY" },
      market: { code: market } as Market,
    } as Asset)
  }

  const handleFetchPrices = async (
    weightsOverride?: AssetWeightWithDetails[],
  ): Promise<void> => {
    const currentWeights = weightsOverride ?? weights
    setFetchingPrices(true)
    try {
      // First, ensure all assets exist in svc-data (create if needed)
      const assetsToCreate = currentWeights.filter((w) => !isUuid(w.assetId))

      let updatedWeights = [...currentWeights]

      if (assetsToCreate.length > 0) {
        // Build asset creation request
        // assetCode format is "MARKET:CODE" (e.g., "US:VOO") or just "CODE"
        const assetInputs: Record<
          string,
          { market: string; code: string; name?: string }
        > = {}
        for (const w of assetsToCreate) {
          const [market, code] = w.assetCode?.includes(":")
            ? w.assetCode.split(":")
            : ["US", w.assetCode || w.assetId]
          assetInputs[w.assetId] = {
            market,
            code,
            name: w.assetName,
          }
        }

        const createResponse = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: assetInputs }),
        })

        if (createResponse.ok) {
          const createData = await createResponse.json()
          // Update weights with real asset IDs
          updatedWeights = currentWeights.map((w) => {
            if (!isUuid(w.assetId) && createData.data?.[w.assetId]) {
              return {
                ...w,
                assetId: createData.data[w.assetId].id,
              }
            }
            return w
          })
          setWeights(updatedWeights)
          setHasChanges(true)
        }
      }

      // Silently save current weights so the backend has the full asset list
      // before fetching prices — newly added assets won't appear in prices
      // otherwise (backend reads from DB, not from the in-memory state).
      await fetch(`/api/rebalance/models/${modelId}/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedWeights.map((w, index) => ({
            assetId: w.assetId,
            weight: Math.round(w.weight * 100) / 10000,
            assetCode: w.assetCode,
            assetName: w.assetName,
            capturedPrice: w.capturedPrice,
            priceCurrency: w.priceCurrency,
            rationale: w.rationale || undefined,
            sortOrder: w.sortOrder ?? index,
          })),
        }),
      })

      // Now fetch prices for all assets
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

  // Handle import from holdings dialog
  const handleImportHoldings = (
    importedWeights: AssetWeightWithDetails[],
  ): void => {
    setWeights(importedWeights)
    setHasChanges(true)
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

  const buildCSV = (): string => {
    const headers = ["Asset", "Weight %", "Price", "Currency", "Description"]
    const rows = weights.map((w) => [
      escapeCSV(w.assetCode || w.assetId),
      w.weight.toFixed(2),
      w.capturedPrice?.toString() || "",
      w.priceCurrency || "",
      escapeCSV(w.rationale || ""),
    ])
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  }

  // Export allocations to CSV file
  const handleExportCSV = (): void => {
    if (!weights.length) return
    const csv = buildCSV()
    const filename = `plan-${model?.name || "model"}-v${plan?.version || "1"}-${todayIso()}.csv`
    downloadCsv(filename, csv)
  }

  // Copy allocations as CSV to clipboard
  const handleCopyCSV = async (): Promise<void> => {
    if (!weights.length) return
    await navigator.clipboard.writeText(buildCSV())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
  // Supports both 5-column (Asset, Weight %, Price, Currency, Description) and
  // 4-column (Asset, Weight %, Price, Description) formats.
  // Currency can also be inferred from the price header, e.g. "Price (SGD)".
  // If prices are missing, automatically fetches them after import.
  const handleImportCSV = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e): void => {
      const text = e.target?.result as string
      if (!text) return

      const lines = text.trim().split("\n")
      const headerLine = lines[0].toLowerCase()
      const hasHeader = headerLine.includes("asset")
      const dataLines = hasHeader ? lines.slice(1) : lines

      // Detect column layout from header
      const headerParts = hasHeader ? parseCSVLine(lines[0]) : ([] as string[])
      // Check if header has a separate currency column (5-column format)
      const hasCurrencyColumn =
        headerParts.length >= 5 &&
        headerParts[3]?.toLowerCase().includes("currency")
      // Extract currency from price header, e.g. "Price (SGD)" -> "SGD"
      const priceHeader = headerParts[2] || ""
      const headerCurrencyMatch = priceHeader.match(/\(([A-Z]{3})\)/i)
      const headerCurrency = headerCurrencyMatch?.[1]?.toUpperCase()

      const newWeights: AssetWeightWithDetails[] = []

      for (const line of dataLines) {
        const parts = parseCSVLine(line)
        if (parts.length >= 2) {
          const rawAssetCode = parts[0]
          const weightPercent = parseFloat(parts[1])
          const price = parts[2] ? parseFloat(parts[2]) : undefined

          let currency: string | undefined
          let rationale: string | undefined

          if (hasCurrencyColumn) {
            // 5-column format: Asset, Weight %, Price, Currency, Description
            currency = parts[3] || undefined
            rationale = parts[4] || undefined
          } else {
            // 4-column format: Asset, Weight %, Price, Description
            // Use currency from price header if available
            currency = headerCurrency
            rationale = parts[3] || undefined
          }

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
              rationale: rationale,
              sortOrder: newWeights.length,
            })
          }
        }
      }

      if (newWeights.length > 0) {
        // Check if any assets are missing prices
        const missingPrices = newWeights.some((w) => !w.capturedPrice)

        setWeights(newWeights)
        setHasChanges(true)

        // Auto-fetch prices for assets without prices, passing weights
        // directly to avoid stale closure from React state
        if (missingPrices) {
          handleFetchPrices(newWeights)
        }
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  if (!router.isReady || isLoading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-5xl mx-auto">
          {"Failed to load plan"}
        </div>
      </div>
    )
  }

  const isDraft = plan.status === "DRAFT"

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 max-w-5xl mx-auto">
        <Link href="/rebalance/models" className="hover:text-invest-600">
          {"Model Portfolios"}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/rebalance/models/${modelId}`}
          className="hover:text-invest-600"
        >
          {model?.name || "..."}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">
          {"Plan"} v{plan.version}
        </span>
      </nav>

      {/* Action error banner */}
      {actionError && (
        <div className="mb-4 max-w-5xl mx-auto bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-red-700">
          <span>
            <i className="fas fa-exclamation-circle mr-2"></i>
            {actionError}
          </span>
          <button
            onClick={() => setActionError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-5xl mx-auto mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {"Plan"} v{plan.version}
              </h1>
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  plan.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {plan.status}
              </span>
            </div>
            {plan.description && (
              <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
            )}
          </div>
          <button
            onClick={handleCreateNewVersion}
            disabled={creatingVersion}
            className="ml-4 text-sm text-invest-600 hover:text-invest-700 transition-colors flex items-center disabled:opacity-50 shrink-0"
          >
            {creatingVersion ? (
              <Spinner className="mr-2" />
            ) : (
              <i className="fas fa-code-branch mr-2"></i>
            )}
            {"New Version"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{"Created"}:</span>
            <span className="ml-2 text-gray-900">
              {formatDate(plan.createdAt)}
            </span>
          </div>
          {plan.approvedAt && (
            <div>
              <span className="text-gray-500">{"Approved"}:</span>
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
                className="bg-invest-600 text-white px-4 py-2 rounded-lg hover:bg-invest-700 transition-colors flex items-center disabled:opacity-50"
              >
                {saving ? (
                  <Spinner className="mr-2" />
                ) : (
                  <i className="fas fa-save mr-2"></i>
                )}
                {"Save"}
              </button>
            )}
            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={approving || weights.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
            >
              {approving ? (
                <Spinner className="mr-2" />
              ) : (
                <i className="fas fa-check mr-2"></i>
              )}
              {"Approve Plan"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors flex items-center disabled:opacity-50"
            >
              {deleting ? (
                <Spinner className="mr-2" />
              ) : (
                <i className="fas fa-trash mr-2"></i>
              )}
              {"Delete"}
            </button>
          </div>
        )}
      </div>

      {/* Assets Editor/Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {"Target Allocations"}
          </h2>
          <div className="flex gap-2">
            {/* Export / Copy buttons - available for both draft and approved plans */}
            {weights.length > 0 && (
              <>
                <button
                  onClick={handleCopyCSV}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                >
                  <i
                    className={`fas ${copied ? "fa-check text-green-600" : "fa-clipboard"} mr-1.5`}
                  ></i>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                >
                  <i className="fas fa-download mr-1.5"></i>
                  {"Export"}
                </button>
              </>
            )}
            {/* Import dropdown - only for draft plans */}
            {isDraft && (
              <>
                <div className="relative" ref={importDropdownRef}>
                  <button
                    onClick={() => setShowImportDropdown(!showImportDropdown)}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                  >
                    <i className="fas fa-upload mr-1.5"></i>
                    {"Import"}
                    <i className="fas fa-chevron-down ml-1.5 text-xs"></i>
                  </button>
                  {showImportDropdown && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowImportDropdown(false)
                            setShowImportHoldingsDialog(true)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <i className="fas fa-chart-pie mr-3 text-gray-400 w-4"></i>
                          {"Holdings"}
                        </button>
                        <button
                          onClick={() => {
                            setShowImportDropdown(false)
                            csvInputRef.current?.click()
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <i className="fas fa-file-csv mr-3 text-gray-400 w-4"></i>
                          {"CSV"}
                        </button>
                        {previousPlan && (
                          <button
                            onClick={() =>
                              handleImportFromPlan(previousPlan.id)
                            }
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <i className="fas fa-copy mr-3 text-gray-400 w-4"></i>
                            {`Plan v${previousPlan.version}`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleImportCSV}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>

        {isDraft ? (
          <ModelWeightsEditor
            weights={weights}
            onChange={handleWeightsChange}
            onFetchPrices={handleFetchPrices}
            fetchingPrices={fetchingPrices}
            showPrice={true}
            onShowPriceChart={handleShowPriceChart}
            onShowAssetInsight={(w) => setInsightAsset(w)}
          />
        ) : (
          <>
            {plan.assets.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                {"No assets in this plan"}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {"Asset"}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {"Weight"}
                      </th>
                      <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {"Price"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {plan.assets.map((asset: PlanAssetDto) => (
                      <tr key={asset.id}>
                        <td className="px-3 sm:px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {asset.assetCode || asset.assetId}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleShowPriceChart({
                                    assetId: asset.assetId,
                                    assetCode: asset.assetCode,
                                    assetName: asset.assetName,
                                    weight: Number(asset.weight) * 100,
                                  })
                                }
                                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                                title={"Price history chart"}
                              >
                                <i className="fas fa-chart-line text-xs"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setInsightAsset({
                                    assetId: asset.assetId,
                                    assetCode: asset.assetCode,
                                    assetName: asset.assetName,
                                    weight: Number(asset.weight) * 100,
                                  })
                                }
                                className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                                title={"AI asset insight"}
                              >
                                <i className="fas fa-robot text-xs"></i>
                              </button>
                            </div>
                            {asset.assetName && (
                              <div className="text-xs text-gray-500">
                                {asset.assetName}
                              </div>
                            )}
                            {/* Show price on mobile below asset name */}
                            {asset.capturedPrice && (
                              <div className="text-xs text-gray-400 sm:hidden">
                                {asset.capturedPrice.toFixed(2)}{" "}
                                {asset.priceCurrency || ""}
                              </div>
                            )}
                            {asset.rationale && (
                              <div className="text-xs text-invest-600 italic mt-1">
                                <i className="fas fa-comment-alt mr-1"></i>
                                {asset.rationale}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                          {formatWeight(asset.weight)}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">
                          {asset.capturedPrice
                            ? `${asset.capturedPrice.toFixed(2)} ${asset.priceCurrency || ""}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    {/* Cash row */}
                    {plan.cashWeight > 0 && (
                      <tr className="bg-gray-50">
                        <td className="px-3 sm:px-4 py-3">
                          <span className="font-medium text-gray-700">
                            <i className="fas fa-coins mr-2 text-gray-400"></i>
                            {"Cash"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right text-gray-700">
                          {formatWeight(plan.cashWeight)}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">
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

      {/* Import from Holdings Dialog */}
      <ImportHoldingsDialog
        modalOpen={showImportHoldingsDialog}
        modelId={modelId as string}
        onClose={() => setShowImportHoldingsDialog(false)}
        onImport={handleImportHoldings}
      />
      {showApproveConfirm && (
        <ConfirmDialog
          title={"Approve Plan"}
          message={"Approve this plan? This will lock the allocations."}
          confirmLabel={"Approve"}
          cancelLabel={"Cancel"}
          variant="blue"
          onConfirm={handleApprove}
          onCancel={() => setShowApproveConfirm(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={"Delete Plan"}
          message={"Delete this draft plan?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {chartAsset && (
        <PriceChartPopup
          asset={chartAsset}
          onClose={() => setChartAsset(null)}
        />
      )}
      {insightAsset && (
        <AssetInsightPopup
          asset={insightAsset}
          modelName={model?.name || ""}
          onClose={() => setInsightAsset(null)}
        />
      )}
    </div>
  )
}

export default withPageAuthRequired(PlanDetailPage)
