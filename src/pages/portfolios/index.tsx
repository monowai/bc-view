import React, { useState, useMemo, useCallback, useEffect } from "react"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import type { User } from "@auth0/nextjs-auth0/types"
import { useTranslation } from "next-i18next"
import { Portfolio, Currency } from "types/beancounter"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import ManagedPortfolios from "@components/features/portfolios/ManagedPortfolios"
import { useFxRates } from "@hooks/useFxRates"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import PortfolioImportDialog from "@components/features/portfolios/PortfolioImportDialog"
import PortfoliosList from "@components/features/portfolios/PortfoliosList"
import ConfirmDialog from "@components/ui/ConfirmDialog"

export default withPageAuthRequired(function Portfolios({
  user,
}: {
  user: User
}): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { data, mutate, error } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

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

  // Currency display state
  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCurrencies(data.data)
        }
      })
      .catch(console.error)
  }, [])

  // FX rates for converting portfolio values to display currency
  const sourceCurrencyCodes = useMemo(
    () => (data?.data || []).map((p: Portfolio) => p.base.code),
    [data?.data],
  )
  const {
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxReady: fxRatesReady,
  } = useFxRates(currencies, sourceCurrencyCodes)

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
      await fetch(`/api/portfolios/${deleteTarget.id}`, {
        method: "DELETE",
      })
      await mutate()
    } catch (error) {
      console.error("Failed to delete portfolio:", error)
    } finally {
      setDeleteTarget(null)
    }
  }

  if (error) {
    return errorOut(t("portfolios.error.retrieve"), error)
  }

  if (!user) {
    return rootLoader(t("loading"))
  }

  if (
    activeTab === "my" &&
    (!data || !ready || (data.data.length > 0 && !fxRatesReady))
  ) {
    return rootLoader(t("loading"))
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
            {t("shares.tab.my")}
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
            {t("shares.tab.managed")}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "my" && data && (
        <PortfoliosList
          portfolios={data.data}
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
      {sharePortfolioId !== null && data?.data && (
        <ShareInviteDialog
          portfolios={data.data}
          preSelectedPortfolioId={sharePortfolioId}
          onClose={() => setSharePortfolioId(null)}
          onSuccess={() => setSharePortfolioId(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={t("portfolio.delete.title", "Delete Portfolio")}
          message={t("portfolio.delete", { code: deleteTarget.code })}
          confirmLabel={t("delete", "Delete")}
          cancelLabel={t("cancel", "Cancel")}
          variant="red"
          onConfirm={deletePortfolioConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common", "wealth"])),
  },
})
