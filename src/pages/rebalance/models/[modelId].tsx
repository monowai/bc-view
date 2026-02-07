import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import Link from "next/link"
import ModelPortfolioForm from "@components/features/rebalance/models/ModelPortfolioForm"
import ModelPlans from "@components/features/rebalance/models/ModelPlans"
import { useModel } from "@components/features/rebalance/hooks/useModel"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"

function ModelDetailPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { modelId } = router.query

  const isNew = modelId === "__NEW__"
  const { model, isLoading, error, mutate } = useModel(
    isNew ? undefined : (modelId as string),
  )
  const [isEditing, setIsEditing] = useState(isNew)

  if (!isNew && isLoading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  if (!isNew && error) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {t("rebalance.models.error", "Failed to load model")}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4 max-w-2xl mx-auto">
        <Link href="/rebalance/models" className="hover:text-invest-600">
          {t("rebalance.models.title", "Model Portfolios")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">
          {isNew
            ? t("rebalance.models.create", "Create Model")
            : model?.name || "..."}
        </span>
      </nav>

      {/* Model Summary/Edit Section */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg max-w-2xl mx-auto mb-6">
        {isNew ? (
          /* New Model - Show full form */
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">
              {t("rebalance.models.create", "Create Model")}
            </h1>
            <ModelPortfolioForm
              onSuccess={() => router.push("/rebalance/models")}
            />
          </div>
        ) : isEditing ? (
          /* Editing Existing Model */
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                {t("rebalance.models.editDetails", "Edit Model Details")}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-times mr-1"></i>
                {t("cancel", "Cancel")}
              </button>
            </div>
            <ModelPortfolioForm
              model={model}
              onSuccess={() => {
                mutate()
                setIsEditing(false)
              }}
            />
          </div>
        ) : (
          /* Collapsed Summary View */
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {model?.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                  {model?.objective && (
                    <span className="truncate max-w-xs" title={model.objective}>
                      {model.objective}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {model?.baseCurrency}
                  </span>
                  {model?.currentPlanVersion && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      <i className="fas fa-check-circle mr-1"></i>v
                      {model.currentPlanVersion}
                    </span>
                  )}
                </div>
                {model?.description && (
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {model.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="ml-4 text-sm text-invest-600 hover:text-invest-700 flex items-center"
              >
                <i className="fas fa-edit mr-1"></i>
                {t("edit", "Edit")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plans Section (for existing models) */}
      {!isNew && model && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
          <ModelPlans modelId={model.id} />
        </div>
      )}
    </div>
  )
}

export default withPageAuthRequired(ModelDetailPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
