import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Asset,
  Portfolio,
  PrivateAssetConfig,
  SubAccount,
} from "types/beancounter"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import Dialog from "@components/ui/Dialog"
import { buildCashRow } from "@lib/trns/tradeUtils"
import { postData } from "@components/ui/DropZone"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"

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

  // Sub-account state
  const [configSubAccounts, setConfigSubAccounts] = useState<SubAccount[]>([])
  const [subAccountBalances, setSubAccountBalances] = useState<
    Record<string, number>
  >({})

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

  // Fetch asset config to check for sub-accounts
  useEffect(() => {
    const fetchConfig = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/assets/config/${asset.id}`)
        if (response.ok) {
          const data: { data: PrivateAssetConfig } = await response.json()
          if (data.data?.subAccounts?.length) {
            setConfigSubAccounts(data.data.subAccounts)
            // Initialize sub-account balances from config
            const balances: Record<string, number> = {}
            data.data.subAccounts.forEach((sa) => {
              balances[sa.code] = sa.balance || 0
            })
            setSubAccountBalances(balances)
          }
        }
      } catch {
        // No config or not a POLICY asset — proceed without sub-accounts
      }
    }
    fetchConfig()
  }, [asset.id])

  const hasSubAccounts = configSubAccounts.length > 0

  // When sub-accounts change, update total target balance
  useEffect(() => {
    if (hasSubAccounts) {
      const total = Object.values(subAccountBalances).reduce(
        (sum, v) => sum + (v || 0),
        0,
      )
      setTargetBalance(total)
    }
  }, [subAccountBalances, hasSubAccounts])

  // Check current balance
  useEffect(() => {
    const fetchBalance = async (): Promise<void> => {
      setIsLoadingBalance(true)
      try {
        const response = await fetch(
          `/api/assets/${asset.id}/positions?date=today`,
        )
        if (response.ok) {
          const data = await response.json()
          const positions: AssetPosition[] = data.data || []
          const totalBalance = positions.reduce(
            (sum, p) => sum + (p.balance || 0),
            0,
          )
          setCurrentBalance(totalBalance)
          if (!hasSubAccounts) {
            setTargetBalance(totalBalance)
          }
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
  }, [asset.id, hasSubAccounts])

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

    const portfolio = portfoliosData?.data?.find(
      (p) => p.id === selectedPortfolioId,
    )
    if (!portfolio) {
      setError(t("balance.error.noPortfolio"))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const assetCurrency = getAssetCurrency(asset) || "USD"

      // Build sub-accounts map for DEPOSIT transactions
      let subAccountsMap: Record<string, number> | undefined
      if (hasSubAccounts && transactionInfo.type === "DEPOSIT") {
        const filtered = Object.entries(subAccountBalances).filter(
          ([, v]) => v > 0,
        )
        if (filtered.length > 0) {
          subAccountsMap = Object.fromEntries(filtered)
        }
      }

      // Use JSON API to support subAccounts
      const trnData: Record<string, unknown> = {
        assetId: asset.id,
        trnType: transactionInfo.type,
        quantity: transactionInfo.amount,
        tradeDate: date,
        tradeCurrency: assetCurrency,
        cashCurrency: assetCurrency,
        status: "SETTLED",
        comments: `${transactionInfo.type === "DEPOSIT" ? "Add" : "Withdraw"} ${assetCurrency} ${transactionInfo.amount.toLocaleString()} ${transactionInfo.type === "DEPOSIT" ? "to" : "from"} ${asset.name || stripOwnerPrefix(asset.code)}`,
      }

      if (subAccountsMap) {
        trnData.subAccounts = subAccountsMap
      }

      const response = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: selectedPortfolioId,
          data: [trnData],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(
          errorData.message || errorData.detail || t("balance.error.failed"),
        )
        return
      }

      // For withdrawals, also credit the cash account
      if (isWithdrawal && cashAccountId) {
        const cashAccount = cashAccounts.find((a) => a.id === cashAccountId)
        if (cashAccount) {
          const cashRow = buildCashRow({
            type: "DEPOSIT",
            currency: getAssetCurrency(cashAccount) || assetCurrency,
            amount: transactionInfo.amount,
            tradeDate: date,
            comments: `Withdrawal from ${asset.name || stripOwnerPrefix(asset.code)}`,
            market: "PRIVATE",
            assetCode: stripOwnerPrefix(cashAccount.code),
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
    hasSubAccounts,
    subAccountBalances,
  ])

  return (
    <Dialog
      title={t("balance.set.title")}
      onClose={onClose}
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label={t("balance.set.confirm")}
            loadingLabel={t("saving")}
            isSubmitting={isSubmitting}
            disabled={
              !transactionInfo ||
              !selectedPortfolioId ||
              (isWithdrawal && !cashAccountId)
            }
            variant="amber"
          />
        </>
      }
    >
      {/* Asset Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} -{" "}
          {t(`category.${asset.assetCategory?.id}`) ||
            asset.assetCategory?.name}
        </div>
        {!isLoadingBalance && (
          <div className="mt-2 text-sm">
            <span className="text-gray-500">{t("balance.current")}:</span>{" "}
            <span className="font-medium">
              {getAssetCurrency(asset)} {currentBalance.toLocaleString()}
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

      {/* Sub-account balances (for POLICY assets with sub-accounts) */}
      {hasSubAccounts ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t("balance.subAccounts")}
          </label>
          {configSubAccounts.map((sa) => (
            <div key={sa.code} className="flex items-center space-x-3">
              <span className="text-sm text-gray-700 w-24 flex-shrink-0">
                {sa.displayName || sa.code}
              </span>
              <MathInput
                value={subAccountBalances[sa.code] || 0}
                onChange={(value) =>
                  setSubAccountBalances((prev) => ({
                    ...prev,
                    [sa.code]: value,
                  }))
                }
                placeholder="0"
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              {t("balance.target")}
            </span>
            <span className="text-sm font-medium">
              {getAssetCurrency(asset)} {targetBalance.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("balance.target")} ({getAssetCurrency(asset) || "USD"})
          </label>
          <MathInput
            value={targetBalance}
            onChange={(value) => setTargetBalance(value)}
            placeholder={t("balance.target.hint")}
            className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      )}

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
                {stripOwnerPrefix(account.code)} ({getAssetCurrency(account)})
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
        <div
          className={`rounded-lg p-3 text-sm ${
            transactionInfo.type === "DEPOSIT"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center">
            <i
              className={`fas ${transactionInfo.type === "DEPOSIT" ? "fa-arrow-up" : "fa-arrow-down"} mr-2`}
            ></i>
            <span className="font-medium">
              {transactionInfo.type === "DEPOSIT"
                ? t("balance.deposit")
                : t("balance.withdrawal")}
              :
            </span>
            <span className="ml-2">
              {getAssetCurrency(asset)}{" "}
              {transactionInfo.amount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
