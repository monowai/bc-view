import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Asset, Portfolio } from "types/beancounter"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import { buildCashRow } from "@lib/trns/tradeUtils"
import { postData } from "@components/ui/DropZone"

// Extract display code without owner prefix (e.g., "userId.WISE" -> "WISE")
function getDisplayCode(code: string): string {
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
}

interface PortfoliosResponse {
  data: Portfolio[]
}

interface AssetsResponse {
  data: Record<string, Asset>
}

interface AssetPosition {
  portfolio: Portfolio
  balance: number
}

interface SetBalanceDialogProps {
  asset: Asset
  onClose: () => void
  onComplete: () => Promise<void>
}

export default function SetBalanceDialog({
  asset,
  onClose,
  onComplete,
}: SetBalanceDialogProps): React.ReactElement {
  const { t } = useTranslation("common")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [targetBalance, setTargetBalance] = useState<number>(0)
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("")
  const [cashAccountId, setCashAccountId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch portfolios
  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Fetch cash/bank accounts for withdrawal destination
  const { data: cashAccountsData } = useSwr<AssetsResponse>(
    "/api/assets?category=ACCOUNT",
    simpleFetcher("/api/assets?category=ACCOUNT"),
  )

  const cashAccounts = useMemo(() => {
    if (!cashAccountsData?.data) return []
    return Object.values(cashAccountsData.data)
  }, [cashAccountsData?.data])

  // Check current balance
  useEffect(() => {
    const fetchBalance = async (): Promise<void> => {
      setIsLoadingBalance(true)
      try {
        const response = await fetch(`/api/assets/${asset.id}/positions?date=today`)
        if (response.ok) {
          const data = await response.json()
          const positions: AssetPosition[] = data.data || []
          const totalBalance = positions.reduce((sum, p) => sum + (p.balance || 0), 0)
          setCurrentBalance(totalBalance)
          setTargetBalance(totalBalance)
          // Auto-select first portfolio if asset is in one
          if (positions.length > 0 && positions[0].portfolio?.id) {
            setSelectedPortfolioId(positions[0].portfolio.id)
          }
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err)
      } finally {
        setIsLoadingBalance(false)
      }
    }
    fetchBalance()
  }, [asset.id])

  // Calculate transaction type and amount
  const transactionInfo = useMemo(() => {
    const diff = targetBalance - currentBalance
    if (diff === 0) return null
    return {
      type: diff > 0 ? "DEPOSIT" : "WITHDRAWAL",
      amount: Math.abs(diff),
    }
  }, [targetBalance, currentBalance])

  const isWithdrawal = transactionInfo?.type === "WITHDRAWAL"

  const handleSave = useCallback(async () => {
    if (!transactionInfo || !selectedPortfolioId) return

    // For withdrawals, require cash account
    if (isWithdrawal && !cashAccountId) {
      setError(t("balance.error.noCashAccount"))
      return
    }

    const portfolio = portfoliosData?.data?.find((p) => p.id === selectedPortfolioId)
    if (!portfolio) {
      setError(t("balance.error.noPortfolio"))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const assetCurrency = asset.priceSymbol || asset.market?.currency?.code || "USD"

      // Create the main transaction
      const row = buildCashRow({
        type: transactionInfo.type as "DEPOSIT" | "WITHDRAWAL",
        currency: assetCurrency,
        amount: transactionInfo.amount,
        tradeDate: date,
        comments: `${transactionInfo.type === "DEPOSIT" ? "Add" : "Withdraw"} ${assetCurrency} ${transactionInfo.amount.toLocaleString()} ${transactionInfo.type === "DEPOSIT" ? "to" : "from"} ${asset.name || getDisplayCode(asset.code)}`,
        market: "PRIVATE",
        assetCode: getDisplayCode(asset.code),
      })

      await postData(portfolio, false, row)

      // For withdrawals, also credit the cash account
      if (isWithdrawal && cashAccountId) {
        const cashAccount = cashAccounts.find((a) => a.id === cashAccountId)
        if (cashAccount) {
          const cashRow = buildCashRow({
            type: "DEPOSIT",
            currency: cashAccount.priceSymbol || cashAccount.market?.currency?.code || assetCurrency,
            amount: transactionInfo.amount,
            tradeDate: date,
            comments: `Withdrawal from ${asset.name || getDisplayCode(asset.code)}`,
            market: "PRIVATE",
            assetCode: getDisplayCode(cashAccount.code),
          })
          await postData(portfolio, false, cashRow)
        }
      }

      await onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("balance.error.failed"))
    } finally {
      setIsSubmitting(false)
    }
  }, [
    transactionInfo,
    selectedPortfolioId,
    isWithdrawal,
    cashAccountId,
    portfoliosData?.data,
    asset,
    date,
    cashAccounts,
    onComplete,
    t,
  ])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">{t("balance.set.title")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          {/* Asset Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="font-semibold text-lg">{asset.name}</div>
            <div className="text-sm text-gray-600">
              {getDisplayCode(asset.code)} -{" "}
              {t(`category.${asset.assetCategory?.id}`) || asset.assetCategory?.name}
            </div>
            {!isLoadingBalance && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">{t("balance.current")}:</span>{" "}
                <span className="font-medium">
                  {asset.priceSymbol || asset.market?.currency?.code}{" "}
                  {currentBalance.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("balance.date")}
            </label>
            <DateInput
              value={date}
              onChange={setDate}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Target Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("balance.target")} ({asset.priceSymbol || asset.market?.currency?.code || "USD"})
            </label>
            <MathInput
              value={targetBalance}
              onChange={(value) => setTargetBalance(value)}
              placeholder={t("balance.target.hint")}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Portfolio Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("balance.portfolio")}
            </label>
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">{t("balance.portfolio.hint")}</option>
              {portfoliosData?.data?.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.code} - {portfolio.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cash Account Selection (for withdrawals) */}
          {isWithdrawal && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("balance.cashAccount")}
              </label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">{t("balance.cashAccount.hint")}</option>
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getDisplayCode(account.code)} ({account.priceSymbol || account.market?.currency?.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("balance.cashAccount.description")}
              </p>
            </div>
          )}

          {/* Transaction Preview */}
          {transactionInfo && (
            <div className={`rounded-lg p-3 text-sm ${
              transactionInfo.type === "DEPOSIT"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}>
              <div className="flex items-center">
                <i className={`fas ${transactionInfo.type === "DEPOSIT" ? "fa-arrow-up" : "fa-arrow-down"} mr-2`}></i>
                <span className="font-medium">
                  {transactionInfo.type === "DEPOSIT" ? t("balance.deposit") : t("balance.withdrawal")}:
                </span>
                <span className="ml-2">
                  {asset.priceSymbol || asset.market?.currency?.code}{" "}
                  {transactionInfo.amount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded transition-colors text-white ${
              isSubmitting || !transactionInfo || !selectedPortfolioId || (isWithdrawal && !cashAccountId)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
            onClick={handleSave}
            disabled={isSubmitting || !transactionInfo || !selectedPortfolioId || (isWithdrawal && !cashAccountId)}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("saving")}
              </span>
            ) : (
              t("balance.set.confirm")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
