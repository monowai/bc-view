import { useCallback, useState } from "react"
import { mutate } from "swr"
import { Transaction } from "types/beancounter"
import { holdingKey } from "@utils/api/fetchHelper"
import { deleteTrn } from "@utils/api/client/trns"

interface TrnListDelete {
  deletePending: boolean
  requestDelete: (trn: Transaction) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<void>
}

/** Delete-with-confirmation for a transaction list row. */
export function useTrnListDelete(refresh: () => unknown): TrnListDelete {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    portfolioCode: string
  } | null>(null)

  const requestDelete = useCallback((trn: Transaction): void => {
    setDeleteTarget({ id: trn.id, portfolioCode: trn.portfolio.code })
  }, [])

  const cancelDelete = useCallback((): void => setDeleteTarget(null), [])

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      const response = await deleteTrn(deleteTarget.id)
      if (response.ok) {
        setTimeout(() => {
          mutate(holdingKey(deleteTarget.portfolioCode, "today"))
          refresh()
        }, 1500)
      }
    } catch (err) {
      console.error("Error deleting transaction:", err)
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, refresh])

  return {
    deletePending: deleteTarget !== null,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
