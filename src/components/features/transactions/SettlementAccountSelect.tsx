import React, { useMemo } from "react"
import { Controller, Control } from "react-hook-form"
import Select from "react-select"
import { Asset, Currency } from "types/beancounter"
import { useTranslation } from "next-i18next"
import { getDisplayCode, getAssetCurrency } from "@lib/assets/assetUtils"

// Transaction types that do not impact cash positions
const NO_CASH_IMPACT_TYPES = ["ADD", "REDUCE", "SPLIT", "BALANCE"] as const

export interface SettlementAccountOption {
  value: string // Asset ID or currency code
  label: string // Display: "WISE (NZD)" or "USD"
  currency: string // Currency code for calculations
  market?: string // "CASH" for currencies, "PRIVATE" for accounts
}

interface GroupedOption {
  label: string
  options: SettlementAccountOption[]
}

interface SettlementAccountSelectProps {
  name: string
  control: Control<any>
  accounts: Asset[]
  bankAccounts?: Asset[] // Optional bank accounts (category: ACCOUNT)
  cashAssets?: Asset[] // Optional cash assets (CASH market - generic balances)
  currencies?: Currency[]
  trnType: string
  tradeCurrency?: string // Current trade currency for grouping recommendations
  defaultValue?: SettlementAccountOption
  currenciesLabel?: string // Label for currencies group
  accountsLabel?: string // Label for accounts group
  bankAccountsLabel?: string // Label for bank accounts group
  cashAssetsLabel?: string // Label for cash assets group
}

// Convert accounts to select options with currency display
export const toSettlementAccountOptions = (
  accounts: Asset[],
): SettlementAccountOption[] => {
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.name || getDisplayCode(account)} (${getAssetCurrency(account) || "?"})`,
    currency: getAssetCurrency(account),
    market: "PRIVATE",
  }))
}

// Convert currencies to select options
export const toCurrencyOptions = (
  currencies: Currency[],
): SettlementAccountOption[] => {
  return currencies.map((currency) => ({
    value: currency.code,
    label: currency.code,
    currency: currency.code,
    market: "CASH",
  }))
}

// Convert cash assets (CASH market) to select options
export const toCashAssetOptions = (
  cashAssets: Asset[],
): SettlementAccountOption[] => {
  return cashAssets.map((asset) => ({
    value: asset.id,
    label: `${asset.name || asset.code} Balance`,
    currency: asset.code,
    market: "CASH",
  }))
}

// Check if the transaction type requires no cash settlement
export const isNoCashImpact = (trnType: string): boolean => {
  return NO_CASH_IMPACT_TYPES.includes(
    trnType as (typeof NO_CASH_IMPACT_TYPES)[number],
  )
}

const SettlementAccountSelect: React.FC<SettlementAccountSelectProps> = ({
  name,
  control,
  accounts,
  bankAccounts = [],
  cashAssets = [],
  currencies = [],
  trnType,
  tradeCurrency,
  defaultValue,
  currenciesLabel,
  accountsLabel,
  bankAccountsLabel,
  cashAssetsLabel,
}) => {
  const { t } = useTranslation("common")
  const disabled = isNoCashImpact(trnType)

  // Helper to get currency from asset (uses imported getAssetCurrency)

  // Build grouped options with "Recommended" grouping when tradeCurrency is provided
  const groupedOptions = useMemo((): GroupedOption[] => {
    const groups: GroupedOption[] = []

    if (tradeCurrency) {
      // Split into recommended (matching currency) and other
      const recommendedCashAssets = cashAssets.filter(
        (a) => a.code === tradeCurrency,
      )
      const otherCashAssets = cashAssets.filter((a) => a.code !== tradeCurrency)
      const recommendedBankAccounts = bankAccounts.filter(
        (a) => getAssetCurrency(a) === tradeCurrency,
      )
      const otherBankAccounts = bankAccounts.filter(
        (a) => getAssetCurrency(a) !== tradeCurrency,
      )
      const recommendedAccounts = accounts.filter(
        (a) => getAssetCurrency(a) === tradeCurrency,
      )
      const otherAccounts = accounts.filter(
        (a) => getAssetCurrency(a) !== tradeCurrency,
      )

      // Combine all recommended options
      const recommendedOptions: SettlementAccountOption[] = [
        ...toCashAssetOptions(recommendedCashAssets),
        ...toSettlementAccountOptions(recommendedBankAccounts),
        ...toSettlementAccountOptions(recommendedAccounts),
      ]

      if (recommendedOptions.length > 0) {
        groups.push({
          label: t("settlement.recommended", "Recommended"),
          options: recommendedOptions,
        })
      }

      // Add other cash balances
      if (otherCashAssets.length > 0) {
        groups.push({
          label:
            cashAssetsLabel || t("settlement.otherBalances", "Other Balances"),
          options: toCashAssetOptions(otherCashAssets),
        })
      }

      // Add other bank accounts
      if (otherBankAccounts.length > 0) {
        groups.push({
          label:
            bankAccountsLabel ||
            t("settlement.otherBankAccounts", "Other Bank Accounts"),
          options: toSettlementAccountOptions(otherBankAccounts),
        })
      }

      // Add other trade accounts
      if (otherAccounts.length > 0) {
        groups.push({
          label:
            accountsLabel || t("settlement.otherAccounts", "Other Accounts"),
          options: toSettlementAccountOptions(otherAccounts),
        })
      }
    } else {
      // Original behavior when no tradeCurrency specified
      // Add cash assets group first (generic balances like "USD Balance")
      if (cashAssets.length > 0) {
        groups.push({
          label:
            cashAssetsLabel || t("settlement.cashBalances", "Cash Balances"),
          options: toCashAssetOptions(cashAssets),
        })
      }

      // Add currencies group (fallback if no cash assets)
      if (currencies.length > 0 && cashAssets.length === 0) {
        groups.push({
          label: currenciesLabel || t("settlement.currencies", "Currencies"),
          options: toCurrencyOptions(currencies),
        })
      }

      // Add bank accounts group (if provided)
      if (bankAccounts.length > 0) {
        groups.push({
          label:
            bankAccountsLabel || t("settlement.bankAccounts", "Bank Accounts"),
          options: toSettlementAccountOptions(bankAccounts),
        })
      }

      // Add trade accounts group
      if (accounts.length > 0) {
        groups.push({
          label: accountsLabel || t("settlement.accounts", "Accounts"),
          options: toSettlementAccountOptions(accounts),
        })
      }
    }

    return groups
  }, [
    accounts,
    bankAccounts,
    cashAssets,
    currencies,
    tradeCurrency,
    t,
    currenciesLabel,
    accountsLabel,
    bankAccountsLabel,
    cashAssetsLabel,
  ])

  // No Settlement option shown when disabled
  const noSettlementOption: SettlementAccountOption = {
    value: "",
    label: t("trn.settlement.none"),
    currency: "",
  }

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={disabled ? noSettlementOption : defaultValue}
      render={({ field }) => (
        <Select
          {...field}
          options={disabled ? [noSettlementOption] : groupedOptions}
          value={disabled ? noSettlementOption : field.value}
          isDisabled={disabled}
          placeholder={t("trn.settlement.select")}
          menuPortalTarget={
            typeof document !== "undefined" ? document.body : null
          }
          menuPosition="fixed"
          styles={{
            control: (base) => ({
              ...base,
              backgroundColor: disabled ? "#f3f4f6" : base.backgroundColor,
              cursor: disabled ? "not-allowed" : "default",
            }),
            menuPortal: (base) => ({
              ...base,
              zIndex: 9999,
            }),
          }}
          onChange={(selected) => {
            if (!disabled && selected) {
              field.onChange(selected)
            }
          }}
        />
      )}
    />
  )
}

export default SettlementAccountSelect
