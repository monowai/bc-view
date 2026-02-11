import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import ModelPortfolioList from "@components/features/rebalance/models/ModelPortfolioList"
import ResourceShareInviteDialog from "@components/features/shares/ResourceShareInviteDialog"
import { useModels } from "@components/features/rebalance/hooks/useModels"

function ModelsPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { models } = useModels()
  const [showShareDialog, setShowShareDialog] = useState(false)

  const ownedModels = models.filter((m) => m.isOwner !== false)

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
        <div className="flex items-center space-x-2">
          {ownedModels.length > 0 && (
            <button
              onClick={() => setShowShareDialog(true)}
              className="border border-blue-300 text-blue-700 px-4 py-2 rounded hover:bg-blue-50 transition-colors flex items-center"
            >
              <i className="fas fa-share-alt mr-2"></i>
              {t("share", "Share")}
            </button>
          )}
          <button
            onClick={() => router.push("/rebalance/models/__NEW__")}
            className="bg-invest-600 text-white px-4 py-2 rounded hover:bg-invest-700 transition-colors flex items-center"
          >
            <i className="fas fa-plus mr-2"></i>
            {t("rebalance.models.create", "Create Model")}
          </button>
        </div>
      </div>

      {/* Models List */}
      <ModelPortfolioList />

      {showShareDialog && ownedModels.length > 0 && (
        <ResourceShareInviteDialog
          resourceType="REBALANCE_MODEL"
          resources={ownedModels.map((m) => ({ id: m.id, name: m.name }))}
          onClose={() => setShowShareDialog(false)}
          onSuccess={() => setShowShareDialog(false)}
        />
      )}
    </div>
  )
}

export default withPageAuthRequired(ModelsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
