import React, { useState, useEffect, useMemo } from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import {
  assetKey,
  ccyKey,
  cashKey,
  accountsKey,
  simpleFetcher,
  tradeKey,
  trnKey,
} from "@utils/api/fetchHelper"
import { useTranslation } from "next-i18next"
import { Transaction } from "types/beancounter"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr, { mutate } from "swr"
import { updateTrn, TrnUpdatePayload } from "@lib/trns/apiHelper"
import { convert } from "@lib/trns/tradeUtils"
import { copyToClipboard } from "@lib/trns/formUtils"
import { postData } from "@components/ui/DropZone"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { currencyOptions } from "@lib/currency"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import SettlementAccountSelect, {
  SettlementAccountOption,
} from "@components/features/transactions/SettlementAccountSelect"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"

// Transaction type options based on market type
const MarketTradeTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
] as const
const CashTradeTypeValues = ["DEPOSIT", "WITHDRAWAL", "FX"] as const

// Common CSS classes
const inputClass =
  "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
const disabledInputClass = `${inputClass} bg-gray-100 cursor-not-allowed`

// Form data type
interface EditFormData {
  type: { value: string; label: string }
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: { value: string; label: string }
  cashCurrency: { value: string; label: string }
  settlementAccount?: SettlementAccountOption | null
  tradeAmount: number
  cashAmount: number
  tradeCashRate?: number | null
  fees: number
  tax: number
  comments?: string | null
}

// Reusable number input field component using MathInput
function NumberField({
  name,
  label,
  control,
  errors,
}: {
  name: keyof EditFormData
  label: string
  control: any
  errors: any
}): React.ReactElement {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MathInput
            value={field.value}
            onChange={field.onChange}
            className={inputClass}
          />
        )}
      />
      {errors[name] && (
        <p className="text-red-500 text-xs">{errors[name].message}</p>
      )}
    </div>
  )
}

// Reusable currency select field component
function CurrencySelectField({
  name,
  label,
  control,
  options,
}: {
  name: "tradeCurrency" | "cashCurrency"
  label: string
  control: any
  options: { value: string; label: string }[]
}): React.ReactElement {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select
            className={inputClass}
            value={field.value.value}
            onChange={(e) => {
              const selected = options.find(
                (opt) => opt.value === e.target.value,
              )
              field.onChange(selected)
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      />
    </div>
  )
}

// Edit form validation schema
const editSchema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
    })
    .required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().required(),
  price: yup.number().required(),
  tradeCurrency: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
    })
    .required(),
  cashCurrency: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
    })
    .required(),
  settlementAccount: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
      currency: yup.string().required(),
      market: yup.string(),
    })
    .nullable()
    .notRequired(),
  tradeAmount: yup.number().required(),
  cashAmount: yup.number().required(),
  tradeCashRate: yup.number().notRequired(),
  fees: yup.number().required(),
  tax: yup.number().required(),
  comments: yup.string().notRequired(),
})

// Edit form component for a single transaction
function EditTransactionForm({
  trn,
  onClose,
  onDelete,
}: {
  trn: Transaction
  onClose: () => void
  onDelete: () => void
}): React.ReactElement {
  const { t } = useTranslation("common")
  const marketCode = trn.asset.market.code
  const assetCode = trn.asset.code
  const assetName = trn.asset.name
  const isCashTransaction = marketCode === "CASH"
  const isFxTransaction = trn.trnType === "FX" || trn.trnType.startsWith("FX_")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  // Fetch currencies for dropdown
  const { data: ccyData, isLoading: ccyLoading } = useSwr(
    ccyKey,
    simpleFetcher(ccyKey),
  )

  // Fetch cash assets (generic balances like "USD Balance")
  const { data: cashAssetsData } = useSwr(cashKey, simpleFetcher(cashKey))

  // Fetch bank accounts (ACCOUNT category)
  const { data: bankAccountsData } = useSwr(
    accountsKey,
    simpleFetcher(accountsKey),
  )

  // cashCurrency can be an object or string depending on API version
  const cashCcy = trn.cashCurrency as unknown
  const cashCcyCode =
    typeof cashCcy === "object" && cashCcy !== null
      ? (cashCcy as { code: string }).code
      : (cashCcy as string) || trn.tradeCurrency.code

  // Build initial settlement account option from transaction's cashAsset if available
  const initialSettlementAccount: SettlementAccountOption | null = trn.cashAsset
    ? {
        value: trn.cashAsset.id,
        label:
          trn.cashAsset.name ||
          `${trn.cashAsset.code} ${trn.cashAsset.market?.code === "CASH" ? "Balance" : ""}`,
        currency:
          trn.cashAsset.priceSymbol ||
          trn.cashAsset.code ||
          trn.tradeCurrency.code,
        market: trn.cashAsset.market?.code,
      }
    : null

  // For cash transactions, use tradeAmount as the displayed "Amount" value
  // since quantity might differ from the actual amount
  const defaultValues = {
    type: { value: trn.trnType, label: trn.trnType },
    tradeDate: trn.tradeDate,
    quantity: isCashTransaction ? trn.tradeAmount : trn.quantity,
    price: trn.price,
    tradeCurrency: {
      value: trn.tradeCurrency.code,
      label: trn.tradeCurrency.code,
    },
    cashCurrency: { value: cashCcyCode, label: cashCcyCode },
    settlementAccount: initialSettlementAccount,
    tradeAmount: trn.tradeAmount,
    cashAmount: trn.cashAmount,
    tradeCashRate: trn.tradeCashRate,
    fees: trn.fees,
    tax: trn.tax,
    comments: trn.comments || "",
  }

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(editSchema),
    defaultValues,
  })

  const tradeCurrency = watch("tradeCurrency")
  const trnType = watch("type")

  // Helper to get currency from an asset
  const getAssetCurrency = (asset: any): string => {
    if (asset.market?.code === "CASH") {
      return asset.code
    }
    return asset.priceSymbol || asset.market?.currency?.code || ""
  }

  // Filter settlement accounts by trade currency
  const currentTradeCurrency = tradeCurrency?.value || trn.tradeCurrency.code

  // Filtered bank accounts matching trade currency
  const filteredBankAccounts = useMemo(() => {
    const accounts = bankAccountsData?.data
      ? Object.values(bankAccountsData.data)
      : []
    return (accounts as any[]).filter(
      (asset) => getAssetCurrency(asset) === currentTradeCurrency,
    )
  }, [bankAccountsData, currentTradeCurrency])

  // Filtered cash assets matching trade currency (these are the generic balances)
  const filteredCashAssets = useMemo(() => {
    const assets = cashAssetsData?.data
      ? Object.values(cashAssetsData.data)
      : []
    return (assets as any[]).filter(
      (asset: any) => asset.code === currentTradeCurrency,
    )
  }, [cashAssetsData, currentTradeCurrency])

  // Find the default cash balance asset for the current currency
  const defaultCashAsset = useMemo((): SettlementAccountOption => {
    const cashAsset = filteredCashAssets[0] as any
    if (cashAsset) {
      return {
        value: cashAsset.id,
        label: `${cashAsset.name || cashAsset.code} Balance`,
        currency: cashAsset.code,
        market: "CASH",
      }
    }
    // Fallback: no asset ID, let backend create generic cash balance from currency
    return {
      value: "", // Empty - backend will use cashCurrency to create/find generic balance
      label: `${currentTradeCurrency} Balance`,
      currency: currentTradeCurrency,
      market: "CASH",
    }
  }, [filteredCashAssets, currentTradeCurrency])

  // Cash assets for dropdown - always include a {currency} Balance option
  const cashAssetsForDropdown = useMemo(() => {
    if (filteredCashAssets.length > 0) {
      return filteredCashAssets
    }
    // Create a synthetic cash asset for the dropdown when none exists
    return [
      {
        id: "",
        code: currentTradeCurrency,
        name: currentTradeCurrency,
        market: { code: "CASH" },
      },
    ]
  }, [filteredCashAssets, currentTradeCurrency])

  // Auto-set default settlement account when trade currency changes
  useEffect(() => {
    const currentSettlement = watch("settlementAccount")
    // Only set default if no settlement is selected or if currency changed
    if (
      !currentSettlement?.value ||
      currentSettlement.currency !== currentTradeCurrency
    ) {
      setValue("settlementAccount", defaultCashAsset)
    }
  }, [currentTradeCurrency, defaultCashAsset, setValue, watch])

  const handleCopy = (): void => {
    const formData = getValues()
    const data = {
      type: formData.type,
      asset: assetCode,
      market: marketCode,
      tradeDate: formData.tradeDate,
      quantity: formData.quantity,
      price: formData.price,
      tradeCurrency: formData.tradeCurrency,
      cashCurrency: formData.cashCurrency,
      tradeAmount: formData.tradeAmount,
      cashAmount: formData.cashAmount,
      fees: formData.fees,
      tax: formData.tax,
      comments: formData.comments || undefined,
    }
    const row = convert(data)
    copyToClipboard(row)
  }

  const onSubmit = async (data: EditFormData): Promise<void> => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // For FX transactions: Delete old + Add new via CSV import
      if (isFxTransaction) {
        // First delete the existing transaction
        const deleteResponse = await fetch(`/api/trns/trades/${trn.id}`, {
          method: "DELETE",
        })
        if (!deleteResponse.ok) {
          setSubmitError(t("trn.error.delete"))
          return
        }

        // Then create new transaction via import
        const formData = {
          type: data.type,
          asset: assetCode,
          market: marketCode,
          tradeDate: data.tradeDate,
          quantity: data.quantity,
          price: data.price,
          tradeCurrency: data.tradeCurrency,
          cashCurrency: data.cashCurrency,
          tradeAmount: data.tradeAmount,
          cashAmount: data.cashAmount,
          fees: data.fees,
          tax: data.tax,
          comments: data.comments ?? undefined,
        }
        const row = convert(formData)
        await postData(trn.portfolio, false, row.split(","))
        // Invalidate cache before closing
        await mutate(trnKey(trn.id))
        onClose()
      } else {
        // For non-FX: Use PATCH
        const payload: TrnUpdatePayload = {
          trnType: data.type.value,
          assetId: trn.asset.id,
          tradeDate: data.tradeDate,
          quantity: data.quantity,
          price: data.price,
          tradeCurrency: data.tradeCurrency.value,
          tradeAmount: data.tradeAmount,
          cashCurrency: data.cashCurrency.value,
          cashAssetId: data.settlementAccount?.value || undefined,
          cashAmount: data.cashAmount,
          fees: data.fees,
          tax: data.tax,
          comments: data.comments ?? undefined,
          status: trn.status, // Preserve the original status
        }

        const response = await updateTrn(trn.portfolio.id, trn.id, payload)
        if (response.ok) {
          // Invalidate cache before closing
          await mutate(trnKey(trn.id))
          onClose()
        } else {
          const errorData = await response.json()
          setSubmitError(errorData.message || t("trn.error.update"))
        }
      }
    } catch (error) {
      console.error("Failed to update transaction:", error)
      setSubmitError(t("trn.error.update"))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get available trade types based on market
  const tradeTypeOptions = isCashTransaction
    ? CashTradeTypeValues.map((value) => ({ value, label: value }))
    : MarketTradeTypeValues.map((value) => ({ value, label: value }))

  if (ccyLoading) {
    return rootLoader(t("loading"))
  }

  const ccyOptions = currencyOptions(ccyData?.data || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl mx-4 md:mx-auto p-4 md:p-6 z-50 max-h-[90vh] overflow-y-auto text-sm">
        <header className="flex items-center border-b pb-2 mb-4">
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
          >
            &times;
          </button>
          <h2 className="flex-1 text-lg font-semibold text-center">
            {assetName || assetCode}
            <span className="text-gray-500 text-sm ml-2">{marketCode}</span>
          </h2>
          <div className="w-6"></div>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("trn.type")}
              </label>
              <TradeTypeController
                name="type"
                control={control}
                options={tradeTypeOptions}
              />
              {errors.type && (
                <p className="text-red-500 text-xs">{errors.type.message}</p>
              )}
            </div>

            {/* Trade Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("trn.tradeDate")}
              </label>
              <Controller
                name="tradeDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    className={inputClass}
                  />
                )}
              />
              {errors.tradeDate && (
                <p className="text-red-500 text-xs">
                  {errors.tradeDate.message}
                </p>
              )}
            </div>

            {/* Asset Code (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("trn.asset.code")}
              </label>
              <input
                type="text"
                value={assetCode}
                disabled
                className={disabledInputClass}
              />
            </div>

            {/* Market (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("trn.market.code")}
              </label>
              <input
                type="text"
                value={marketCode}
                disabled
                className={disabledInputClass}
              />
            </div>

            {/* Currency - for FX show both, otherwise just one that syncs both */}
            {isFxTransaction ? (
              <>
                <CurrencySelectField
                  name="tradeCurrency"
                  label={t("trn.currency")}
                  control={control}
                  options={ccyOptions}
                />
                <CurrencySelectField
                  name="cashCurrency"
                  label={t("trn.currency.cash")}
                  control={control}
                  options={ccyOptions}
                />
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("trn.currency")}
                </label>
                <Controller
                  name="tradeCurrency"
                  control={control}
                  render={({ field }) => (
                    <select
                      className={inputClass}
                      value={field.value.value}
                      onChange={(e) => {
                        const selected = ccyOptions.find(
                          (opt) => opt.value === e.target.value,
                        )
                        if (selected) {
                          field.onChange(selected)
                          // Sync cash currency for non-FX transactions
                          setValue("cashCurrency", selected, {
                            shouldDirty: true,
                          })
                        }
                      }}
                    >
                      {ccyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            )}

            {/* Settlement Account - only for non-cash market transactions */}
            {!isCashTransaction && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("trn.settlement.account")}
                </label>
                <SettlementAccountSelect
                  name="settlementAccount"
                  control={control}
                  accounts={[]}
                  bankAccounts={filteredBankAccounts as any[]}
                  cashAssets={cashAssetsForDropdown as any[]}
                  trnType={trnType?.value || trn.trnType}
                  defaultValue={defaultCashAsset}
                />
              </div>
            )}

            {/* For cash transactions: single Amount field mapped to quantity */}
            {isCashTransaction ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t("trn.amount.trade")}
                </label>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <MathInput
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value)
                        setValue("tradeAmount", value, { shouldDirty: true })
                        setValue("cashAmount", value, { shouldDirty: true })
                        setValue("price", 1, { shouldDirty: true })
                      }}
                      className={inputClass}
                    />
                  )}
                />
                {errors.quantity && (
                  <p className="text-red-500 text-xs">
                    {errors.quantity.message}
                  </p>
                )}
              </div>
            ) : (
              <>
                <NumberField
                  name="quantity"
                  label={t("quantity")}
                  control={control}
                  errors={errors}
                />
                <NumberField
                  name="price"
                  label={t("trn.price")}
                  control={control}
                  errors={errors}
                />
                <NumberField
                  name="tradeAmount"
                  label={t("trn.amount.trade")}
                  control={control}
                  errors={errors}
                />
                <NumberField
                  name="cashAmount"
                  label={t("trn.amount.cash")}
                  control={control}
                  errors={errors}
                />
              </>
            )}

            <NumberField
              name="fees"
              label={t("trn.amount.charges")}
              control={control}
              errors={errors}
            />
            <NumberField
              name="tax"
              label={t("trn.amount.tax")}
              control={control}
              errors={errors}
            />

            {/* Comments */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {t("trn.comments")}
              </label>
              <Controller
                name="comments"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    className={inputClass}
                    value={field.value || ""}
                  />
                )}
              />
            </div>
          </div>

          {/* Error Display */}
          {submitError && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {submitError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between pt-4 border-t">
            <button
              type="button"
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
              onClick={onDelete}
            >
              <i className="fas fa-trash-can mr-2"></i>
              {t("delete")}
            </button>
            <div className="flex space-x-2">
              <button
                type="button"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                onClick={handleCopy}
              >
                <i className="fas fa-copy mr-2"></i>
                Copy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className={`px-4 py-2 rounded text-white ${
                  isSubmitting || !isDirty
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {isSubmitting ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default withPageAuthRequired(function Trades(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const [editModalOpen, setEditModalOpen] = useState(true)

  // Extract query params - safe to access even before router is ready (will be undefined)
  const tradesParam = router.query.trades as string[] | undefined

  // Detect if this is an edit request: /trns/trades/edit/[portfolioId]/[trnId]
  const isEditMode = tradesParam && tradesParam[0] === "edit"

  // For edit mode: trades[1] = portfolioId, trades[2] = trnId
  // For list mode: trades[0] = portfolioId, trades[1] = assetId
  const portfolioId = isEditMode
    ? tradesParam![1]
    : tradesParam
      ? tradesParam[0]
      : undefined
  const assetId = tradesParam ? tradesParam[1] : undefined
  const trnId = isEditMode ? tradesParam![2] : undefined

  // Reset modal state when entering edit mode with a new transaction
  useEffect(() => {
    if (isEditMode && trnId) {
      setEditModalOpen(true)
    }
  }, [isEditMode, trnId])

  // Fetch single transaction for edit mode - always fetch fresh from backend
  // Only fetch when router is ready and we have valid params
  const singleTrn = useSwr(
    router.isReady && isEditMode && trnId ? trnKey(trnId as string) : null,
    router.isReady && isEditMode && trnId
      ? simpleFetcher(trnKey(trnId as string))
      : null,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      revalidateIfStale: true,
      dedupingInterval: 0, // Disable deduplication to always fetch fresh
    },
  )

  // Fetch asset and trades for list mode
  const asset = useSwr(
    router.isReady && !isEditMode && assetId
      ? assetKey(assetId as string)
      : null,
    router.isReady && !isEditMode && assetId
      ? simpleFetcher(assetKey(assetId as string))
      : null,
  )
  const trades = useSwr(
    router.isReady && !isEditMode && portfolioId && assetId
      ? tradeKey(portfolioId as string, assetId as string)
      : null,
    router.isReady && !isEditMode && portfolioId && assetId
      ? simpleFetcher(tradeKey(portfolioId as string, assetId as string))
      : null,
  )

  // Wait for router to be ready (query params available) during client-side navigation
  if (!router.isReady) {
    return rootLoader(t("loading"))
  }

  // Handle edit mode
  if (isEditMode) {
    if (singleTrn.error) {
      return errorOut(t("trades.error.retrieve"), singleTrn.error)
    }
    if (singleTrn.isLoading) {
      return rootLoader(t("loading"))
    }
    // API returns an array, get the first transaction
    const transaction = Array.isArray(singleTrn.data?.data)
      ? singleTrn.data.data[0]
      : singleTrn.data?.data

    if (!transaction) {
      return <div id="root">{t("trn.noTransactions")}</div>
    }

    const handleClose = (): void => {
      setEditModalOpen(false)
      router.back()
    }

    const handleDelete = async (): Promise<void> => {
      if (!confirm(t("trn.delete"))) return
      try {
        const response = await fetch(`/api/trns/trades/${transaction.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          router.back()
        }
      } catch (err) {
        console.error("Error deleting transaction:", err)
      }
    }

    return editModalOpen ? (
      <EditTransactionForm
        trn={transaction}
        onClose={handleClose}
        onDelete={handleDelete}
      />
    ) : (
      <></>
    )
  }

  // List mode - original behavior
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
              className="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
              onClick={() =>
                router.replace(`/trns/trades/${portfolioId}/${assetId}`)
              }
            >
              {t("trades")}
            </button>
            <button
              className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
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
        {/* Mobile: Card layout */}
        <div className="md:hidden space-y-3">
          {trnResults.map((trn: Transaction) => (
            <div
              key={trn.id}
              className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() =>
                router.push(`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`)
              }
            >
              <div className="flex justify-between items-start">
                <div>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                      trn.trnType === "BUY"
                        ? "bg-green-100 text-green-800"
                        : trn.trnType === "SELL"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {trn.trnType}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {trn.tradeCurrency.code}
                  </span>
                </div>
                <div className="text-sm text-gray-500">{trn.tradeDate}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">{t("quantity")}:</span>
                  <span className="ml-1 font-medium">
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
                      thousandSeparator={true}
                    />
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">{t("trn.price")}:</span>
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
                    {t("trn.amount.trade")}:
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
                  <span className="text-gray-500">{t("trn.amount.cash")}:</span>
                  <span className="ml-1 font-medium">
                    <NumericFormat
                      value={trn.cashAmount}
                      displayType={"text"}
                      decimalScale={2}
                      thousandSeparator={true}
                    />
                  </span>
                </div>
                {(trn.fees > 0 || trn.tax > 0) && (
                  <>
                    <div>
                      <span className="text-gray-500">
                        {t("trn.amount.charges")}:
                      </span>
                      <span className="ml-1 font-medium">
                        <NumericFormat
                          value={trn.fees}
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
                  </>
                )}
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
                  {t("quantity")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("trn.price")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("trn.amount.trade")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("trn.settlement.account")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("trn.amount.cash")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("trn.amount.tax")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("trn.amount.charges")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trnResults.map((trn: Transaction) => (
                <tr
                  key={trn.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                    )
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap">{trn.trnType}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {trn.tradeCurrency.code}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {trn.tradeDate}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <NumericFormat
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {trn.cashAsset?.market?.code === "CASH"
                      ? trn.cashAsset.name || `${trn.cashAsset.code} Balance`
                      : trn.cashAsset?.name ||
                        trn.cashAsset?.code ||
                        `${(trn.cashCurrency as any)?.code || trn.tradeCurrency?.code} Balance`}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <NumericFormat
                      value={trn.cashAmount}
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
                      value={trn.fees}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
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
