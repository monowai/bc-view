import React from "react"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import SpendDialog from "@components/features/wealth/SpendDialog"
import { useSpendLog } from "@components/features/wealth/useSpendLog"
import { monthOf } from "@lib/independence/spendSummary"

/**
 * The spend log, loading its own data so it opens from anywhere: the Plan
 * menu or the dashboard card. Needs no plan; the primary plan, if any, only
 * adds a budget. A save refreshes every view of the log.
 */
export default function SpendLogDialog({
  onClose,
}: {
  onClose: () => void
}): React.ReactElement {
  const log = useSpendLog()

  if (log.isLoading) {
    return (
      <Dialog title="Monthly Spend" onClose={onClose}>
        <Spinner label="Loading…" />
      </Dialog>
    )
  }
  const currency = log.currency ?? ""
  return (
    <SpendDialog
      categories={log.categories}
      budgets={log.budgets}
      entries={log.entries}
      currency={currency}
      // Several currencies share "$"; the code says which one.
      currencySymbol={`${currency} `}
      initialMonth={monthOf(new Date())}
      historyMonths={log.historyMonths}
      planCurrency={log.planCurrency}
      budgetsUnavailable={log.budgetsUnavailable}
      categoriesUnavailable={log.categoriesUnavailable}
      onClose={onClose}
      onSaved={() => {
        log.refresh()
        onClose()
      }}
    />
  )
}
