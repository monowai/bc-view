import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import ModelPortfolioList from "@components/features/rebalance/models/ModelPortfolioList"

function ModelsPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()

  return (
    <div className="w-full py-4">
      {/* Breadcrumb - Model Portfolios is the entry point of the rebalancing flow */}
      <nav className="text-sm text-gray-500 mb-4">
        <span className="text-gray-900 font-medium">
          {t("rebalance.models.title", "Model Portfolios")}
        </span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("rebalance.models.title", "Investment Models")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t(
              "rebalance.models.subtitle",
              "Define target allocations for rebalancing",
            )}
          </p>
        </div>
        <button
          onClick={() => router.push("/rebalance/models/__NEW__")}
          className="bg-invest-600 text-white px-4 py-2 rounded hover:bg-invest-700 transition-colors flex items-center"
        >
          <i className="fas fa-plus mr-2"></i>
          {t("rebalance.models.create", "Create Model")}
        </button>
      </div>

      {/* Models List */}
      <ModelPortfolioList />
    </div>
  )
}

export default withPageAuthRequired(ModelsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
