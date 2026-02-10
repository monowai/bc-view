import React, { useCallback, useMemo } from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { assetKey, portfolioKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useTranslation } from "next-i18next"
import { Asset, Portfolio, Transaction } from "types/beancounter"
import { getAssetCurrency, stripOwnerPrefix } from "@lib/assets/assetUtils"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"

// SWR key for cash ladder
function cashLadderKey(portfolioId: string, cashAssetId: string): string {
  return `/api/trns/portfolio/${portfolioId}/cash-ladder/${cashAssetId}`
}

// Format transaction description for cash ladder
// Priority: 1) transaction comments, 2) type-specific description with asset name
function formatTransaction(trn: Transaction): string {
  if (trn.comments) return trn.comments

  const type = trn.trnType
  const assetName =
    trn.asset?.name || (trn.asset?.code ? stripOwnerPrefix(trn.asset.code) : "")
  const qty = trn.quantity

  if (type === "DEPOSIT") return "Deposit"
  if (type === "WITHDRAWAL") return "Withdrawal"
  if (type === "FX" || type.startsWith("FX_")) {
    return `FX ${trn.tradeCurrency?.code || ""} to ${(trn.cashCurrency as any)?.code || ""}`
  }
  if (type === "DIVI") return `Dividend ${assetName}`
  if (type === "BUY") return `Buy ${qty} ${assetName}`
  if (type === "SELL") return `Sell ${qty} ${assetName}`
  if (type === "ADD") return `Add ${qty} ${assetName}`
  if (type === "REDUCE") return `Reduce ${qty} ${assetName}`
  if (type === "EXPENSE") return `Expense ${assetName}`
  if (type === "DEDUCTION") return `Deduction ${assetName}`
  if (type === "INCOME") return `Income ${assetName}`
  return `${type} ${assetName}`
}

// Type for transaction with running balance and signed cash amount
interface TrnWithBalance extends Transaction {
  runningBalance: number
  signedCashAmount: number
}

export default withPageAuthRequired(function CashLadder(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()

  // Parse params: [portfolioId, cashAssetId]
  const params = router.query.params as string[] | undefined
  const portfolioId = params?.[0]
  const cashAssetId = params?.[1]

  // Fetch portfolio details
  const portfolioData = useSwr<{ data: Portfolio }>(
    router.isReady && portfolioId ? portfolioKey(portfolioId) : null,
    router.isReady && portfolioId
      ? simpleFetcher(portfolioKey(portfolioId))
      : null,
  )

  // Fetch cash asset details
  const assetData = useSwr<{ data: Asset }>(
    router.isReady && cashAssetId ? assetKey(cashAssetId) : null,
    router.isReady && cashAssetId ? simpleFetcher(assetKey(cashAssetId)) : null,
  )

  // Fetch cash ladder transactions
  const cashLadderData = useSwr<{ data: Transaction[] }>(
    router.isReady && portfolioId && cashAssetId
      ? cashLadderKey(portfolioId, cashAssetId)
      : null,
    router.isReady && portfolioId && cashAssetId
      ? simpleFetcher(cashLadderKey(portfolioId, cashAssetId))
      : null,
  )

  // Get the cash impact matching svc-position logic
  // - DEPOSIT, WITHDRAWAL, DEDUCTION use quantity field (quantity=amount, price=1)
  // - INCOME uses tradeAmount field (quantity=1, price=amount)
  // - FX_BUY uses quantity when asset is the cash asset (credit to purchased currency)
  // - Other types (BUY, SELL, DIVI) use cashAmount field
  // Then enforce correct sign based on transaction type
  const getSignedCashAmount = useCallback(
    (trn: Transaction, queriedCashAssetId: string): number => {
      // Cash transaction types that store amount in quantity (quantity=amount, price=1)
      const quantityBasedCashTypes = ["DEPOSIT", "WITHDRAWAL", "DEDUCTION"]
      const isQuantityBasedCash = quantityBasedCashTypes.includes(trn.trnType)

      // INCOME stores amount differently (quantity=1, price=amount)
      const isIncome = trn.trnType === "INCOME"

      // FX_BUY: if asset.id matches the queried cash asset, this is a credit to that cash
      // The quantity is the amount of cash purchased
      const isFxBuyCredit =
        trn.trnType === "FX_BUY" && trn.asset?.id === queriedCashAssetId

      let rawAmount: number
      if (isIncome) {
        rawAmount = trn.tradeAmount
      } else if (isQuantityBasedCash || isFxBuyCredit) {
        rawAmount = trn.quantity
      } else {
        rawAmount = trn.cashAmount
      }

      // Transaction types that credit cash (increase balance)
      const creditTypes = ["DEPOSIT", "SELL", "DIVI", "INCOME"]

      // Enforce sign based on type (matching CashAccumulator logic)
      const amount = Math.abs(rawAmount)
      if (creditTypes.includes(trn.trnType) || isFxBuyCredit) {
        return amount // Credits are positive
      }
      return -amount // Debits are negative
    },
    [],
  )

  // Calculate running balances
  // Transactions are sorted desc (newest first)
  // Sum all cashAmounts to get current balance, then work backwards to show balance after each trn
  const transactionsWithBalance = useMemo((): TrnWithBalance[] => {
    const trns = cashLadderData.data?.data || []
    if (trns.length === 0 || !cashAssetId) return []

    // Calculate total balance from all transactions with enforced signs
    // Work backwards from total to show balance after each transaction
    let balance = trns.reduce(
      (sum, trn) => sum + getSignedCashAmount(trn, cashAssetId),
      0,
    )
    return trns.map((trn) => {
      const balanceAfterTrn = balance
      const signedAmount = getSignedCashAmount(trn, cashAssetId)
      balance -= signedAmount
      return {
        ...trn,
        runningBalance: balanceAfterTrn,
        signedCashAmount: signedAmount,
      }
    })
  }, [cashLadderData.data, getSignedCashAmount, cashAssetId])

  const handleEditClick = useCallback(
    (trn: Transaction) => {
      router.push(`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`)
    },
    [router],
  )

  // Copy row data to clipboard as tab-separated values
  const copyRowToClipboard = useCallback(
    (trn: TrnWithBalance, e: React.MouseEvent) => {
      e.stopPropagation() // Prevent row click
      const row = [
        trn.tradeDate,
        trn.trnType,
        formatTransaction(trn),
        trn.price.toFixed(2),
        trn.signedCashAmount.toFixed(2),
        trn.runningBalance.toFixed(2),
      ].join("\t")
      navigator.clipboard.writeText(row)
    },
    [],
  )

  // Loading states
  if (!router.isReady) {
    return rootLoader(t("loading"))
  }

  if (!portfolioId || !cashAssetId) {
    return errorOut(
      t("cash.ladder.error.params"),
      new Error("Missing parameters"),
    )
  }

  if (cashLadderData.error) {
    return errorOut(t("cash.ladder.error.fetch"), cashLadderData.error)
  }

  if (
    cashLadderData.isLoading ||
    assetData.isLoading ||
    portfolioData.isLoading
  ) {
    return rootLoader(t("loading"))
  }

  const cashAsset = assetData.data?.data
  const portfolio = portfolioData.data?.data
  const assetName = cashAsset?.name || cashAsset?.code || "Cash"
  const currencyCode =
    (cashAsset ? getAssetCurrency(cashAsset) : "") ||
    cashAsset?.code ||
    portfolio?.currency?.code ||
    ""

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
              {assetName}
              <span className="text-gray-500 text-sm ml-2">{currencyCode}</span>
            </div>
            <div className="w-16"></div>
          </div>
        </div>
      </nav>

      {/* Page Title */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {t("cash.ladder.title") || "Cash Ladder"}
          </h1>
          <div className="text-gray-600">
            <span className="font-medium">{portfolio?.code}</span>
          </div>
        </div>

        {transactionsWithBalance.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {t("trn.noTransactions") || "No transactions found"}
            </p>
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
              {transactionsWithBalance.map((trn: TrnWithBalance) => (
                <div
                  key={trn.id}
                  className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
                  onDoubleClick={() => handleEditClick(trn)}
                  title={t("actions.doubleClickToEdit")}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          trn.trnType === "BUY" ||
                          trn.trnType === "WITHDRAWAL" ||
                          trn.trnType === "REDUCE"
                            ? "bg-red-100 text-red-800"
                            : trn.trnType === "SELL" ||
                                trn.trnType === "DEPOSIT" ||
                                trn.trnType === "DIVI"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {trn.trnType}
                      </span>
                      <span className="ml-2 text-sm text-gray-700">
                        {formatTransaction(trn)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {trn.tradeDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">
                        {t("trn.amount.cash") || "Amount"}:
                      </span>
                      <span
                        className={`ml-1 font-medium ${trn.signedCashAmount < 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        <NumericFormat
                          value={trn.signedCashAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                          prefix={trn.signedCashAmount >= 0 ? "+" : ""}
                        />
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("cash.ladder.balance") || "Balance"}:
                      </span>
                      <span className="ml-1 font-bold">
                        <NumericFormat
                          value={trn.runningBalance}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
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
                      {t("trn.tradeDate") || "Date"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.type") || "Type"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("description") || "Description"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("trn.price") || "Price"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("trn.amount.cash") || "Amount"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("cash.ladder.balance") || "Balance"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("trn.status") || "Status"}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      {t("actions") || "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactionsWithBalance.map((trn: TrnWithBalance) => (
                    <tr
                      key={trn.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onDoubleClick={() => handleEditClick(trn)}
                      title={t("actions.doubleClickToEdit")}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.tradeDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.trnType === "BUY" ||
                            trn.trnType === "WITHDRAWAL" ||
                            trn.trnType === "REDUCE" ||
                            trn.trnType === "EXPENSE" ||
                            trn.trnType === "DEDUCTION"
                              ? "bg-red-100 text-red-800"
                              : trn.trnType === "SELL" ||
                                  trn.trnType === "DEPOSIT" ||
                                  trn.trnType === "DIVI" ||
                                  trn.trnType === "INCOME"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {trn.trnType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTransaction(trn)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {trn.price > 0 && (
                          <NumericFormat
                            value={trn.price}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap font-medium ${trn.signedCashAmount < 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        <NumericFormat
                          value={trn.signedCashAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                          prefix={trn.signedCashAmount >= 0 ? "+" : ""}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-bold">
                        <NumericFormat
                          value={trn.runningBalance}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
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
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={(e) => copyRowToClipboard(trn, e)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title={t("copy") || "Copy"}
                        >
                          <i className="fas fa-copy"></i>
                        </button>
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
