import React, { useMemo } from "react"
import { Controller, Control } from "react-hook-form"
import Select from "react-select"
import { Asset, Currency } from "types/beancounter"
import { useTranslation } from "next-i18next"

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
  currencies?: Currency[]
  trnType: string
  defaultValue?: SettlementAccountOption
  currenciesLabel?: string // Label for currencies group
  accountsLabel?: string // Label for accounts group
  bankAccountsLabel?: string // Label for bank accounts group
}

// Convert accounts to select options with currency display
export const toSettlementAccountOptions = (
  accounts: Asset[],
): SettlementAccountOption[] => {
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.name || account.code} (${account.priceSymbol || account.market?.currency?.code || "?"})`,
    currency: account.priceSymbol || account.market?.currency?.code || "",
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
  currencies = [],
  trnType,
  defaultValue,
  currenciesLabel,
  accountsLabel,
  bankAccountsLabel,
}) => {
  const { t } = useTranslation("common")
  const disabled = isNoCashImpact(trnType)

  // Build grouped options
  const groupedOptions = useMemo((): GroupedOption[] => {
    const groups: GroupedOption[] = []

    // Add currencies group
    if (currencies.length > 0) {
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

    return groups
  }, [
    accounts,
    bankAccounts,
    currencies,
    t,
    currenciesLabel,
    accountsLabel,
    bankAccountsLabel,
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
