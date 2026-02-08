import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslation } from "next-i18next"
import Dialog from "@components/ui/Dialog"
import { Asset, Portfolio, Position } from "types/beancounter"
import { postData } from "@components/ui/DropZone"
import {
  buildCashRow,
  calculateCashAdjustment,
  CashBalanceAdjustment,
} from "@lib/trns/tradeUtils"
import MathInput from "@components/ui/MathInput"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

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

        const displayName = asset.name || stripOwnerPrefix(asset.code)
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
    <Dialog
      title={t("accounts.setBalances.title")}
      onClose={onClose}
      maxWidth="2xl"
      scrollable={true}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          {!submitSuccess && positions.length > 0 && (
            <Dialog.SubmitButton
              onClick={handleApply}
              label={
                changesCount === 0
                  ? t("accounts.setBalances.noChanges")
                  : `${t("cash.proceed")} (${changesCount})`
              }
              loadingLabel={t("accounts.setBalances.applying")}
              isSubmitting={isSubmitting}
              disabled={changesCount === 0}
              variant="blue"
            />
          )}
        </>
      }
    >
      {/* Asset Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} - {currency}
        </div>
      </div>

      <p className="text-sm text-gray-600">
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
      <Dialog.ErrorAlert message={error} />

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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
          <p className="text-green-700 font-medium">
            {t("accounts.setBalances.success", { count: successCount })}
          </p>
        </div>
      )}
    </Dialog>
  )
}

export default SetAccountBalancesDialog
