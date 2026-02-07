import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import Link from "next/link"
import RebalanceWizardContainer from "@components/features/rebalance/wizard/RebalanceWizardContainer"

function WizardPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()

  // Get preselected portfolio IDs from query params
  const portfolioIds = router.query.portfolios
    ? (router.query.portfolios as string).split(",")
    : undefined

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/rebalance" className="hover:text-invest-600">
          {t("rebalance.title", "Rebalancing")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">
          {t("rebalance.wizard.title", "Create Plan")}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("rebalance.wizard.title", "Create Rebalance Plan")}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t(
            "rebalance.wizard.subtitle",
            "Follow the steps to create a new rebalance plan",
          )}
        </p>
      </div>

      {/* Wizard */}
      <RebalanceWizardContainer preselectedPortfolioIds={portfolioIds} />
    </div>
  )
}

export default withPageAuthRequired(WizardPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
