import React, { useEffect, useMemo, useState } from "react"
import { useSWRConfig } from "swr"
import { PrivateAssetConfig, Transaction } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import DateInput from "@components/ui/DateInput"
import SubAccountBalanceInputs, {
  SubAccountRow,
} from "@components/features/holdings/SubAccountBalanceInputs"
import { getAssetCurrency, stripOwnerPrefix } from "@lib/assets/assetUtils"
import { holdingKey } from "@utils/api/fetchHelper"
import { updateTrn } from "@utils/trns/apiHelper"

interface SubAccountTrnEditModalProps {
  trn: Transaction
  onClose: () => void
  onDelete?: () => void
}

/**
 * Edit a composite-policy transaction (e.g. CPF) by its per-sub-account split,
 * presenting the same bucket data-entry display as the "set balance" dialog.
 * The new total drives quantity/tradeAmount; the sub-account map is PATCHed and
 * the backend overwrites the snapshot split. Cash legs and other fields are
 * preserved untouched.
 */
export default function SubAccountTrnEditModal({
  trn,
  onClose,
  onDelete,
}: SubAccountTrnEditModalProps): React.ReactElement {
  const { mutate } = useSWRConfig()
  const currency = getAssetCurrency(trn.asset) || trn.tradeCurrency.code

  const [date, setDate] = useState<string>(trn.tradeDate)
  const [values, setValues] = useState<Record<string, number>>(() => ({
    ...(trn.subAccounts ?? {}),
  }))
  // Canonical sub-account rows (code + displayName + order) come from the asset
  // config; fall back to the codes carried on the transaction itself.
  const [configRows, setConfigRows] = useState<SubAccountRow[] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchConfig = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/assets/config/${trn.asset.id}`)
        if (!res.ok) return
        const body: { data: PrivateAssetConfig } = await res.json()
        const subs = body.data?.subAccounts
        if (!cancelled && subs?.length) {
          setConfigRows(
            subs.map((s) => ({ code: s.code, displayName: s.displayName })),
          )
        }
      } catch {
        // No config — fall back to the transaction's own sub-account codes.
      }
    }
    fetchConfig()
    return () => {
      cancelled = true
    }
  }, [trn.asset.id])

  const rows: SubAccountRow[] = useMemo(() => {
    if (configRows) return configRows
    return Object.keys(trn.subAccounts ?? {}).map((code) => ({ code }))
  }, [configRows, trn.subAccounts])

  const total = useMemo(
    () => Object.values(values).reduce((sum, v) => sum + (v || 0), 0),
    [values],
  )

  const handleSave = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      const subAccounts = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v > 0),
      )
      const response = await updateTrn(trn.portfolio.id, trn.id, {
        trnType: trn.trnType,
        assetId: trn.asset.id,
        tradeDate: date,
        quantity: total,
        price: trn.price,
        tradeCurrency: trn.tradeCurrency.code,
        tradeAmount: total,
        cashCurrency: trn.cashCurrency || trn.tradeCurrency.code,
        cashAssetId: trn.cashAsset?.id,
        cashAmount: trn.cashAmount,
        fees: trn.fees,
        tax: trn.tax,
        comments: trn.comments,
        status: trn.status,
        modelId: trn.modelId,
        subAccounts,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.message || body.detail || "Failed to update transaction")
        return
      }
      setTimeout(() => {
        mutate(holdingKey(trn.portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
      }, 1500)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      title={"Edit CPF Transaction"}
      onClose={onClose}
      scrollable
      footer={
        <>
          {onDelete && (
            <Dialog.SubmitButton
              onClick={onDelete}
              label={"Delete"}
              variant="red"
            />
          )}
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label={"Save"}
            loadingLabel={"Saving..."}
            isSubmitting={isSubmitting}
            disabled={total <= 0}
            variant="amber"
          />
        </>
      }
    >
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="font-semibold text-lg">{trn.asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(trn.asset.code)} — {trn.trnType}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Transaction Date"}
        </label>
        <DateInput
          value={date}
          onChange={setDate}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <SubAccountBalanceInputs
        subAccounts={rows}
        values={values}
        onChange={(code, value) =>
          setValues((prev) => ({ ...prev, [code]: value }))
        }
        currency={currency}
        total={total}
      />

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
