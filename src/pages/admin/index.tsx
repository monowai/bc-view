import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"

interface AdminCard {
  title: string
  description: string
  href: string
  icon: string
}

export default withPageAuthRequired(function AdminPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { isAdmin, isLoading } = useIsAdmin()

  if (!ready || isLoading) {
    return rootLoader(t("loading"))
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
          <h1 className="text-xl font-semibold text-red-700 mb-2">
            {t("admin.accessDenied.title", "Access Denied")}
          </h1>
          <p className="text-red-600">
            {t(
              "admin.accessDenied.message",
              "You do not have permission to access the admin area.",
            )}
          </p>
          <Link
            href="/portfolios"
            className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            {t("admin.accessDenied.goBack", "Return to Portfolios")}
          </Link>
        </div>
      </div>
    )
  }

  const adminCards: AdminCard[] = [
    {
      title: t("admin.cards.services.title", "Service Status"),
      description: t(
        "admin.cards.services.description",
        "Monitor health and version of all backend services.",
      ),
      href: "/admin/services",
      icon: "fa-server",
    },
    {
      title: t("admin.cards.classifications.title", "Asset Classifications"),
      description: t(
        "admin.cards.classifications.description",
        "Manage sector classifications for assets. Assign custom sectors to group holdings.",
      ),
      href: "/admin/classifications",
      icon: "fa-tags",
    },
    {
      title: t("admin.cards.assets.title", "Asset Admin"),
      description: t(
        "admin.cards.assets.description",
        "Search for any asset and manage its name, status, and enrichment.",
      ),
      href: "/admin/assets",
      icon: "fa-cubes",
    },
    {
      title: t("admin.cards.accountingTypes.title", "Accounting Types"),
      description: t(
        "admin.cards.accountingTypes.description",
        "Manage accounting types: board lots, settlement days, and category-currency mappings.",
      ),
      href: "/admin/accounting-types",
      icon: "fa-receipt",
    },
    {
      title: t("admin.cards.scenarios.title", "Quick Scenarios"),
      description: t(
        "admin.cards.scenarios.description",
        "Manage What-If scenario presets for retirement planning.",
      ),
      href: "/admin/scenarios",
      icon: "fa-sliders-h",
    },
    {
      title: t("admin.cards.tasks.title", "Scheduled Tasks"),
      description: t(
        "admin.cards.tasks.description",
        "Run background jobs manually: refresh prices, update classifications, process events.",
      ),
      href: "/admin/tasks",
      icon: "fa-clock",
    },
  ]

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.title", "Administration")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("admin.description", "Manage system settings and data")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <i className={`fas ${card.icon} text-blue-500 text-xl`}></i>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h2>
                <p className="text-gray-600 text-sm mt-1">{card.description}</p>
              </div>
              <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
                <i className="fas fa-chevron-right"></i>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
