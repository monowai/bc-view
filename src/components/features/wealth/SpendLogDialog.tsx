import React from "react"
import { useSWRConfig } from "swr"
import { portfoliosKey } from "@utils/api/client/portfolios"
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
  initialMonth,
}: {
  onClose: () => void
  /** `YYYY-MM` to open on; defaults to the current month. */
  initialMonth?: string
}): React.ReactElement {
  const log = useSpendLog()
  const { mutate } = useSWRConfig()

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
      initialMonth={initialMonth ?? monthOf(new Date())}
      historyMonths={log.historyMonths}
      planCurrency={log.planCurrency}
      budgetsUnavailable={log.budgetsUnavailable}
      categoriesUnavailable={log.categoriesUnavailable}
      accounts={log.accounts}
      debits={log.debits}
      rememberedAccount={log.rememberedAccount}
      onClose={onClose}
      onSaved={() => {
        log.refresh()
        // A save can post, move or remove a bank withdrawal.
        void mutate(portfoliosKey)
        void mutate(
          (key) => typeof key === "string" && key.startsWith("/api/holdings"),
        )
        onClose()
      }}
    />
  )
}
