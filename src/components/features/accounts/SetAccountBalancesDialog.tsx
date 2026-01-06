import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslation } from "next-i18next"
import { Asset, Portfolio, Position } from "types/beancounter"
import { postData } from "@components/ui/DropZone"
import {
  buildCashRow,
  calculateCashAdjustment,
  CashBalanceAdjustment,
} from "@lib/trns/tradeUtils"
import MathInput from "@components/ui/MathInput"

interface AssetPosition {
  portfolio: Portfolio
  position: Position | null
  balance: number
}

interface SetAccountBalancesDialogProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}

interface BalanceEntry {
  portfolio: Portfolio
  currentBalance: number
  targetBalance: string
  adjustment: CashBalanceAdjustment
}

// Extract display code without owner prefix
function getDisplayCode(code: string): string {
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
}

const SetAccountBalancesDialog: React.FC<SetAccountBalancesDialogProps> = ({
  asset,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation("common")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [balances, setBalances] = useState<Map<string, string>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [successCount, setSuccessCount] = useState(0)

  const currency = asset.priceSymbol || asset.market?.currency?.code || "USD"

  // Fetch positions when dialog opens
  useEffect(() => {
    const fetchPositions = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/assets/${asset.id}/positions?date=today`,
        )
        if (!response.ok) {
          setError(`Failed to fetch positions: ${response.status}`)
          return
        }
        const data = await response.json()
        setPositions(data.data || [])

        // Initialize balance inputs with current values
        const initialBalances = new Map<string, string>()
        data.data?.forEach((pos: AssetPosition) => {
          initialBalances.set(pos.portfolio.id, pos.balance.toString())
        })
        setBalances(initialBalances)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch positions",
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchPositions()
  }, [asset.id])

  // Calculate balance entries with adjustments
  const balanceEntries = useMemo((): BalanceEntry[] => {
    return positions.map((pos) => {
      const targetStr = balances.get(pos.portfolio.id) || ""
      const target = parseFloat(targetStr)
      const adjustment =
        isNaN(target) || target === pos.balance
          ? { amount: 0, type: "DEPOSIT" as const, newBalance: pos.balance }
          : calculateCashAdjustment(pos.balance, target)

      return {
        portfolio: pos.portfolio,
        currentBalance: pos.balance,
        targetBalance: targetStr,
        adjustment,
      }
    })
  }, [positions, balances])

  // Count entries with changes
  const changesCount = useMemo(() => {
    return balanceEntries.filter((entry) => entry.adjustment.amount > 0).length
  }, [balanceEntries])

  const handleBalanceChange = useCallback(
    (portfolioId: string, value: string) => {
      setBalances((prev) => {
        const next = new Map(prev)
        next.set(portfolioId, value)
        return next
      })
    },
    [],
  )

  const handleApply = async (): Promise<void> => {
    if (changesCount === 0) return

    setIsSubmitting(true)
    setError(null)

    let appliedCount = 0

    try {
      for (const entry of balanceEntries) {
        if (entry.adjustment.amount === 0) continue

        const displayName = asset.name || getDisplayCode(asset.code)
        const row = buildCashRow({
          type: entry.adjustment.type,
          currency,
          amount: entry.adjustment.amount,
          comments: `Set ${displayName} balance to ${currency} ${entry.adjustment.newBalance.toFixed(2)}`,
          market: "PRIVATE",
          assetCode: asset.code,
        })

        await postData(entry.portfolio, false, row)
        appliedCount++
      }

      setSuccessCount(appliedCount)
      setSubmitSuccess(true)

      // Close after showing success
      setTimeout(() => {
        onComplete()
      }, 1500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("accounts.setBalances.error"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">
            {t("accounts.setBalances.title")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        {/* Asset Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="font-semibold text-lg">{asset.name}</div>
          <div className="text-sm text-gray-600">
            {getDisplayCode(asset.code)} - {currency}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t("accounts.setBalances.description")}
        </p>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <i className="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
            <span className="ml-2 text-gray-600">{t("loading")}</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* No Portfolios State */}
        {!isLoading && !error && positions.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <i className="fas fa-info-circle text-3xl text-gray-400 mb-2"></i>
            <p className="text-gray-600">{t("accounts.setBalances.notHeld")}</p>
            <p className="text-sm text-gray-500 mt-1">
              {t("accounts.setBalances.notHeld.hint")}
            </p>
          </div>
        )}

        {/* Balance Table */}
        {!isLoading && !error && positions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("accounts.setBalances.portfolio")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t("accounts.setBalances.current")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t("accounts.setBalances.target")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t("accounts.setBalances.change")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {balanceEntries.map((entry) => (
                  <tr key={entry.portfolio.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {entry.portfolio.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.portfolio.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {currency}{" "}
                      {entry.currentBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <MathInput
                        value={
                          entry.targetBalance === ""
                            ? ""
                            : parseFloat(entry.targetBalance)
                        }
                        onChange={(value) =>
                          handleBalanceChange(entry.portfolio.id, String(value))
                        }
                        className="w-full text-right border-gray-300 rounded-md shadow-sm px-2 py-1 border focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSubmitting || submitSuccess}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.adjustment.amount > 0 ? (
                        <span
                          className={`font-medium ${
                            entry.adjustment.type === "DEPOSIT"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {entry.adjustment.type === "DEPOSIT" ? "+" : "-"}
                          {currency}{" "}
                          {entry.adjustment.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Success Message */}
        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 text-center">
            <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
            <p className="text-green-700 font-medium">
              {t("accounts.setBalances.success", { count: successCount })}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </button>
          {!submitSuccess && positions.length > 0 && (
            <button
              type="button"
              className={`px-4 py-2 rounded transition-colors text-white ${
                changesCount === 0 || isSubmitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={handleApply}
              disabled={changesCount === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {t("accounts.setBalances.applying")}
                </span>
              ) : changesCount === 0 ? (
                t("accounts.setBalances.noChanges")
              ) : (
                `${t("cash.proceed")} (${changesCount})`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetAccountBalancesDialog
