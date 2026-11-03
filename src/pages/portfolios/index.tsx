import React, { useState, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import type { User } from "@auth0/nextjs-auth0/types"
import { Portfolio } from "types/beancounter"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import useSwr from "swr"
import { rootLoader } from "@components/ui/PageLoader"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import ManagedPortfolios from "@components/features/portfolios/ManagedPortfolios"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import CsvImportDialog from "@components/ui/CsvImportDialog"
import { importPortfolios } from "@utils/api/client/portfolios"
import PortfoliosList from "@components/features/portfolios/PortfoliosList"
import LinkCompositeBanner from "@components/features/portfolios/LinkCompositeBanner"
import ConsolidatePortfoliosDialog from "@components/features/portfolios/ConsolidatePortfoliosDialog"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { usePortfolios } from "@hooks/usePortfolios"
import { sharesManagedKey, simpleFetcher } from "@utils/api/fetchHelper"

function PortfolioTab({
  label,
  icon,
  count = 0,
  active,
  onClick,
}: {
  label: string
  icon: string
  count?: number
  active: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={`-mb-px whitespace-nowrap border-b-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wealth-500 ${
        active
          ? "border-wealth-500 text-wealth-600"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
      onClick={onClick}
    >
      <span className="hidden sm:inline">
        <i className={`fas ${icon} mr-2`}></i>
      </span>
      {label}
      {count > 0 && (
        <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs tabular-nums text-gray-600">
          {count}
        </span>
      )}
    </button>
  )
}

/** Holds the page's shape while portfolios and FX rates load. */
function PortfoliosSkeleton(): React.ReactElement {
  return (
    <div data-testid="loading" aria-busy="true" className="animate-pulse">
      <div className="border-b border-gray-200 bg-white px-4 pt-4 pb-5">
        <div className="h-8 w-40 rounded bg-gray-200"></div>
        <div className="mt-4 h-9 w-64 rounded bg-gray-200"></div>
      </div>
      <div className="p-4">
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-6 px-4 py-3">
              <div className="h-4 w-16 rounded bg-gray-200"></div>
              <div className="h-4 flex-1 rounded bg-gray-100"></div>
              <div className="h-4 w-24 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default withPageAuthRequired(function Portfolios({
  user,
}: {
  user: User
}): React.ReactElement {
  const router = useRouter()
  const {
    portfolios,
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxRatesReady,
    error,
    isLoading,
    mutate,
    deletePortfolio,
  } = usePortfolios()

  // Corporate actions popup state
  const [corporateActionsPortfolio, setCorporateActionsPortfolio] =
    useState<Portfolio | null>(null)

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Consolidate (merge-and-remove) wizard state.
  const [showConsolidate, setShowConsolidate] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    code: string
  } | null>(null)

  // Share dialog state
  const [sharePortfolioId, setSharePortfolioId] = useState<
    string | undefined | null
  >(null)

  // Tab state - read from query param, default to "my"
  const tabParam = router.query.tab as string
  const activeTab =
    tabParam === "managed"
      ? "managed"
      : tabParam === "inactive"
        ? "inactive"
        : "my"
  const setActiveTab = useCallback(
    (tab: "my" | "managed" | "inactive") => {
      router.replace(
        { pathname: router.pathname, query: tab === "my" ? {} : { tab } },
        undefined,
        { shallow: true },
      )
    },
    [router],
  )

  const activePortfolios = portfolios.filter((p) => p.active !== false)
  const inactivePortfolios = portfolios.filter((p) => p.active === false)

  // Hide the Managed tab when the user has nothing shared with them.
  // Cheap GET — same endpoint ManagedPortfolios uses; SWR will dedupe.
  const { data: managedSharesData } = useSwr<{ data: unknown[] }>(
    sharesManagedKey,
    simpleFetcher(sharesManagedKey),
  )
  const hasManagedShares = (managedSharesData?.data?.length ?? 0) > 0
  // If the user lands on /portfolios?tab=managed but has nothing managed
  // (e.g. a share was revoked), bounce them back to "my" so they don't
  // see an empty tab with no way to switch.
  React.useEffect(() => {
    if (
      activeTab === "managed" &&
      managedSharesData !== undefined &&
      !hasManagedShares
    ) {
      setActiveTab("my")
    }
  }, [activeTab, managedSharesData, hasManagedShares, setActiveTab])

  const handleCorporateActionsClose = useCallback(() => {
    setCorporateActionsPortfolio(null)
  }, [])

  const handleImportClick = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleShareClick = useCallback((portfolioId?: string) => {
    setSharePortfolioId(portfolioId ?? undefined)
  }, [])

  const handleImportComplete = useCallback(async () => {
    await mutate()
    setShowImportDialog(false)
  }, [mutate])

  async function deletePortfolioConfirm(): Promise<void> {
    if (!deleteTarget) return
    try {
      await deletePortfolio(deleteTarget.id)
    } catch (error) {
      console.error("Failed to delete portfolio:", error)
    } finally {
      setDeleteTarget(null)
    }
  }

  if (error) {
    return errorOut("Error retrieving portfolios", error)
  }

  if (!user) {
    return rootLoader("Loading...")
  }

  const valuesPending = isLoading || (portfolios.length > 0 && !fxRatesReady)

  return (
    <>
      <nav
        aria-label={"Portfolio lists"}
        className="flex border-b border-gray-200 bg-white px-4"
      >
        <PortfolioTab
          label={"My Portfolios"}
          icon="fa-briefcase"
          active={activeTab === "my"}
          onClick={() => setActiveTab("my")}
        />
        <PortfolioTab
          label={"Inactive"}
          icon="fa-archive"
          count={inactivePortfolios.length}
          active={activeTab === "inactive"}
          onClick={() => setActiveTab("inactive")}
        />
        {hasManagedShares && (
          <PortfolioTab
            label={"Managed"}
            icon="fa-users"
            active={activeTab === "managed"}
            onClick={() => setActiveTab("managed")}
          />
        )}
      </nav>

      {/* Tab content */}
      {activeTab !== "managed" && valuesPending && <PortfoliosSkeleton />}
      {activeTab === "my" && !valuesPending && (
        <>
          <div className="px-4 pt-4 empty:hidden">
            <LinkCompositeBanner />
          </div>
          <PortfoliosList
            portfolios={activePortfolios}
            displayCurrency={displayCurrency}
            currencies={currencies}
            fxRates={fxRates}
            onCurrencyChange={setDisplayCurrency}
            onImportClick={handleImportClick}
            onShareClick={handleShareClick}
            onConsolidateClick={
              activePortfolios.length > 1
                ? () => setShowConsolidate(true)
                : undefined
            }
            onCorporateActions={setCorporateActionsPortfolio}
            onDelete={setDeleteTarget}
          />
        </>
      )}
      {activeTab === "inactive" && !valuesPending && (
        <PortfoliosList
          portfolios={inactivePortfolios}
          displayCurrency={displayCurrency}
          currencies={currencies}
          fxRates={fxRates}
          onCurrencyChange={setDisplayCurrency}
          onImportClick={handleImportClick}
          onShareClick={handleShareClick}
          onCorporateActions={setCorporateActionsPortfolio}
          onDelete={setDeleteTarget}
          isInactiveTab
        />
      )}
      {activeTab === "managed" && (
        <ManagedPortfolios onCorporateActions={setCorporateActionsPortfolio} />
      )}

      {corporateActionsPortfolio && (
        <PortfolioCorporateActionsPopup
          portfolio={corporateActionsPortfolio}
          modalOpen={!!corporateActionsPortfolio}
          onClose={handleCorporateActionsClose}
        />
      )}
      {showImportDialog && (
        <CsvImportDialog
          title="Import Portfolios"
          description="Import portfolios from a CSV file. The file should have columns: Code, Name, Currency, Base."
          importCsv={importPortfolios}
          noun="portfolio"
          onClose={() => setShowImportDialog(false)}
          onComplete={handleImportComplete}
        />
      )}
      {sharePortfolioId !== null && portfolios.length > 0 && (
        <ShareInviteDialog
          portfolios={portfolios}
          preSelectedPortfolioId={sharePortfolioId}
          onClose={() => setSharePortfolioId(null)}
          onSuccess={() => setSharePortfolioId(null)}
        />
      )}
      {showConsolidate && (
        <ConsolidatePortfoliosDialog
          portfolios={activePortfolios}
          onClose={() => setShowConsolidate(false)}
          onComplete={async () => {
            await mutate()
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={"Delete Portfolio"}
          message={`Delete portfolio ${deleteTarget.code} and all associated transactions?`}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={deletePortfolioConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
})
