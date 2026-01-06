import React, { useEffect, useState } from "react"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useTranslation } from "next-i18next"
import useSwr, { mutate } from "swr"
import { fetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { Portfolio, Transaction, TrnStatus } from "types/beancounter"
import { useRouter } from "next/router"
import Head from "next/head"

interface ProposedTransaction extends Transaction {
  editedPrice?: number
  editedFees?: number
  editedStatus?: TrnStatus
  editedTradeDate?: string
}

export default function ProposedTransactions(): React.JSX.Element {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { portfolioId } = router.query

  const [transactions, setTransactions] = useState<ProposedTransaction[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch portfolios
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    fetcher,
  )
  const portfolios: Portfolio[] = portfoliosData?.data || []

  // Fetch proposed transactions when portfolioId is available
  const proposedKey = portfolioId
    ? `/api/trns/portfolio/${portfolioId}/status/PROPOSED`
    : null
  const { data: proposedData, error: fetchError } = useSwr<{
    data: Transaction[]
  }>(proposedKey, fetcher, { refreshInterval: 0 })

  useEffect(() => {
    if (proposedData?.data) {
      setTransactions(
        proposedData.data.map((trn) => ({
          ...trn,
          editedPrice: trn.price,
          editedFees: trn.fees,
          editedStatus: trn.status,
          editedTradeDate: trn.tradeDate,
        })),
      )
    }
  }, [proposedData])

  const handlePortfolioChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const newPortfolioId = e.target.value
    if (newPortfolioId) {
      router.push(`/trns/proposed?portfolioId=${newPortfolioId}`)
    }
  }

  const handlePriceChange = (id: string, value: number): void => {
    setTransactions((prev) =>
      prev.map((trn) => (trn.id === id ? { ...trn, editedPrice: value } : trn)),
    )
  }

  const handleFeesChange = (id: string, value: number): void => {
    setTransactions((prev) =>
      prev.map((trn) => (trn.id === id ? { ...trn, editedFees: value } : trn)),
    )
  }

  const handleStatusChange = (id: string, value: TrnStatus): void => {
    setTransactions((prev) =>
      prev.map((trn) =>
        trn.id === id ? { ...trn, editedStatus: value } : trn,
      ),
    )
  }

  const handleTradeDateChange = (id: string, value: string): void => {
    setTransactions((prev) =>
      prev.map((trn) =>
        trn.id === id ? { ...trn, editedTradeDate: value } : trn,
      ),
    )
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm("Delete this proposed transaction?")) return

    try {
      const response = await fetch(`/api/trns/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        setError(`Failed to delete transaction: ${response.statusText}`)
        return
      }

      // Remove from local state
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error("Error deleting transaction:", err)
      setError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      )
    }
  }

  const hasChanges = (trn: ProposedTransaction): boolean =>
    trn.editedPrice !== trn.price ||
    trn.editedFees !== trn.fees ||
    trn.editedStatus !== trn.status ||
    trn.editedTradeDate !== trn.tradeDate

  const saveTransaction = async (
    trn: ProposedTransaction,
  ): Promise<boolean> => {
    if (!hasChanges(trn)) return true

    try {
      const response = await fetch(`/api/trns/patch/${portfolioId}/${trn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: trn.asset.id,
          trnType: trn.trnType,
          quantity: trn.quantity,
          tradeCurrency: trn.tradeCurrency.code,
          price: trn.editedPrice,
          fees: trn.editedFees,
          status: trn.editedStatus,
          tradeDate: trn.editedTradeDate,
          tradeAmount: (trn.editedPrice || trn.price) * trn.quantity,
        }),
      })

      if (!response.ok) {
        console.error(`Failed to update transaction: ${response.statusText}`)
        return false
      }
      return true
    } catch (err) {
      console.error("Error saving transaction:", err)
      return false
    }
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setError(null)

    const editedTransactions = transactions.filter(hasChanges)
    const results = await Promise.all(editedTransactions.map(saveTransaction))

    if (results.every((r) => r)) {
      // Refresh the data
      mutate(proposedKey)
    } else {
      setError("Some transactions failed to save")
    }

    setIsSaving(false)
  }

  const anyChanges = transactions.some(hasChanges)

  if (!portfoliosData || portfolios.length === 0) {
    return rootLoader(t("loading"))
  }

  return (
    <>
      <Head>
        <title>Review Proposed Transactions</title>
      </Head>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-2xl font-bold mb-6">
          Review Proposed Transactions
        </h1>

        {/* Portfolio Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Portfolio
          </label>
          <select
            value={(portfolioId as string) || ""}
            onChange={handlePortfolioChange}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a portfolio...</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            Failed to load transactions
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {portfolioId && transactions.length === 0 && !fetchError && (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-8 rounded text-center">
            No proposed transactions found for this portfolio.
          </div>
        )}

        {transactions.length > 0 && (
          <>
            {/* Action Bar */}
            <div className="flex items-center gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
              <button
                onClick={handleSave}
                disabled={!anyChanges || isSaving}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              {anyChanges && (
                <span className="text-sm text-gray-500">
                  You have unsaved changes
                </span>
              )}
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                      Asset
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                      Fees
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((trn) => (
                    <tr key={trn.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 font-medium rounded ${
                            trn.trnType === "BUY"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {trn.trnType}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {trn.asset.code}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono">
                        {trn.quantity.toFixed(0)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={trn.editedPrice || 0}
                          onChange={(e) =>
                            handlePriceChange(
                              trn.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-20 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                        {(
                          (trn.editedPrice || trn.price) * trn.quantity
                        ).toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={trn.editedFees || 0}
                          onChange={(e) =>
                            handleFeesChange(
                              trn.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-16 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <select
                          value={trn.editedStatus}
                          onChange={(e) =>
                            handleStatusChange(
                              trn.id,
                              e.target.value as TrnStatus,
                            )
                          }
                          className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="PROPOSED">PROPOSED</option>
                          <option value="SETTLED">SETTLED</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <input
                          type="date"
                          value={trn.editedTradeDate || trn.tradeDate}
                          onChange={(e) =>
                            handleTradeDateChange(trn.id, e.target.value)
                          }
                          className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDelete(trn.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete transaction"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Total Transactions</div>
                  <div className="font-semibold">{transactions.length}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total Amount</div>
                  <div className="font-semibold font-mono">
                    {transactions
                      .reduce(
                        (sum, t) =>
                          sum + (t.editedPrice || t.price) * t.quantity,
                        0,
                      )
                      .toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Total Fees</div>
                  <div className="font-semibold font-mono">
                    {transactions
                      .reduce((sum, t) => sum + (t.editedFees || 0), 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
