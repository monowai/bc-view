import React from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { assetKey, simpleFetcher, tradeKey } from "@utils/api/fetchHelper"
import { useTranslation } from "next-i18next"
import Link from "next/link"
import { Transaction } from "types/beancounter"
import { rootLoader } from "@components/ui/PageLoader"
import errorOut from "@components/errors/ErrorOut"
import useSwr from "swr"
import { deleteTrn } from "@lib/trns/apiHelper"

export default withPageAuthRequired(function Events(): React.ReactElement {
  const { t } = useTranslation("common")

  const router = useRouter()
  const portfolioId = router.query.trades ? router.query.trades[0] : "undefined"
  const assetId = router.query.trades ? router.query.trades[1] : "undefined"
  const asset = useSwr(assetKey(assetId), simpleFetcher(assetKey(assetId)))
  const trades = useSwr(
    tradeKey(portfolioId, assetId),
    simpleFetcher(tradeKey(portfolioId, assetId)),
  )
  if (trades.error) {
    return errorOut(t("trades.error.retrieve"), trades.error)
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error)
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader(t("loading"))
  }
  const trnResults = trades.data.data
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
                <th className="px-4 py-2 text-right">{t("quantity")}</th>
                <th className="px-4 py-2 text-right">{t("trn.price")}</th>
                <th className="px-4 py-2 text-right">
                  {t("trn.amount.trade")}
                </th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tb")}</th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tc")}</th>
                <th className="px-4 py-2 text-right">{t("trn.rate.tp")}</th>
                <th className="px-4 py-2 text-right">{t("trn.amount.cash")}</th>
                <th className="px-4 py-2 text-right">{t("trn.amount.tax")}</th>
                <th className="px-4 py-2 text-right">
                  {t("trn.amount.charges")}
                </th>
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
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
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
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={0}
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
                  <td className="px-4 py-2 text-right">
                    <NumericFormat
                      value={trn.cashAmount}
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
                      value={trn.fees}
                      displayType={"text"}
                      decimalScale={2}
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
