import React, { useEffect, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import useSWR, { mutate } from "swr"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import { holdingsHighlightHref } from "@utils/holdings/holdingsHref"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  Asset,
  AssetCategory,
  AssetOption,
  Market,
  Portfolio,
  Position,
  PriceData,
  QuickSellData,
} from "types/beancounter"
import { ModelsContainingAssetResponse } from "types/rebalance"
import AssetSearch from "@components/features/assets/AssetSearch"
import { useAssetReview } from "@components/features/assets/useAssetReview"
import PriceChartPopup from "@components/features/holdings/PriceChartPopup"
import SectorWeightingsPopup from "@components/features/holdings/SectorWeightingsPopup"
import AssetNewsPopup from "@components/features/assets/AssetNewsPopup"
import { isFundLike } from "@lib/assets/assetUtils"
import { formatCurrency, formatDate, formatPercent } from "@lib/formatters"
import Alert from "@components/ui/Alert"
import EmptyState from "@components/ui/EmptyState"
import ActionMenu, { ActionMenuItem } from "@components/ui/ActionMenu"
import AssetAdminDialog from "@components/features/assets/AssetAdminDialog"
import TradeAssetAction from "@components/features/transactions/TradeAssetAction"
import TradeInputForm from "@components/features/transactions/TradeInputForm"
import AssetLookupTabNav, {
  AssetLookupTabId,
} from "@components/features/assets/AssetLookupTabNav"
import AssetBrokersTab from "@components/features/assets/AssetBrokersTab"
import { usePermissions } from "@hooks/usePermissions"

interface AssetPosition {
  // Composite assets (CPF, ILP, ...) don't belong to a portfolio — svc-position
  // synthesises a position from the asset config and the API returns
  // portfolio: null on that path.
  portfolio: Portfolio | null
  position: Position | null
  balance: number
}

const queryString = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value)

function assetOptionFromQuery(
  query: Record<string, string | string[] | undefined>,
): AssetOption | null {
  const symbol = queryString(query.symbol)
  const assetId = queryString(query.assetId)
  if (!symbol && !assetId) return null
  const market = queryString(query.market) || ""
  const name = queryString(query.name)
  const details = [market, queryString(query.type)].filter(Boolean).join(", ")
  const label = details
    ? `${symbol || assetId} - ${name || symbol || assetId} (${details})`
    : `${symbol || assetId} - ${name || symbol || assetId}`
  return {
    value: assetId || symbol || "",
    label,
    symbol: symbol || assetId || "",
    name,
    market,
    assetId,
    currency: queryString(query.currency),
    type: queryString(query.type),
  }
}

/** Create (or fetch, if it already exists) the BC asset for a search hit. */
function changeClass(change: number): string {
  if (change < 0) return "text-red-600"
  if (change > 0) return "text-emerald-600"
  return "text-gray-600"
}

async function createAsset(option: AssetOption): Promise<Asset> {
  if (!option.market || !option.symbol) {
    throw new Error("Cannot resolve this asset — missing market or symbol")
  }
  const code = option.symbol.toUpperCase()
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        [code]: {
          market: option.market,
          code,
          name: option.name || code,
          currency: option.currency,
          category: option.type || "EQUITY",
          owner: "",
        },
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Could not resolve asset (${response.status})`)
  }
  const body = (await response.json()) as { data: Record<string, Asset> }
  const created = body.data?.[code]
  if (!created?.id) throw new Error("Asset response missing id")
  return created
}

/** Placeholder rows while a tab's table loads. */
function PanelSkeleton(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="divide-y divide-gray-100 animate-pulse motion-reduce:animate-none"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between px-4 py-4">
          <div className="h-4 w-32 rounded bg-gray-100"></div>
          <div className="h-4 w-20 rounded bg-gray-100"></div>
        </div>
      ))}
    </div>
  )
}

// Secondary actions share one quiet shape so Trade stays the only primary.
const toolButton =
  "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"

// On a phone the secondary actions share the row and Trade takes its own.
const fillOnPhone = "flex-auto justify-center sm:flex-none"

function assetOptionToAsset(option: AssetOption): Asset {
  const marketCode = option.market || ""
  // Search hits carry the provider's casing ("Mutual Fund"); BC category ids
  // are upper case.
  const categoryId = (option.type || "EQUITY").toUpperCase()
  const category: AssetCategory = {
    id: categoryId,
    name: option.type || "EQUITY",
  }
  return {
    id: option.assetId || option.value,
    code: option.symbol,
    name: option.name || option.symbol,
    assetCategory: category,
    market: { code: marketCode } as Market,
  }
}

function AssetLookupPage(): React.ReactElement {
  const router = useRouter()
  const { preferences } = useUserPreferences()

  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string>(
    preferences?.defaultMarket || "",
  )
  const [chartAsset, setChartAsset] = useState<Asset | null>(null)
  const [sectorAsset, setSectorAsset] = useState<Asset | null>(null)
  const [newsAsset, setNewsAsset] = useState<AssetOption | null>(null)
  const [resolvingAsset, setResolvingAsset] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const { popup: reviewPopup, showReview } = useAssetReview()
  const { ai: canRunAi, preview: canPreview, admin: isAdmin } = usePermissions()
  const canReviewAsset = canRunAi || canPreview
  const [deleting, setDeleting] = useState(false)
  // Keyed by asset so a late delete response can only ever surface against
  // the asset it was for, never one the user picked while it was in flight.
  const [deleteError, setDeleteError] = useState<{
    assetId: string
    message: string
  } | null>(null)
  const [showAdminEdit, setShowAdminEdit] = useState(false)
  const [activeTab, setActiveTab] = useState<AssetLookupTabId>("portfolios")
  const [sellRow, setSellRow] = useState<AssetPosition | null>(null)
  const [sellModalOpen, setSellModalOpen] = useState(false)

  // Hydrate selected asset from query string (header search deep-link).
  useEffect(() => {
    if (!router.isReady) return
    const hydrated = assetOptionFromQuery(router.query)
    if (!hydrated) return
    // Syncing from the router query (external system, only populated after
    // router.isReady) — deferring to render would read it before it's ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAsset((prev) => {
      const prevId = prev?.assetId || prev?.value
      const nextId = hydrated.assetId || hydrated.value
      return prevId === nextId ? prev : hydrated
    })
    if (hydrated.market) {
      setSelectedMarket(hydrated.market)
    }
  }, [router.isReady, router.query])

  // Fetch available markets
  const { data: marketsData } = useSWR<{ data: Market[] }>(
    marketsKey,
    simpleFetcher(marketsKey),
  )

  // Each tab loads its own data when opened. Positions also back the admin
  // Delete guard (an asset held anywhere can't be deleted).
  const { data: positionsData, isLoading: loadingPositions } = useSWR<{
    data: AssetPosition[]
  }>(
    selectedAsset?.assetId && (activeTab === "portfolios" || isAdmin)
      ? `/api/assets/${selectedAsset.assetId}/positions?date=today`
      : null,
    simpleFetcher(`/api/assets/${selectedAsset?.assetId}/positions?date=today`),
  )

  // Latest quote from svc-data: the provider's live/delayed price where its
  // plan allows, else the stored close.
  const priceKey = selectedAsset?.assetId
    ? `/api/prices/${selectedAsset.assetId}/quote`
    : null
  const { data: priceResponse, isLoading: loadingPrice } = useSWR<{
    data: PriceData[]
  }>(priceKey, priceKey ? simpleFetcher(priceKey) : null)
  const lastClose = priceResponse?.data?.[0]

  const positions = positionsData?.data || []
  // Zero-balance rows (fully sold out / roundtripped) add no value to "who
  // holds this asset" — hide them. Keep negative/short balances visible.
  const visiblePositions = positions.filter((ap) => ap.balance !== 0)

  // Models live in svc-rebalance — only ask when the Models tab is open.
  const { data: modelsData, isLoading: loadingModels } =
    useSWR<ModelsContainingAssetResponse>(
      selectedAsset?.assetId && activeTab === "models"
        ? `/api/rebalance/assets/${selectedAsset.assetId}/models`
        : null,
      simpleFetcher(`/api/rebalance/assets/${selectedAsset?.assetId}/models`),
    )

  const models = modelsData?.data || []

  const knownMarkets = (marketsData?.data || []).map((m) => m.code)

  const handleAssetSelect = (option: AssetOption | null): void => {
    setSelectedAsset(option)
    setResolveError(null)
    setActiveTab("portfolios")
  }

  const openSell = (ap: AssetPosition): void => {
    if (!ap.portfolio) return
    setSellRow(ap)
    setSellModalOpen(true)
  }

  const handleSellModalOpenChange = (open: boolean): void => {
    setSellModalOpen(open)
    if (!open) {
      setSellRow(null)
      if (selectedAsset?.assetId) {
        mutate(`/api/assets/${selectedAsset.assetId}/positions?date=today`)
      }
    }
  }

  const quickSellDataFor = (ap: AssetPosition): QuickSellData => ({
    asset: selectedAsset?.symbol || "",
    assetId: selectedAsset?.assetId,
    market: ap.position?.asset?.market?.code || selectedAsset?.market || "",
    quantity: ap.balance,
    price: ap.position?.moneyValues?.PORTFOLIO?.priceData?.close || 0,
    type: "SELL",
  })

  // Search hits for assets BC hasn't seen yet carry no id — create the asset
  // first so the chart / sector popups have something to fetch against.
  const resolveAsset = async (option: AssetOption): Promise<Asset | null> => {
    setResolveError(null)
    if (option.assetId) return assetOptionToAsset(option)
    setResolvingAsset(true)
    try {
      const created = await createAsset(option)
      setSelectedAsset({ ...option, assetId: created.id })
      return created
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Failed to load asset")
      return null
    } finally {
      setResolvingAsset(false)
    }
  }

  // A search hit BC hasn't seen has no id, so nothing to price. Create it as
  // soon as it's picked so the card can show its quote. Keyed on market and
  // symbol: a same-symbol hit on another market is a different asset, and a
  // failed create doesn't retry in a loop.
  const pending =
    selectedAsset && !selectedAsset.assetId ? selectedAsset : undefined
  const pendingKey = pending ? `${pending.market}:${pending.symbol}` : undefined
  // Hold Chart / Sectors while that create is in flight, so they don't POST
  // the same asset again. A failed create sets resolveError and frees them.
  const creatingPending = !!pending && !resolveError
  useEffect(() => {
    if (!pending) return undefined
    let cancelled = false
    createAsset(pending)
      .then((created) => {
        if (!cancelled) setSelectedAsset({ ...pending, assetId: created.id })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setResolveError(
            e instanceof Error ? e.message : "Failed to load asset",
          )
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey])

  const openChartFor = async (option: AssetOption): Promise<void> => {
    const asset = await resolveAsset(option)
    if (asset) setChartAsset(asset)
  }

  const openSectorsFor = async (option: AssetOption): Promise<void> => {
    const asset = await resolveAsset(option)
    if (asset) setSectorAsset(asset)
  }

  // Navigate to transactions on double-click
  const handleRowDoubleClick = (portfolioId: string, assetId: string): void => {
    router.push(`/trns/trades/${portfolioId}/${assetId}`)
  }

  const handleDeleteAsset = async (): Promise<void> => {
    if (!selectedAsset?.assetId) return
    // Snapshot the target identity: every state update below is conditional
    // on it, so a late response can't clear a different asset's selection.
    const targetAssetId = selectedAsset.assetId
    const label = selectedAsset.symbol || selectedAsset.assetId
    if (
      !window.confirm(
        `Delete asset "${label}"? This cannot be undone. The asset must not be held in any portfolio.`,
      )
    ) {
      return
    }
    setDeleting(true)
    setDeleteError(null)
    const fail = (message: string): void =>
      setDeleteError({ assetId: targetAssetId, message })
    try {
      const response = await fetch(
        `/api/assets/admin/${encodeURIComponent(targetAssetId)}`,
        { method: "DELETE" },
      )
      if (!response.ok) {
        // API proxy writes JSON `{ error, message, ... }` on failures —
        // surface that message rather than the raw envelope.
        let errorMessage: string | null = null
        const raw = await response.text()
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              message?: string
              error?: string
              detail?: string
            }
            errorMessage =
              parsed.message || parsed.error || parsed.detail || null
          } catch {
            errorMessage = raw
          }
        }
        fail(
          errorMessage ||
            `Delete failed (${response.status} ${response.statusText})`,
        )
        return
      }
      setSelectedAsset((prev) =>
        prev?.assetId === targetAssetId ? null : prev,
      )
      setChartAsset((prev) => (prev?.id === targetAssetId ? null : prev))
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to delete asset")
    } finally {
      setDeleting(false)
    }
  }

  // Format currency value
  const formatValue = (value: number, currency?: string): string => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Format quantity
  const formatQuantity = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(value)
  }

  // Format weight as percentage
  const formatWeight = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  const assetFacts = selectedAsset
    ? [selectedAsset.market, selectedAsset.currency, selectedAsset.type]
        .filter(Boolean)
        .join(" · ")
    : ""

  const adminActions: ActionMenuItem[] =
    isAdmin && selectedAsset?.assetId
      ? [
          {
            label: "Edit",
            icon: "fa-pen",
            onSelect: () => setShowAdminEdit(true),
          },
          {
            label: deleting ? "Deleting..." : "Delete",
            icon: "fa-trash",
            destructive: true,
            onSelect: handleDeleteAsset,
            disabled: deleting || loadingPositions || positions.length > 0,
            title: loadingPositions
              ? "Checking whether this asset is held in any portfolio…"
              : positions.length > 0
                ? "Cannot delete — asset is held in one or more portfolios"
                : "Delete asset (admin)",
          },
        ]
      : []

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Title and search share a row on wide screens. */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">{"Asset Lookup"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {"Search for an asset to see which portfolios hold it"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-3xl">
          <label htmlFor="lookup-market" className="sr-only">
            {"Market"}
          </label>
          <select
            id="lookup-market"
            value={selectedMarket}
            onChange={(e) => {
              setSelectedMarket(e.target.value)
              setSelectedAsset(null)
            }}
            className="input-height w-full sm:w-48 border border-gray-300 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{"All Markets"}</option>
            {(marketsData?.data || []).map((market) => (
              <option key={market.code} value={market.code}>
                {market.code} — {market.name}
              </option>
            ))}
          </select>
          <label htmlFor="lookup-asset" className="sr-only">
            {"Search Asset"}
          </label>
          <div className="min-w-0 flex-1">
            <AssetSearch
              key={selectedMarket}
              inputId="lookup-asset"
              market={selectedMarket}
              knownMarkets={knownMarkets}
              value={selectedAsset}
              onSelect={handleAssetSelect}
              noResultsHref="/assets/account"
              placeholder={"Type asset symbol or name..."}
            />
          </div>
        </div>
      </div>

      {!selectedAsset && (
        <EmptyState
          icon="fas fa-magnifying-glass-chart"
          title="Look up any listed asset"
          description="See its last close, chart it, read the news, and find which portfolios hold it."
        />
      )}

      {/* Selected asset: identity, price, then every action in one group —
          a single row on wide screens. */}
      {selectedAsset && (
        <section
          aria-labelledby="selected-asset-heading"
          className="mb-5 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between lg:px-5"
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-10">
            <div className="min-w-0">
              <h2
                id="selected-asset-heading"
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <span className="font-mono text-xl font-semibold text-gray-900">
                  {selectedAsset.symbol}
                </span>
                {selectedAsset.name &&
                  selectedAsset.name !== selectedAsset.symbol && (
                    <span className="text-base font-medium text-gray-700">
                      {selectedAsset.name}
                    </span>
                  )}
              </h2>
              {assetFacts && (
                <p className="mt-0.5 text-sm text-gray-500">{assetFacts}</p>
              )}
            </div>
            {lastClose ? (
              <div data-testid="last-close" className="shrink-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-xl font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(lastClose.close)}
                  </span>
                  {/* No previous close = no real change; don't show 0.00%. */}
                  {lastClose.previousClose > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-sm font-medium tabular-nums ${changeClass(lastClose.change)}`}
                    >
                      {lastClose.change !== 0 && (
                        <i
                          aria-hidden="true"
                          className={`fas ${lastClose.change > 0 ? "fa-caret-up" : "fa-caret-down"}`}
                        ></i>
                      )}
                      {`${lastClose.change > 0 ? "+" : ""}${formatCurrency(lastClose.change)} (${lastClose.changePercent > 0 ? "+" : ""}${formatPercent(lastClose.changePercent)})`}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {lastClose.priceDate
                    ? `Last Close · ${formatDate(lastClose.priceDate)}`
                    : "Last Close"}
                </p>
              </div>
            ) : loadingPrice || creatingPending ? (
              <div
                role="status"
                aria-label="Loading price"
                className="h-11 w-40 shrink-0 rounded-md bg-gray-100 animate-pulse motion-reduce:animate-none"
              ></div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            {selectedAsset.market && selectedAsset.symbol && (
              <button
                type="button"
                onClick={() => openChartFor(selectedAsset)}
                disabled={resolvingAsset || creatingPending}
                className={`${toolButton} ${fillOnPhone}`}
                aria-label={`Show price chart for ${selectedAsset.symbol}`}
                title="Price Chart"
              >
                <i
                  aria-hidden="true"
                  className={`fas ${resolvingAsset ? "fa-circle-notch fa-spin" : "fa-chart-line"} text-gray-400`}
                ></i>
                <span>{"Chart"}</span>
              </button>
            )}
            {selectedAsset.symbol &&
              isFundLike(assetOptionToAsset(selectedAsset)) && (
                <button
                  type="button"
                  onClick={() => openSectorsFor(selectedAsset)}
                  disabled={resolvingAsset || creatingPending}
                  className={`${toolButton} ${fillOnPhone}`}
                  aria-label={`Show sectors for ${selectedAsset.symbol}`}
                  title="Sector Weightings"
                >
                  <i
                    aria-hidden="true"
                    className="fas fa-chart-pie text-gray-400"
                  ></i>
                  <span>{"Sectors"}</span>
                </button>
              )}
            {selectedAsset.symbol && (
              <button
                type="button"
                onClick={() => setNewsAsset(selectedAsset)}
                className={`${toolButton} ${fillOnPhone}`}
                aria-label={`Show news for ${selectedAsset.symbol}`}
                title="News"
              >
                <i
                  aria-hidden="true"
                  className="fas fa-newspaper text-gray-400"
                ></i>
                <span>{"News"}</span>
              </button>
            )}
            {canReviewAsset && (
              <button
                type="button"
                onClick={() => showReview(selectedAsset)}
                className={`${toolButton} ${fillOnPhone}`}
                aria-label={`Open AI Asset Review for ${selectedAsset.symbol}`}
                title="AI Asset Review"
              >
                <i
                  aria-hidden="true"
                  className="fas fa-microscope text-gray-400"
                ></i>
                <span>{"AI Review"}</span>
              </button>
            )}
            {selectedAsset.symbol && (
              <div className="w-full sm:w-auto [&>button]:w-full [&>button]:justify-center">
                <TradeAssetAction asset={selectedAsset} />
              </div>
            )}
            {adminActions.length > 0 && (
              <ActionMenu
                items={adminActions}
                label={`More actions for ${selectedAsset.symbol}`}
                triggerClassName={`${toolButton} w-8 justify-center px-0`}
              />
            )}
          </div>
        </section>
      )}
      {selectedAsset &&
        deleteError &&
        deleteError.assetId === selectedAsset.assetId && (
          <Alert variant="error" className="mb-5">
            {deleteError.message}
          </Alert>
        )}
      {/* Admin: edit (name/category) + classify popup, replaces the
          separate Admin → Asset Classifications screen. */}
      {isAdmin && selectedAsset?.assetId && showAdminEdit && (
        <AssetAdminDialog
          assetId={selectedAsset.assetId}
          onClose={() => setShowAdminEdit(false)}
        />
      )}
      {reviewPopup}
      {resolveError && (
        <Alert variant="error" className="mb-4">
          {resolveError}
        </Alert>
      )}
      {chartAsset && (
        <PriceChartPopup
          asset={chartAsset}
          currencySymbol=""
          onClose={() => setChartAsset(null)}
        />
      )}
      {newsAsset && (
        <AssetNewsPopup
          symbol={newsAsset.symbol}
          market={newsAsset.market}
          name={newsAsset.name}
          onClose={() => setNewsAsset(null)}
        />
      )}
      {sectorAsset && (
        <SectorWeightingsPopup
          asset={sectorAsset}
          modalOpen={true}
          onClose={() => setSectorAsset(null)}
        />
      )}

      {/* Tabs */}
      {selectedAsset && (
        <AssetLookupTabNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Portfolios Tab */}
      {selectedAsset && activeTab === "portfolios" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loadingPositions ? (
            <PanelSkeleton />
          ) : visiblePositions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-folder-open text-3xl mb-2 text-gray-300"></i>
              <p>{"This asset is not held in any portfolio"}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Portfolio"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Qty"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    {"Cost"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Value"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    {"Gain"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visiblePositions.map((ap, idx) => {
                  const moneyValues = ap.position?.moneyValues?.PORTFOLIO
                  const gain = moneyValues
                    ? (moneyValues.marketValue || 0) -
                      (moneyValues.costValue || 0)
                    : 0
                  const gainPercent =
                    moneyValues && moneyValues.costValue
                      ? (gain / moneyValues.costValue) * 100
                      : 0
                  const portfolio = ap.portfolio
                  const currencyCode =
                    portfolio?.currency.code ??
                    ap.position?.asset?.market?.currency?.code ??
                    ""
                  const rowKey = portfolio?.id ?? `composite-${idx}`

                  if (!portfolio) {
                    return (
                      <tr key={rowKey} className="bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-700">
                            Composite
                          </span>
                          <div className="text-xs text-gray-500">
                            Sub-account roll-up (no portfolio)
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                          {formatQuantity(ap.balance)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                          -
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                          {currencyCode
                            ? formatValue(ap.balance, currencyCode)
                            : formatQuantity(ap.balance)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                          -
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          -
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={rowKey}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onDoubleClick={() =>
                        handleRowDoubleClick(
                          portfolio.id,
                          selectedAsset.assetId || selectedAsset.value,
                        )
                      }
                      title={"Double-click to edit"}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const assetId =
                              selectedAsset.assetId || selectedAsset.value
                            router.push(
                              holdingsHighlightHref(portfolio.code, assetId),
                            )
                          }}
                          className="font-medium text-invest-600 hover:text-invest-700 hover:underline focus:outline-none focus:ring-2 focus:ring-invest-500 rounded"
                          title={`View holdings for ${portfolio.code}`}
                        >
                          {portfolio.code}
                        </button>
                        <div className="text-xs text-gray-500">
                          {portfolio.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {formatQuantity(ap.balance)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell tabular-nums">
                        {moneyValues
                          ? formatValue(
                              moneyValues.costValue || 0,
                              portfolio.currency.code,
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                        {moneyValues
                          ? formatValue(
                              moneyValues.marketValue || 0,
                              portfolio.currency.code,
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                        {moneyValues ? (
                          <div
                            className={
                              gain >= 0 ? "text-emerald-600" : "text-red-600"
                            }
                          >
                            <div>
                              {gain > 0 ? "+" : ""}
                              {formatValue(gain, portfolio.currency.code)}
                            </div>
                            <div className="text-xs">
                              ({gainPercent >= 0 ? "+" : ""}
                              {gainPercent.toFixed(1)}%)
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSell(ap)
                          }}
                          className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 motion-reduce:transition-none"
                          title={`Sell ${selectedAsset.symbol || ""} from ${portfolio.code}`}
                        >
                          <i className="fas fa-hand-holding-usd mr-1"></i>
                          {"Sell"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {visiblePositions.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              <i className="fas fa-info-circle mr-1"></i>
              {"Double-click a row to view and edit transactions"}
            </div>
          )}
        </div>
      )}

      {/* Brokers Tab */}
      {selectedAsset && activeTab === "brokers" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {selectedAsset.assetId ? (
            <AssetBrokersTab assetId={selectedAsset.assetId} />
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>{"Resolve this asset first to view broker holdings"}</p>
            </div>
          )}
        </div>
      )}

      {/* Models Table */}
      {selectedAsset && activeTab === "models" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loadingModels ? (
            <PanelSkeleton />
          ) : models.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-sitemap text-3xl mb-2 text-gray-300"></i>
              <p>{"This asset is not in any active model plans"}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Model"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Version"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Target Weight"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {models.map((model) => (
                  <tr
                    key={`${model.modelId}-${model.planId}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onDoubleClick={() =>
                      router.push(
                        `/rebalance/models/${model.modelId}/plans/${model.planId}`,
                      )
                    }
                    title={"Double-click to view plan"}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {model.modelName}
                      </div>
                      {model.assetCode && (
                        <div className="text-xs text-gray-500">
                          {model.assetCode}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      v{model.planVersion}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums">
                      {formatWeight(model.targetWeight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {models.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              <i className="fas fa-info-circle mr-1"></i>
              {"Double-click a row to view the model plan"}
            </div>
          )}
        </div>
      )}

      {sellRow?.portfolio && (
        <TradeInputForm
          portfolio={sellRow.portfolio}
          modalOpen={sellModalOpen}
          setModalOpen={handleSellModalOpenChange}
          initialValues={quickSellDataFor(sellRow)}
        />
      )}
    </div>
  )
}
export default withPageAuthRequired(AssetLookupPage)
