import React, { useCallback, useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import {
  assetKey,
  optionalFetcher,
  portfolioKey,
  simpleFetcher,
} from "@utils/api/fetchHelper"
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
  LadderRow,
  buildLadderRows,
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
  const funding = fundingSuffix(leg, fundingCode)
  return funding ? `${settles} ${funding}` : settles
}

/** Which way a leg moved cash, and with which funding portfolio. */
function fundingSuffix(
  leg: Transaction,
  fundingCode: string | undefined,
): string | undefined {
  if (!fundingCode) return undefined
  return `· ${leg.trnType === "DEPOSIT" ? "from" : "to"} ${fundingCode}`
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
  onOpenSettledTrade: (leg: Transaction) => unknown
}): React.ReactElement {
  if (isAutoSettleLeg(trn))
    return (
      <button
        type="button"
        title={"Open the trade this settles"}
        onClick={(e) => {
          e.stopPropagation()
          void onOpenSettledTrade(trn)
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

const DEBIT_TYPES = ["BUY", "WITHDRAWAL", "REDUCE", "EXPENSE", "DEDUCTION"]
const CREDIT_TYPES = ["SELL", "DEPOSIT", "DIVI", "INCOME"]

function TypeBadge({ trnType }: { trnType: string }): React.ReactElement {
  const tone = DEBIT_TYPES.includes(trnType)
    ? "bg-red-100 text-red-800"
    : CREDIT_TYPES.includes(trnType)
      ? "bg-green-100 text-green-800"
      : "bg-blue-100 text-blue-800"
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-medium rounded ${tone}`}
    >
      {trnType}
    </span>
  )
}

/** Opens a folded trade + leg pair into its two entries, and closes it. */
function PairToggle({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? "Hide the entries" : "Show both entries"}
      title={open ? "Hide the entries" : "Show both entries"}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <i
        className={`fas fa-chevron-right text-[10px] transition-transform ${open ? "rotate-90" : ""}`}
        aria-hidden="true"
      ></i>
    </button>
  )
}

/**
 * A folded pair's description: the toggle that opens it, the trade's
 * description and where its cash came from.
 */
function PairDescription({
  trade,
  leg,
  fundingCode,
  onToggle,
  onOpenSettledTrade,
}: {
  trade: Transaction
  leg: Transaction
  fundingCode: string | undefined
  onToggle: () => void
  onOpenSettledTrade: (leg: Transaction) => unknown
}): React.ReactElement {
  const funding = fundingSuffix(leg, fundingCode)
  return (
    <span className="inline-flex items-center gap-1.5">
      <PairToggle open={false} onToggle={onToggle} />
      <TrnDescription
        trn={trade}
        text={formatTransaction(trade)}
        onOpenSettledTrade={onOpenSettledTrade}
      />
      {funding && <span className="text-gray-500">{funding}</span>}
    </span>
  )
}

/**
 * An entry's description. The top entry of an open pair carries the toggle
 * that folds it again, and the bottom one keeps its place so both line up.
 */
function EntryDescription({
  trn,
  pair,
  text,
  onToggle,
  onOpenSettledTrade,
}: {
  trn: Transaction
  pair: LadderPair | undefined
  text: string
  onToggle: () => void
  onOpenSettledTrade: (leg: Transaction) => unknown
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      {pair?.adjacent &&
        (pair.edge === "top" ? (
          <PairToggle open onToggle={onToggle} />
        ) : (
          <span className="w-5 shrink-0" />
        ))}
      <TrnDescription
        trn={trn}
        text={text}
        onOpenSettledTrade={onOpenSettledTrade}
      />
    </span>
  )
}

/** Cash in green, out in red, none in gray. */
const cashTone = (amount: number): string =>
  Math.abs(amount) < 0.005
    ? "text-gray-600"
    : amount < 0
      ? "text-red-600"
      : "text-green-700"

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
  const describe = (trn: Transaction, pair?: LadderPair): string =>
    pair && isAutoSettleLeg(trn)
      ? legDescription(trn, pair, fundingCode)
      : formatTransaction(trn)
  const pairHover = (
    pair?: LadderPair,
  ): Pick<
    React.HTMLAttributes<HTMLElement>,
    "onMouseEnter" | "onMouseLeave"
  > =>
    pair
      ? {
          onMouseEnter: () => setHoveredPair(pair.trade.id),
          onMouseLeave: () => setHoveredPair(null),
        }
      : {}
  const inHoveredPair = (pair?: LadderPair): boolean =>
    !!hoveredPair && pair?.trade.id === hoveredPair

  // A trade and its leg show as one line, the trade's description against
  // the leg, until opened.
  const [openPairs, setOpenPairs] = useState<Set<string>>(() => new Set())
  const togglePair = (tradeId: string): void =>
    setOpenPairs((prev) => {
      const next = new Set(prev)
      if (next.has(tradeId)) next.delete(tradeId)
      else next.add(tradeId)
      return next
    })
  const ladderRows: LadderRow<TrnWithBalance>[] = useMemo(
    () => buildLadderRows(transactionsWithBalance, pairs, openPairs),
    [transactionsWithBalance, pairs, openPairs],
  )

  // An auto-settle leg opens the trade it settles. Should that trade be gone,
  // the leg's own edit still opens, so it can be put right.
  const openSettledTrade = useCallback(
    async (leg: Transaction): Promise<void> => {
      const found = await optionalFetcher(settledTradeKey(leg.id))()
      const trade: Transaction | undefined = found?.data?.[0]
      void router.push(
        trade
          ? tradesHighlightHref(trade.portfolio.id, trade.asset.id, trade.id)
          : `/trns/trades/edit/${leg.portfolio.id}/${leg.id}`,
      )
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
              {ladderRows.map((row) =>
                row.kind === "pair" ? (
                  <div
                    key={row.top.id}
                    data-trn-id={row.leg.id}
                    data-trn-ids={`${row.leg.id} ${row.trade.id}`}
                    className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
                    onDoubleClick={() => handleEditClick(row.trade)}
                    title={"Double-click to edit the trade"}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-1 items-center gap-2">
                        <TypeBadge trnType={row.leg.trnType} />
                        <span className="text-sm text-gray-700">
                          <PairDescription
                            trade={row.trade}
                            leg={row.leg}
                            fundingCode={fundingCode}
                            onToggle={() => togglePair(row.trade.id)}
                            onOpenSettledTrade={openSettledTrade}
                          />
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {row.trade.tradeDate}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <TrnCardValue
                        label={"Cash"}
                        value={Math.abs(row.trade.signedCashAmount)}
                        scale={2}
                        valueClassName="ml-1 font-medium text-gray-600"
                      />
                      <TrnCardValue
                        label={"Balance"}
                        value={row.top.runningBalance}
                        scale={2}
                        valueClassName="ml-1 font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.trn.id}
                    data-trn-id={row.trn.id}
                    {...pairHover(row.pair)}
                    className={`rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow ${inHoveredPair(row.pair) ? "bg-blue-50" : "bg-white"}${row.pair ? " border-l-2 border-blue-200" : ""}`}
                    onDoubleClick={() => handleEditClick(row.trn)}
                    title={"Double-click to edit"}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-1 items-center gap-2">
                        <TypeBadge trnType={row.trn.trnType} />
                        <span className="text-sm text-gray-700">
                          <EntryDescription
                            trn={row.trn}
                            pair={row.pair}
                            text={describe(row.trn, row.pair)}
                            onToggle={() =>
                              row.pair && togglePair(row.pair.trade.id)
                            }
                            onOpenSettledTrade={openSettledTrade}
                          />
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {row.trn.tradeDate}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <TrnCardValue
                        label={"Cash"}
                        value={row.trn.signedCashAmount}
                        scale={2}
                        prefix={row.trn.signedCashAmount >= 0 ? "+" : ""}
                        valueClassName={`ml-1 font-medium ${cashTone(row.trn.signedCashAmount)}`}
                      />
                      <TrnCardValue
                        label={"Balance"}
                        value={row.trn.runningBalance}
                        scale={2}
                        valueClassName="ml-1 font-bold"
                      />
                    </div>
                  </div>
                ),
              )}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <TrnTableHead columns={COLUMNS} />
                <tbody className="divide-y divide-gray-200">
                  {ladderRows.map((row) =>
                    row.kind === "pair" ? (
                      <tr
                        key={row.top.id}
                        data-trn-id={row.leg.id}
                        data-trn-ids={`${row.leg.id} ${row.trade.id}`}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onDoubleClick={() => handleEditClick(row.trade)}
                        title={"Double-click to edit the trade"}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.trade.tradeDate}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TypeBadge trnType={row.leg.trnType} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PairDescription
                            trade={row.trade}
                            leg={row.leg}
                            fundingCode={fundingCode}
                            onToggle={() => togglePair(row.trade.id)}
                            onOpenSettledTrade={openSettledTrade}
                          />
                        </td>
                        <TrnNumberCell
                          value={Math.abs(row.trade.signedCashAmount)}
                          scale={2}
                          className="px-4 py-3 text-right whitespace-nowrap font-medium text-gray-600"
                        />
                        <TrnNumberCell
                          value={row.top.runningBalance}
                          scale={2}
                          className="px-4 py-3 text-right whitespace-nowrap font-bold"
                        />
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TrnStatusBadge status={row.trade.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <TrnRowActions
                            onEdit={() => handleEditClick(row.trade)}
                            onCopy={(e) => copyRowToClipboard(row.trade, e)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={row.trn.id}
                        data-trn-id={row.trn.id}
                        {...pairHover(row.pair)}
                        className={`cursor-pointer transition-colors ${inHoveredPair(row.pair) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onDoubleClick={() => handleEditClick(row.trn)}
                        title={"Double-click to edit"}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.trn.tradeDate}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TypeBadge trnType={row.trn.trnType} />
                        </td>
                        <td className="relative px-4 py-3 whitespace-nowrap">
                          {row.pair?.adjacent && (
                            <PairBracket
                              edge={row.pair.edge}
                              active={inHoveredPair(row.pair)}
                            />
                          )}
                          <EntryDescription
                            trn={row.trn}
                            pair={row.pair}
                            text={describe(row.trn, row.pair)}
                            onToggle={() =>
                              row.pair && togglePair(row.pair.trade.id)
                            }
                            onOpenSettledTrade={openSettledTrade}
                          />
                        </td>
                        <TrnNumberCell
                          value={row.trn.signedCashAmount}
                          scale={2}
                          prefix={row.trn.signedCashAmount >= 0 ? "+" : ""}
                          className={`px-4 py-3 text-right whitespace-nowrap font-medium ${cashTone(row.trn.signedCashAmount)}`}
                        />
                        <TrnNumberCell
                          value={row.trn.runningBalance}
                          scale={2}
                          className="px-4 py-3 text-right whitespace-nowrap font-bold"
                        />
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TrnStatusBadge status={row.trn.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <TrnRowActions
                            onEdit={() => handleEditClick(row.trn)}
                            onCopy={(e) => copyRowToClipboard(row.trn, e)}
                            onDelete={
                              // A cash move on a balance or bank account, not a trade.
                              // Deleting a spend withdrawal removes only the
                              // transaction; the month's spend stays, and its next
                              // save posts a new one.
                              isCash(row.trn.asset) || isAccount(row.trn.asset)
                                ? () => requestDelete(row.trn)
                                : undefined
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}
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
