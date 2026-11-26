import React, { useCallback, useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { assetKey, portfolioKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Asset, Portfolio, Transaction } from "types/beancounter"
import { getAssetCurrency, isAccount, isCash } from "@lib/assets/assetUtils"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { cashLadderKey, settledTradeKey } from "@utils/api/client/trns"
import Link from "next/link"
import { tradesHighlightHref } from "@lib/trns/trnLinks"
import {
  LadderPair,
  groupAutoSettleLegs,
  pairAutoSettleRows,
} from "@lib/trns/cashLadderPairs"
import { isAutoSettleLeg } from "@lib/trns/tradeUtils"
import { useTrnHighlight } from "@components/features/transactions/useTrnHighlight"
import {
  TrnCardValue,
  TrnColumn,
  TrnDeleteConfirm,
  TrnEmptyState,
  TrnNumberCell,
  TrnPageNav,
  TrnRowActions,
  TrnStatusBadge,
  TrnTableHead,
  TRN_DRILL_LINK,
} from "@components/features/transactions/TrnListParts"
import { useTrnListDelete } from "@components/features/transactions/useTrnListDelete"

const COLUMNS: TrnColumn[] = [
  { label: "Trade Date" },
  { label: "Type" },
  { label: "Description" },
  { label: "Cash", align: "right" },
  { label: "Balance", align: "right" },
  { label: "Status" },
  { label: "Actions", align: "center" },
]

// What a ladder row is, with its comment after it. A plain cash move says
// little more than its type, so its comment stands alone.
function formatTransaction(trn: Transaction): string {
  const base = baseDescription(trn)
  if (!trn.comments) return base
  if (trn.trnType === "DEPOSIT" || trn.trnType === "WITHDRAWAL")
    return trn.comments
  return `${base} · ${trn.comments}`
}

function baseDescription(trn: Transaction): string {
  const type = trn.trnType
  const assetName =
    trn.asset?.name || (trn.asset?.code ? trn.asset.displayCode : "")
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

/**
 * An auto-settle leg beside its trade says which trade it settles and which
 * way the cash moved: in from the funding portfolio for a buy, out to it for
 * a sell.
 */
function legDescription(
  leg: Transaction,
  pair: LadderPair,
  fundingCode: string | undefined,
): string {
  const settles = pair.adjacent
    ? `Settles this ${pair.trade.trnType}`
    : `Settles ${pair.trade.trnType} ${pair.trade.asset?.displayCode ?? ""}`.trim()
  if (!fundingCode) return settles
  const way = leg.trnType === "DEPOSIT" ? "from" : "to"
  return `${settles} · ${way} ${fundingCode}`
}

/**
 * What a ladder row says it is, as a way into the trade behind it: a trade's
 * row opens its asset's trades, an auto-settle leg opens the trade it settles.
 * A plain cash move has no trade behind it and stays text.
 */
function TrnDescription({
  trn,
  text,
  onOpenSettledTrade,
}: {
  trn: Transaction
  text: string
  onOpenSettledTrade: (leg: Transaction) => void
}): React.ReactElement {
  if (isAutoSettleLeg(trn))
    return (
      <button
        type="button"
        title={"Open the trade this settles"}
        onClick={(e) => {
          e.stopPropagation()
          onOpenSettledTrade(trn)
        }}
        className={`text-left ${TRN_DRILL_LINK}`}
      >
        {text}
      </button>
    )
  if (trn.asset && !isCash(trn.asset) && !isAccount(trn.asset))
    return (
      <Link
        href={tradesHighlightHref(trn.portfolio.id, trn.asset.id, trn.id)}
        title={"Open the trades"}
        className={TRN_DRILL_LINK}
      >
        {text}
      </Link>
    )
  return <>{text}</>
}

/**
 * Half a bracket in the description's left margin. The top row draws down
 * from its middle, the bottom row up to its middle, so the two halves meet
 * across the row divider.
 */
function PairBracket({
  edge,
  active,
}: {
  edge: LadderPair["edge"]
  active: boolean
}): React.ReactElement {
  const half =
    edge === "top"
      ? "top-1/2 bottom-0 border-t rounded-tl"
      : "top-0 bottom-1/2 border-b rounded-bl"
  return (
    <span
      aria-hidden="true"
      data-pair-edge={edge}
      className={`pointer-events-none absolute left-1.5 w-2 border-l ${half} ${active ? "border-blue-400" : "border-gray-300"}`}
    />
  )
}

// Type for transaction with running balance and signed cash amount
interface TrnWithBalance extends Transaction {
  runningBalance: number
  signedCashAmount: number
}

export default withPageAuthRequired(function CashLadder(): React.ReactElement {
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

  // The funding portfolio the auto-settle legs move cash to and from.
  const fundingId =
    portfolioData.data?.data?.cashPortfolioId ??
    portfolioData.data?.data?.owner?.cashPortfolioId
  const fundingData = useSwr<{ data: Portfolio }>(
    fundingId ? portfolioKey(fundingId) : null,
    fundingId ? simpleFetcher(portfolioKey(fundingId)) : null,
  )
  const fundingCode = fundingData.data?.data?.code

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

  // Calculate running balances.
  //
  // Trust the backend's order — svc-data sorts the cash-ladder query
  // by `tradeDate desc, createdAt desc` (V26 migration added the
  // `created_at` column for chronological tie-break). The algorithm
  // walks newest→oldest starting from the current total and subtracts
  // each trn to expose "balance immediately after this trn".
  const transactionsWithBalance = useMemo((): TrnWithBalance[] => {
    // Each auto-settle leg beside its trade; the balance walks this order.
    const trns = groupAutoSettleLegs(cashLadderData.data?.data || [])
    if (trns.length === 0 || !cashAssetId) return []

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

  useTrnHighlight(transactionsWithBalance.length > 0)

  // Each auto-settle leg beside the trade it settles; hovering either row of a
  // pair tints both.
  const pairs = useMemo(
    () => pairAutoSettleRows(transactionsWithBalance),
    [transactionsWithBalance],
  )
  const [hoveredPair, setHoveredPair] = useState<string | null>(null)
  const describe = (trn: Transaction): string => {
    const pair = pairs.get(trn.id)
    return pair && isAutoSettleLeg(trn)
      ? legDescription(trn, pair, fundingCode)
      : formatTransaction(trn)
  }
  const pairHover = (
    trn: Transaction,
  ): Pick<
    React.HTMLAttributes<HTMLElement>,
    "onMouseEnter" | "onMouseLeave"
  > => {
    const pair = pairs.get(trn.id)
    return pair
      ? {
          onMouseEnter: () => setHoveredPair(pair.tradeId),
          onMouseLeave: () => setHoveredPair(null),
        }
      : {}
  }
  const inHoveredPair = (trn: Transaction): boolean =>
    !!hoveredPair && pairs.get(trn.id)?.tradeId === hoveredPair

  // An auto-settle leg opens the trade it settles. Should that trade be gone,
  // the leg's own edit still opens, so it can be put right.
  const openSettledTrade = useCallback(
    async (leg: Transaction): Promise<void> => {
      try {
        const response = await fetch(settledTradeKey(leg.id))
        const trade: Transaction | undefined = response.ok
          ? (await response.json()).data?.[0]
          : undefined
        if (trade) {
          void router.push(
            tradesHighlightHref(trade.portfolio.id, trade.asset.id, trade.id),
          )
          return
        }
      } catch {
        // fall through to the leg's own edit
      }
      void router.push(`/trns/trades/edit/${leg.portfolio.id}/${leg.id}`)
    },
    [router],
  )

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
        trn.signedCashAmount.toFixed(2),
        trn.runningBalance.toFixed(2),
      ].join("\t")
      navigator.clipboard.writeText(row)
    },
    [],
  )

  const { deletePending, requestDelete, cancelDelete, confirmDelete } =
    useTrnListDelete(cashLadderData.mutate)

  // Loading states
  if (!router.isReady) {
    return rootLoader("Loading...")
  }

  if (!portfolioId || !cashAssetId) {
    return errorOut("Missing parameters", new Error("Missing parameters"))
  }

  if (cashLadderData.error) {
    return errorOut("Error loading cash ladder", cashLadderData.error)
  }

  if (
    cashLadderData.isLoading ||
    assetData.isLoading ||
    portfolioData.isLoading
  ) {
    return rootLoader("Loading...")
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
      <TrnPageNav title={assetName} subtitle={currencyCode} />

      {/* Page Title */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {"Cash Ladder"}
          </h1>
          <div className="text-gray-600">
            <span className="font-medium">{portfolio?.code}</span>
          </div>
        </div>

        {transactionsWithBalance.length === 0 ? (
          <TrnEmptyState />
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="md:hidden space-y-3">
              {transactionsWithBalance.map((trn: TrnWithBalance) => (
                <div
                  key={trn.id}
                  data-trn-id={trn.id}
                  {...pairHover(trn)}
                  className={`rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow ${inHoveredPair(trn) ? "bg-blue-50" : "bg-white"}${pairs.has(trn.id) ? " border-l-2 border-blue-200" : ""}`}
                  onDoubleClick={() => handleEditClick(trn)}
                  title={"Double-click to edit"}
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
                        <TrnDescription
                          trn={trn}
                          text={describe(trn)}
                          onOpenSettledTrade={(leg) =>
                            void openSettledTrade(leg)
                          }
                        />
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {trn.tradeDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <TrnCardValue
                      label={"Cash"}
                      value={trn.signedCashAmount}
                      scale={2}
                      prefix={trn.signedCashAmount >= 0 ? "+" : ""}
                      valueClassName={`ml-1 font-medium ${trn.signedCashAmount < 0 ? "text-red-600" : "text-green-700"}`}
                    />
                    <TrnCardValue
                      label={"Balance"}
                      value={trn.runningBalance}
                      scale={2}
                      valueClassName="ml-1 font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <TrnTableHead columns={COLUMNS} />
                <tbody className="divide-y divide-gray-200">
                  {transactionsWithBalance.map((trn: TrnWithBalance) => (
                    <tr
                      key={trn.id}
                      data-trn-id={trn.id}
                      {...pairHover(trn)}
                      className={`cursor-pointer transition-colors ${inHoveredPair(trn) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onDoubleClick={() => handleEditClick(trn)}
                      title={"Double-click to edit"}
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
                      <td className="relative px-4 py-3 whitespace-nowrap">
                        {pairs.get(trn.id)?.adjacent && (
                          <PairBracket
                            edge={pairs.get(trn.id)!.edge}
                            active={inHoveredPair(trn)}
                          />
                        )}
                        <TrnDescription
                          trn={trn}
                          text={describe(trn)}
                          onOpenSettledTrade={(leg) =>
                            void openSettledTrade(leg)
                          }
                        />
                      </td>
                      <TrnNumberCell
                        value={trn.signedCashAmount}
                        scale={2}
                        prefix={trn.signedCashAmount >= 0 ? "+" : ""}
                        className={`px-4 py-3 text-right whitespace-nowrap font-medium ${trn.signedCashAmount < 0 ? "text-red-600" : "text-green-700"}`}
                      />
                      <TrnNumberCell
                        value={trn.runningBalance}
                        scale={2}
                        className="px-4 py-3 text-right whitespace-nowrap font-bold"
                      />
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TrnStatusBadge status={trn.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <TrnRowActions
                          onEdit={() => handleEditClick(trn)}
                          onCopy={(e) => copyRowToClipboard(trn, e)}
                          onDelete={
                            // A cash move on a balance or bank account, not a trade.
                            // Deleting a spend withdrawal removes only the
                            // transaction; the month's spend stays, and its next
                            // save posts a new one.
                            isCash(trn.asset) || isAccount(trn.asset)
                              ? () => requestDelete(trn)
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {deletePending && (
        <TrnDeleteConfirm onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </div>
  )
})
