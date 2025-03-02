import React from "react"
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
import { rootLoader } from "@components/PageLoader"
import { FormatValue } from "@components/MoneyUtils"

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

  function listPortfolios(portfolios: Portfolio[]): React.ReactElement {
    if (!portfolios || portfolios.length == 0) {
      return (
        <nav className="container bg-gray-200 p-4">
          <div id="root">{t("error.portfolios.empty")}</div>
          <div className="mt-4">
            <CreatePortfolioButton />
          </div>
        </nav>
      )
    }
    return (
      <div>
        <nav className="container p-4">
          <div className="mt-1">
            <CreatePortfolioButton />
          </div>
        </nav>
        <div className="bg-gray-100 p-4 rounded">
          <div className="container">
            <table className="table-auto w-full bg-white shadow-md rounded">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-2 text-left">{t("portfolio.code")}</th>
                  <th className="px-4 py-2 text-left">{t("portfolio.name")}</th>
                  <th className="px-4 py-2 text-left">
                    {t("portfolio.currency.report")}
                  </th>
                  <th className="px-4 py-2 text-left">
                    {t("portfolio.currency.base")}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {t("portfolio.marketvalue")}
                  </th>
                  <th className="px-4 py-2 text-right">{t("portfolio.irr")}</th>
                  <th className="px-4 py-2 text-center">
                    {t("portfolio.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map((portfolio) => (
                  <tr key={portfolio.id} className="border-t hover:bg-gray-100">
                    <td className="px-4 py-2">
                      <Link
                        rel="preload"
                        href={`/holdings/${portfolio.code}`}
                        legacyBehavior
                      >
                        {portfolio.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{portfolio.name}</td>
                    <td className="px-4 py-2">
                      {portfolio.currency.symbol}
                      {portfolio.currency.code}
                    </td>
                    <td className="px-4 py-2">
                      {portfolio.base.symbol}
                      {portfolio.base.code}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FormatValue
                        value={
                          portfolio.marketValue ? portfolio.marketValue : " "
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FormatValue value={portfolio.irr} multiplier={100} />
                      {"%"}
                    </td>
                    <td className="px-4 py-2 flex items-center justify-center">
                      <Link
                        href={`/portfolios/${portfolio.id}`}
                        className="far fa-edit text-blue-500 hover:text-blue-700"
                        legacyBehavior
                      ></Link>
                      <span className="mx-2"></span>
                      <a
                        onClick={() =>
                          deletePortfolio(
                            portfolio.id,
                            t("portfolio.delete", { code: portfolio.code }),
                          )
                        }
                        className="far fa-trash-alt text-red-500 hover:text-red-700 cursor-pointer"
                      ></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !ready) {
    return rootLoader(t("loading"))
  }
  // Use the user variable somewhere in your component
  return listPortfolios(data.data)
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
