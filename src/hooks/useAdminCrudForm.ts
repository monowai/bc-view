import { useState } from "react"
import type { AdminMessage } from "@components/features/admin/AdminCrud"

interface AdminCrudForm<F> {
  editingId: string | null
  isCreating: boolean
  formData: F
  message: AdminMessage | null
  setMessage: (message: AdminMessage | null) => void
  startCreate: () => void
  startEdit: (id: string, values: F) => void
  closeForm: () => void
  updateField: <K extends keyof F>(field: K, value: F[K]) => void
}

/** Create/edit form state for an admin list page. */
export function useAdminCrudForm<F>(defaults: F): AdminCrudForm<F> {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<F>(defaults)
  const [message, setMessage] = useState<AdminMessage | null>(null)

  const startCreate = (): void => {
    setFormData(defaults)
    setIsCreating(true)
    setEditingId(null)
    setMessage(null)
  }

  const startEdit = (id: string, values: F): void => {
    setFormData(values)
    setEditingId(id)
    setIsCreating(false)
    setMessage(null)
  }

  const closeForm = (): void => {
    setFormData(defaults)
    setEditingId(null)
    setIsCreating(false)
    setMessage(null)
  }

  const updateField = <K extends keyof F>(field: K, value: F[K]): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return {
    editingId,
    isCreating,
    formData,
    message,
    setMessage,
    startCreate,
    startEdit,
    closeForm,
    updateField,
  }
}
