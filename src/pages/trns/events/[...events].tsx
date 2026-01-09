import React from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { useTranslation } from "next-i18next"
import { Transaction } from "types/beancounter"
import useSwr from "swr"
import { errorOut } from "@components/errors/ErrorOut"
import { assetKey, eventKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"

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
  const hasEvents = trnResults && trnResults.length > 0

  return (
    <div className="min-h-screen bg-gray-50 text-sm">
      {/* Header with back button */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <i className="fa fa-arrow-left mr-2"></i>
              <span className="hidden sm:inline">{t("back")}</span>
            </button>
            <div className="flex-1 text-lg font-semibold text-center truncate">
              {asset.data.data.name}
              <span className="text-gray-500 text-sm ml-2">
                {asset.data.data.market.code}
              </span>
            </div>
            <div className="w-16"></div>
          </div>
        </div>
      </nav>

      {/* Tabs for switching between Trades and Events */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex">
            <button
              className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
              onClick={() =>
                router.replace(`/trns/trades/${portfolioId}/${assetId}`)
              }
            >
              {t("trades")}
            </button>
            <button
              className="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
              onClick={() =>
                router.replace(`/trns/events/${portfolioId}/${assetId}`)
              }
            >
              {t("events")}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        {!hasEvents ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">{t("trn.noTransactions")}</p>
            <button
              onClick={() => router.back()}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
            >
              <i className="fa fa-arrow-left mr-2"></i>
              {t("back")}
            </button>
          </div>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="md:hidden space-y-3">
              {trnResults.map((trn: Transaction) => (
                <div
                  key={trn.id}
                  className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
                  onDoubleClick={() =>
                    router.push(
                      `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                    )
                  }
                  title={t("actions.doubleClickToEdit")}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {trn.trnType}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        {trn.tradeCurrency.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          trn.status === "SETTLED"
                            ? "bg-green-100 text-green-800"
                            : trn.status === "PROPOSED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {trn.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {trn.tradeDate}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">
                        {t("event.amount")}:
                      </span>
                      <span className="ml-1 font-medium">
                        <NumericFormat
                          value={trn.tradeAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("event.quantity")}:
                      </span>
                      <span className="ml-1 font-medium">
                        <NumericFormat
                          value={trn.quantity}
                          displayType={"text"}
                          decimalScale={0}
                          thousandSeparator={true}
                        />
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t("event.price")}:</span>
                      <span className="ml-1 font-medium">
                        <NumericFormat
                          value={trn.price}
                          displayType={"text"}
                          decimalScale={2}
                          thousandSeparator={true}
                        />
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("trn.amount.tax")}:
                      </span>
                      <span className="ml-1 font-medium">
                        <NumericFormat
                          value={trn.tax}
                          displayType={"text"}
                          decimalScale={2}
                          thousandSeparator={true}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.type")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.currency")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.tradeDate")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("event.amount")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("trn.amount.tax")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("event.quantity")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("event.price")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.settlement.account")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trnResults.map((trn: Transaction) => (
                    <tr
                      key={trn.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onDoubleClick={() =>
                        router.push(
                          `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                        )
                      }
                      title={t("actions.doubleClickToEdit")}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.trnType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.tradeCurrency.code}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.tradeDate}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <NumericFormat
                          value={trn.tradeAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <NumericFormat
                          value={trn.tax}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <NumericFormat
                          value={trn.quantity}
                          displayType={"text"}
                          decimalScale={0}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <NumericFormat
                          value={trn.price}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {["ADD", "REDUCE", "SPLIT"].includes(trn.trnType)
                          ? "-"
                          : trn.cashAsset?.market?.code === "CASH"
                            ? trn.cashAsset.name ||
                              `${trn.cashAsset.code} Balance`
                            : trn.cashAsset?.name ||
                              trn.cashAsset?.code ||
                              `${(trn.cashCurrency as any)?.code || trn.tradeCurrency?.code} Balance`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.status === "SETTLED"
                              ? "bg-green-100 text-green-800"
                              : trn.status === "PROPOSED"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {trn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
