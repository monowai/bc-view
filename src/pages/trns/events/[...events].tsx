import React from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { useTranslation } from "next-i18next"
import Link from "next/link"
import { Transaction } from "types/beancounter"
import useSwr from "swr"
import { errorOut } from "@components/errors/ErrorOut"
import { assetKey, eventKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { deleteTrn } from "@lib/trns/apiHelper"

export default withPageAuthRequired(function Events(): React.ReactElement {
  const router = useRouter()
  const { t } = useTranslation("common")

  // Extract query params - safe to access even before router is ready (will be undefined)
  const eventsParam = router.query.events as string[] | undefined
  const portfolioId = eventsParam ? eventsParam[0] : undefined
  const assetId = eventsParam ? eventsParam[1] : undefined

  // Fetch asset and events - only when router is ready and we have valid params
  const asset = useSwr(
    router.isReady && assetId ? assetKey(assetId) : null,
    router.isReady && assetId ? simpleFetcher(assetKey(assetId)) : null,
  )
  const events = useSwr(
    router.isReady && portfolioId && assetId
      ? eventKey(portfolioId, assetId)
      : null,
    router.isReady && portfolioId && assetId
      ? simpleFetcher(eventKey(portfolioId, assetId))
      : null,
  )

  // Wait for router to be ready (query params available) during client-side navigation
  if (!router.isReady) {
    return rootLoader(t("loading"))
  }
  if (events.error) {
    return errorOut(t("events.error.retrieve"), events.error)
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error)
  }
  if (asset.isLoading) {
    return rootLoader(t("loading"))
  }
  if (events.isLoading) {
    return rootLoader(t("loading"))
  }
  const trnResults = events.data.data
  if (!trnResults || trnResults.length === 0) {
    return <div id="root">{t("trn.noTransactions")}</div>
  }

  return (
    <div>
      <nav className="container mx-auto p-4">
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">
            {asset.data.data.name}:{asset.data.data.market.code}
          </div>
        </div>
      </nav>
      <div className="bg-gray-100 p-4 rounded-lg shadow-md">
        <div className="container mx-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="px-4 py-2">{t("trn.type")}</th>
                <th className="px-4 py-2">{t("trn.currency")}</th>
                <th className="px-4 py-2">{t("trn.tradeDate")}</th>
                <th className="px-4 py-2 text-right">{t("event.amount")}</th>
                <th className="px-4 py-2 text-right">{t("trn.amount.tax")}</th>
                <th className="px-4 py-2 text-right">{t("event.quantity")}</th>
                <th className="px-4 py-2 text-right">{t("event.price")}</th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tb")}</th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tc")}</th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tp")}</th>
                <th className="px-4 py-2 text-right">{t("trn.action")}</th>
              </tr>
            </thead>
            <tbody>
              {trnResults.map((trn: Transaction) => (
                <tr key={trn.id}>
                  <td className="px-4 py-2">{trn.trnType}</td>
                  <td className="px-4 py-2">{trn.tradeCurrency.code}</td>
                  <td className="px-4 py-2">{trn.tradeDate}</td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.tax}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={0}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.price}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.tradeBaseRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.tradeCashRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.tradePortfolioRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-2 text-left">
                    <Link
                      href={`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <i className="fa fa-edit"></i>
                    </Link>
                    <button
                      onClick={() => deleteTrn(trn.id, t("trn.delete"))}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <i className="fa fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
