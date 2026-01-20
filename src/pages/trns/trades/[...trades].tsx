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
  optionalFetcher,
  tradeKey,
  trnKey,
} from "@utils/api/fetchHelper"
import { useTranslation } from "next-i18next"
import { Portfolio, Transaction, Broker } from "types/beancounter"
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
  "COST_ADJUST",
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
  brokerId?: string
  comments?: string
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
      value: yup.string(), // Allow empty - backend uses cashCurrency as fallback
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
  brokerId: yup.string().default(""),
  comments: yup.string().default(""),
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
  const isCostAdjust = trn.trnType === "COST_ADJUST"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    trn.portfolio.id,
  )

  // Fetch portfolios for portfolio change feature
  const { data: portfoliosData } = useSwr(
    "/api/portfolios",
    simpleFetcher("/api/portfolios"),
  )
  const portfolios: Portfolio[] = portfoliosData?.data || []

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

  // Cash endpoint not implemented on backend - disable for now
  const { data: cashAssetsData } = useSwr(null, optionalFetcher(cashKey))

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

  // Fetch brokers for dropdown
  const { data: brokersData } = useSwr(
    "/api/brokers",
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = brokersData?.data || []

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
    brokerId: trn.broker?.id || "",
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
      comments: formData.comments || "",
    }
    const row = convert(data)
    copyToClipboard(row)
  }

  const onSubmit = async (data: EditFormData): Promise<void> => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // For FX transactions: Delete old + Add new via CSV import (FX needs special handling)
      if (isFxTransaction) {
        const deleteResponse = await fetch(`/api/trns/trades/${trn.id}`, {
          method: "DELETE",
        })
        if (!deleteResponse.ok) {
          setSubmitError(t("trn.error.delete"))
          return
        }

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
          comments: data.comments || "",
          status: { value: trn.status, label: trn.status },
        }
        const row = convert(formData)
        await postData(trn.portfolio, false, row.split(","))
        await mutate(trnKey(trn.id))
        onClose()
      } else {
        // Use PATCH for all non-FX transactions (including portfolio moves)
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
          comments: data.comments || "",
          brokerId: data.brokerId || undefined,
          status: trn.status,
        }

        // Use selectedPortfolioId for the PATCH - this handles portfolio moves
        const response = await updateTrn(selectedPortfolioId, trn.id, payload)
        if (response.ok) {
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

  // Check if portfolio changed
  const portfolioChanged = selectedPortfolioId !== trn.portfolio.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-4 z-50 text-sm flex flex-col max-h-[85vh]">
        {/* Header with asset info, trade value, and action buttons */}
        <header className="flex-shrink-0 pb-3 border-b">
          {/* Top row: close, asset info, action buttons */}
          <div className="flex items-center justify-between mb-2">
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={onClose}
              title={t("cancel")}
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="text-center flex-1 px-2" title={assetName || assetCode}>
              <div className="font-semibold truncate">{assetCode}</div>
              {assetName && (
                <div className="text-xs text-gray-500 truncate">
                  {assetName.length > 20
                    ? `${assetName.substring(0, 20)}...`
                    : assetName}
                </div>
              )}
              <div className="text-xs text-gray-400">{marketCode}</div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="text-green-600 hover:text-green-700 p-1"
                onClick={handleCopy}
                title={t("copy")}
              >
                <i className="fas fa-copy"></i>
              </button>
              <button
                type="button"
                className="text-red-500 hover:text-red-600 p-1"
                onClick={onDelete}
                title={t("delete")}
              >
                <i className="fas fa-trash-can"></i>
              </button>
            </div>
          </div>

          {/* Trade Value Summary */}
          {(() => {
            const currentType = trnType?.value || trn.trnType
            const hasCashImpact = ![
              "ADD",
              "REDUCE",
              "SPLIT",
              "COST_ADJUST",
            ].includes(currentType)
            return (
              <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className={`text-xs font-medium uppercase ${
                      currentType === "SELL" || currentType === "WITHDRAWAL"
                        ? "text-red-600"
                        : currentType === "ADD" || currentType === "REDUCE"
                          ? "text-blue-600"
                          : currentType === "COST_ADJUST"
                            ? "text-orange-600"
                            : "text-green-600"
                    }`}
                  >
                    {currentType}
                  </div>
                  <div className="font-bold">
                    <NumericFormat
                      value={
                        currentType === "COST_ADJUST"
                          ? watch("tradeAmount") || trn.tradeAmount
                          : watch("quantity") || trn.quantity
                      }
                      displayType="text"
                      thousandSeparator
                      decimalScale={2}
                      fixedDecimalScale
                    />
                    {!hasCashImpact && currentType !== "COST_ADJUST" && (
                      <span className="text-gray-500 text-sm ml-1">
                        {t("trn.units", "units")}
                      </span>
                    )}
                  </div>
                  {hasCashImpact && (
                    <div className="text-xs text-gray-500">
                      {tradeCurrency?.value || trn.tradeCurrency.code}
                    </div>
                  )}
                </div>
                {hasCashImpact && (
                  <>
                    <div className="text-gray-300 px-3">
                      <i className="fas fa-arrow-right text-xs"></i>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.cash")}
                      </div>
                      <div className="font-bold">
                        <NumericFormat
                          value={watch("cashAmount") || trn.cashAmount}
                          displayType="text"
                          thousandSeparator
                          decimalScale={2}
                          fixedDecimalScale
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {watch("cashCurrency")?.value || trn.tradeCurrency.code}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </header>

        {/* Scrollable form content */}
        <form
          id="edit-trn-form"
          onSubmit={handleSubmit(onSubmit as any)}
          className="flex-1 overflow-y-auto py-3 space-y-3"
        >
          {/* Type and Date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                {t("trn.type")}
              </label>
              <TradeTypeController
                name="type"
                control={control}
                options={tradeTypeOptions}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
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
            </div>
          </div>

          {/* Asset and Market - editable hint */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                {t("trn.asset.code")}
              </label>
              <input
                type="text"
                value={assetCode}
                disabled
                className={`${disabledInputClass} text-xs`}
                title={t(
                  "trn.asset.changeHint",
                  "Change portfolio to move transaction",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                {t("trn.market.code")}
              </label>
              <input
                type="text"
                value={marketCode}
                disabled
                className={`${disabledInputClass} text-xs`}
              />
            </div>
          </div>

          {/* Quantity, Price, Fees - key fields */}
          {isCostAdjust ? (
            <div>
              <label className="block text-xs font-medium text-gray-600">
                {t("costAdjust.adjustment")}
              </label>
              <Controller
                name="tradeAmount"
                control={control}
                render={({ field }) => (
                  <MathInput
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    className={inputClass}
                  />
                )}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("costAdjust.edit.help")}
              </p>
            </div>
          ) : isCashTransaction ? (
            <div>
              <label className="block text-xs font-medium text-gray-600">
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
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
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
                name="fees"
                label={t("trn.amount.charges")}
                control={control}
                errors={errors}
              />
            </div>
          )}

          {/* Settlement Account - important, always visible (except for no-cash-impact types) */}
          {!isCashTransaction && !isCostAdjust && (
            <div>
              <label className="block text-xs font-medium text-gray-600">
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

          {/* Broker field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">
                {t("trn.broker", "Broker")}
              </label>
              <a
                href="/brokers"
                target="_blank"
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {t("brokers.manage", "Manage")}
              </a>
            </div>
            <Controller
              name="brokerId"
              control={control}
              render={({ field }) => (
                <select
                  className={inputClass}
                  value={field.value || ""}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  <option value="">
                    {t("trn.broker.none", "-- No broker --")}
                  </option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                      {broker.accountNumber ? ` (${broker.accountNumber})` : ""}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Expandable "More" section */}
          <div>
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <i
                className={`fas fa-chevron-${showMore ? "up" : "down"} text-xs`}
              ></i>
              {showMore
                ? t("trn.showLess", "Less")
                : t("trn.showMore", "More options")}
            </button>

            {showMore && (
              <div className="mt-2 space-y-2 pt-2 border-t border-gray-100">
                {/* Portfolio */}
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("portfolio")}
                  </label>
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    className={`${inputClass} text-xs ${portfolioChanged ? "border-amber-500 bg-amber-50" : ""}`}
                  >
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                  {portfolioChanged && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {t(
                        "trn.portfolio.changed",
                        "Will move to this portfolio",
                      )}
                    </p>
                  )}
                </div>

                {/* Trade/Cash Amounts */}
                {!isCashTransaction && (
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                )}

                {/* Tax */}
                <NumberField
                  name="tax"
                  label={t("trn.amount.tax")}
                  control={control}
                  errors={errors}
                />

                {/* Comments */}
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    {t("trn.comments", "Comments")}
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

                {/* Currency - hidden in More section */}
                {isFxTransaction ? (
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      {t("trn.currency")}
                    </label>
                    <Controller
                      name="tradeCurrency"
                      control={control}
                      render={({ field }) => (
                        <select
                          className={`${inputClass} text-xs`}
                          value={field.value.value}
                          onChange={(e) => {
                            const selected = ccyOptions.find(
                              (opt) => opt.value === e.target.value,
                            )
                            if (selected) {
                              field.onChange(selected)
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
              </div>
            )}
          </div>

          {/* Error Display */}
          {submitError && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded">
              {submitError}
            </div>
          )}
        </form>

        {/* Sticky footer with Save/Cancel */}
        <div className="flex-shrink-0 pt-3 border-t flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            form="edit-trn-form"
            disabled={isSubmitting || (!isDirty && !portfolioChanged)}
            onClick={() => {
              console.log(
                "[EditTrn] Save clicked, isDirty:",
                isDirty,
                "portfolioChanged:",
                portfolioChanged,
                "errors:",
                errors,
              )
              handleSubmit(onSubmit as any, (validationErrors) => {
                console.log("[EditTrn] Validation errors:", validationErrors)
                setSubmitError("Validation failed - check console")
              })()
            }}
            className={`px-4 py-2 rounded text-white text-sm ${
              isSubmitting || (!isDirty && !portfolioChanged)
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isSubmitting ? t("saving") : t("save")}
          </button>
        </div>
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

  // Group transactions by broker (must be called before any early returns for hooks rules)
  const trnResults: Transaction[] = trades.data?.data || []
  const groupedByBroker = useMemo(() => {
    if (!trnResults || trnResults.length === 0) return []

    const groups: Record<string, { broker: { id: string; name: string } | null; transactions: Transaction[]; totals: { quantity: number; tradeAmount: number; cashAmount: number; fees: number; tax: number } }> = {}

    trnResults.forEach((trn: Transaction) => {
      const brokerKey = trn.broker?.id || "__no_broker__"
      if (!groups[brokerKey]) {
        groups[brokerKey] = {
          broker: trn.broker || null,
          transactions: [],
          totals: { quantity: 0, tradeAmount: 0, cashAmount: 0, fees: 0, tax: 0 }
        }
      }
      groups[brokerKey].transactions.push(trn)
      groups[brokerKey].totals.quantity += trn.quantity || 0
      groups[brokerKey].totals.tradeAmount += trn.tradeAmount || 0
      groups[brokerKey].totals.cashAmount += trn.cashAmount || 0
      groups[brokerKey].totals.fees += trn.fees || 0
      groups[brokerKey].totals.tax += trn.tax || 0
    })

    // Sort: brokers with names first (alphabetically), then "No Broker" last
    return Object.values(groups).sort((a, b) => {
      if (!a.broker && b.broker) return 1
      if (a.broker && !b.broker) return -1
      if (!a.broker && !b.broker) return 0
      return (a.broker?.name || "").localeCompare(b.broker?.name || "")
    })
  }, [trnResults])

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
      return (
        <div id="root" className="text-center py-8">
          <p className="text-gray-500 mb-4">{t("trn.noTransactions")}</p>
          <button
            onClick={() => router.back()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            <i className="fa fa-arrow-left mr-2"></i>
            {t("back")}
          </button>
        </div>
      )
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

  // List mode - check for errors and loading state
  if (trades.error) {
    return errorOut(t("trades.error.retrieve"), trades.error)
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error)
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader(t("loading"))
  }

  if (!trnResults || trnResults.length === 0) {
    return (
      <div id="root" className="text-center py-8">
        <p className="text-gray-500 mb-4">{t("trn.noTransactions")}</p>
        <button
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          <i className="fa fa-arrow-left mr-2"></i>
          {t("back")}
        </button>
      </div>
    )
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
        {/* Mobile: Card layout grouped by broker */}
        <div className="md:hidden space-y-4">
          {groupedByBroker.map((group) => (
            <div key={group.broker?.id || "no-broker"}>
              {/* Broker Header */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-t-lg px-4 py-2 flex justify-between items-center">
                <span className="font-medium text-indigo-900">
                  <i className="fas fa-building mr-2 text-indigo-400"></i>
                  {group.broker?.name || t("trn.broker.none", "No Broker")}
                </span>
                <span className="text-sm text-indigo-600">
                  {group.transactions.length} {t("trades", "trades")}
                </span>
              </div>
              {/* Transactions */}
              <div className="space-y-2 border-l border-r border-indigo-200 bg-white">
                {group.transactions.map((trn: Transaction) => (
                  <div
                    key={trn.id}
                    className="p-4 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onDoubleClick={() =>
                      router.push(`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`)
                    }
                    title={t("actions.doubleClickToEdit")}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.trnType === "BUY"
                              ? "bg-green-100 text-green-800"
                              : trn.trnType === "SELL"
                                ? "bg-red-100 text-red-800"
                                : trn.trnType === "COST_ADJUST"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {trn.trnType}
                        </span>
                        <span
                          className="ml-2 text-sm font-medium text-gray-900"
                          title={trn.asset.name || trn.asset.code}
                        >
                          {trn.asset.code}
                          {trn.asset.name && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({trn.asset.name.length > 20 ? `${trn.asset.name.substring(0, 20)}...` : trn.asset.name})
                            </span>
                          )}
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
                        <span className="text-sm text-gray-500">{trn.tradeDate}</span>
                      </div>
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
                        <span className="text-gray-500">{t("trn.amount.trade")}:</span>
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
                    </div>
                  </div>
                ))}
              </div>
              {/* Group Totals */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-b-lg px-4 py-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-indigo-600">{t("trn.amount.trade")}:</span>
                    <span className="ml-1 font-semibold text-indigo-900">
                      <NumericFormat
                        value={group.totals.tradeAmount}
                        displayType={"text"}
                        decimalScale={2}
                        fixedDecimalScale={true}
                        thousandSeparator={true}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600">{t("trn.amount.cash")}:</span>
                    <span className="ml-1 font-semibold text-indigo-900">
                      <NumericFormat
                        value={group.totals.cashAmount}
                        displayType={"text"}
                        decimalScale={2}
                        fixedDecimalScale={true}
                        thousandSeparator={true}
                      />
                    </span>
                  </div>
                  {(group.totals.fees > 0 || group.totals.tax > 0) && (
                    <>
                      <div>
                        <span className="text-indigo-600">{t("trn.amount.charges")}:</span>
                        <span className="ml-1 font-semibold text-indigo-900">
                          <NumericFormat
                            value={group.totals.fees}
                            displayType={"text"}
                            decimalScale={2}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                      <div>
                        <span className="text-indigo-600">{t("trn.amount.tax")}:</span>
                        <span className="ml-1 font-semibold text-indigo-900">
                          <NumericFormat
                            value={group.totals.tax}
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
            </div>
          ))}
        </div>

        {/* Desktop: Table layout grouped by broker */}
        <div className="hidden md:block space-y-4">
          {groupedByBroker.map((group) => (
            <div key={group.broker?.id || "no-broker"} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Broker Header */}
              <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex justify-between items-center">
                <span className="font-medium text-indigo-900">
                  <i className="fas fa-building mr-2 text-indigo-400"></i>
                  {group.broker?.name || t("trn.broker.none", "No Broker")}
                </span>
                <span className="text-sm text-indigo-600">
                  {group.transactions.length} {t("trades", "trades")}
                </span>
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.type")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("asset", "Asset")}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.transactions.map((trn: Transaction) => (
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
                        <td className="px-4 py-3 whitespace-nowrap">{trn.trnType}</td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          title={trn.asset.name || trn.asset.code}
                        >
                          <div className="font-medium text-gray-900">
                            {trn.asset.code}
                          </div>
                          {trn.asset.name && (
                            <div className="text-xs text-gray-500 truncate max-w-32">
                              {trn.asset.name.length > 20
                                ? `${trn.asset.name.substring(0, 20)}...`
                                : trn.asset.name}
                            </div>
                          )}
                        </td>
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
                          {["ADD", "REDUCE", "SPLIT", "COST_ADJUST"].includes(
                            trn.trnType,
                          )
                            ? "-"
                            : trn.cashAsset?.market?.code === "CASH"
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
                  {/* Group Totals Row */}
                  <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                    <tr className="font-semibold text-indigo-900">
                      <td className="px-4 py-3" colSpan={4}>
                        {t("total", "Total")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.quantity}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.tradeAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.cashAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.tax}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.fees}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
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
