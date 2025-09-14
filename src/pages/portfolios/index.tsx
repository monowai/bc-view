import React, { useState, useMemo } from "react"
import useSwr from "swr"
import { UserProfile, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { Portfolio } from "types/beancounter"
import Link from "next/link"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import errorOut from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import { FormatValue } from "@components/ui/MoneyUtils"

type SortConfig = {
  key: string | null
  direction: 'asc' | 'desc'
}

const CreatePortfolioButton = (): React.ReactElement<HTMLButtonElement> => {
  const router = useRouter()
  const { t } = useTranslation("common")

  return (
    <button
      className="bg-blue-500 text-white py-2 px-4 rounded"
      onClick={async () => {
        await router.push(`/portfolios/__NEW__`)
      }}
    >
      {t("portfolio.create")}
    </button>
  )
}

export default withPageAuthRequired(function Portfolios({
  user,
}: UserProfile): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { data, mutate, error } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  
  // Sort configuration state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'code', direction: 'asc' })

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        // Toggle direction for the same column
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      // New column clicked - start with DESC for better UX (except for code which should be ASC)
      return {
        key,
        direction: key === 'code' ? 'asc' : 'desc'
      }
    })
  }

  // Sort portfolios
  const sortedPortfolios = useMemo(() => {
    if (!data?.data) return []
    
    const portfolios = [...data.data]
    if (!sortConfig.key) return portfolios

    return portfolios.sort((a, b) => {
      let aValue: string | number = ""
      let bValue: string | number = ""

      switch (sortConfig.key) {
        case 'code':
          aValue = a.code.toLowerCase()
          bValue = b.code.toLowerCase()
          break
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'currency':
          aValue = a.currency.code.toLowerCase()
          bValue = b.currency.code.toLowerCase()
          break
        case 'base':
          aValue = a.base.code.toLowerCase()
          bValue = b.base.code.toLowerCase()
          break
        case 'marketValue':
          aValue = a.marketValue || 0
          bValue = b.marketValue || 0
          break
        case 'irr':
          aValue = a.irr || 0
          bValue = b.irr || 0
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue)
        return sortConfig.direction === 'asc' ? result : -result
      }
      const result = (aValue as number) - (bValue as number)
      return sortConfig.direction === 'asc' ? result : -result
    })
  }, [data?.data, sortConfig.key, sortConfig.direction])

  if (error) {
    return errorOut(t("portfolios.error.retrieve"), error)
  }

  if (!user) {
    return rootLoader(t("loading"))
  }

  async function deletePortfolio(
    portfolioId: string,
    message: string,
  ): Promise<void> {
    if (window.confirm(message)) {
      try {
        await fetch(`/api/portfolios/${portfolioId}`, {
          method: "DELETE",
        })
        await mutate({ ...data })
        await router.push("/portfolios", "/portfolios", {
          shallow: true,
        })
      } catch (error) {
        console.error("Failed to delete portfolio:", error)
      }
    }
  }

  // Sort icon component
  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (!sortConfig || sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">↕</span>
    }
    return sortConfig.direction === 'asc' 
      ? <span className="ml-1 text-blue-300">↑</span>
      : <span className="ml-1 text-blue-300">↓</span>
  }

  function listPortfolios(portfolios: Portfolio[]): React.ReactElement {
    if (!portfolios || portfolios.length == 0) {
      return (
        <div className="w-full py-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-gray-600 mb-4">{t("error.portfolios.empty")}</div>
            <CreatePortfolioButton />
          </div>
        </div>
      )
    }
    
    return (
      <div className="w-full py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{t("portfolios.title", "Portfolios")}</h1>
          <CreatePortfolioButton />
        </div>
        
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr className="border-b border-gray-200">
                <th 
                  className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center">
                    {t("portfolio.code")}
                    {getSortIcon('code')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    {t("portfolio.name")}
                    {getSortIcon('name')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none hidden md:table-cell"
                  onClick={() => handleSort('currency')}
                >
                  <div className="flex items-center">
                    {t("portfolio.currency.report")}
                    {getSortIcon('currency')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none hidden lg:table-cell"
                  onClick={() => handleSort('base')}
                >
                  <div className="flex items-center">
                    {t("portfolio.currency.base")}
                    {getSortIcon('base')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('marketValue')}
                >
                  <div className="flex items-center justify-end">
                    {t("portfolio.marketvalue")}
                    {getSortIcon('marketValue')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs sm:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none hidden sm:table-cell"
                  onClick={() => handleSort('irr')}
                >
                  <div className="flex items-center justify-end">
                    {t("portfolio.irr")}
                    {getSortIcon('irr')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs sm:text-sm font-medium text-gray-700">
                  {t("portfolio.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {portfolios.map((portfolio) => (
                <tr 
                  key={portfolio.id} 
                  className="hover:!bg-slate-200 transition-colors duration-200 cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking on action buttons
                    if (!(e.target as HTMLElement).closest('.action-buttons')) {
                      router.push(`/holdings/${portfolio.code}`)
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <span className="text-blue-600 font-medium">
                      {portfolio.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{portfolio.name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {portfolio.currency.symbol}{portfolio.currency.code}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                    {portfolio.base.symbol}{portfolio.base.code}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    <FormatValue
                      value={portfolio.marketValue ? portfolio.marketValue : 0}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 hidden sm:table-cell">
                    <FormatValue value={portfolio.irr} multiplier={100} />%
                  </td>
                  <td className="px-4 py-3">
                    <div className="action-buttons flex items-center justify-center space-x-2">
                      <Link
                        href={`/portfolios/${portfolio.id}`}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title={t("portfolio.edit", "Edit Portfolio")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="far fa-edit text-lg"></span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePortfolio(
                            portfolio.id,
                            t("portfolio.delete", { code: portfolio.code }),
                          )
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={t("portfolio.delete.title", "Delete Portfolio")}
                      >
                        <span className="far fa-trash-alt text-lg"></span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (!data || !ready) {
    return rootLoader(t("loading"))
  }
  // Use the user variable somewhere in your component
  return listPortfolios(sortedPortfolios)
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
