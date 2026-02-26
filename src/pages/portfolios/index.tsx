import React, { useState, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import type { User } from "@auth0/nextjs-auth0/types"
import { Portfolio } from "types/beancounter"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import ManagedPortfolios from "@components/features/portfolios/ManagedPortfolios"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import PortfolioImportDialog from "@components/features/portfolios/PortfolioImportDialog"
import PortfoliosList from "@components/features/portfolios/PortfoliosList"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { usePortfolios } from "@hooks/usePortfolios"

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
  const activeTab =
    (router.query.tab as string) === "managed" ? "managed" : "my"
  const setActiveTab = useCallback(
    (tab: "my" | "managed") => {
      router.replace(
        { pathname: router.pathname, query: tab === "my" ? {} : { tab } },
        undefined,
        { shallow: true },
      )
    },
    [router],
  )

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

  if (
    activeTab === "my" &&
    (isLoading || (portfolios.length > 0 && !fxRatesReady))
  ) {
    return rootLoader("Loading...")
  }

  return (
    <>
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex px-4">
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "my"
                ? "border-wealth-500 text-wealth-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("my")}
          >
            <i className="fas fa-briefcase mr-2"></i>
            {"My Portfolios"}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "managed"
                ? "border-wealth-500 text-wealth-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("managed")}
          >
            <i className="fas fa-users mr-2"></i>
            {"Managed"}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "my" && !isLoading && (
        <PortfoliosList
          portfolios={portfolios}
          displayCurrency={displayCurrency}
          currencies={currencies}
          fxRates={fxRates}
          onCurrencyChange={setDisplayCurrency}
          onImportClick={handleImportClick}
          onShareClick={handleShareClick}
          onCorporateActions={setCorporateActionsPortfolio}
          onDelete={setDeleteTarget}
        />
      )}
      {activeTab === "managed" && <ManagedPortfolios />}

      {corporateActionsPortfolio && (
        <PortfolioCorporateActionsPopup
          portfolio={corporateActionsPortfolio}
          modalOpen={!!corporateActionsPortfolio}
          onClose={handleCorporateActionsClose}
        />
      )}
      {showImportDialog && (
        <PortfolioImportDialog
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
