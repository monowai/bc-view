import React from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"

export interface AdminMessage {
  type: "success" | "error"
  text: string
}

/** Page title with its New button, and the outcome of the last action. */
export function AdminCrudHeader({
  title,
  description,
  newLabel,
  showNew,
  onNew,
  message,
}: {
  title: string
  description: string
  newLabel: string
  showNew: boolean
  onNew: () => void
  message: AdminMessage | null
}): React.ReactElement {
  return (
    <>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
        {showNew && (
          <button
            onClick={onNew}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>
            {newLabel}
          </button>
        )}
      </div>

      {message && (
        <Alert
          variant={message.type === "success" ? "success" : "error"}
          className="mb-4"
        >
          {message.text}
        </Alert>
      )}
    </>
  )
}

export function AdminFormActions({
  onCancel,
  onSave,
  isSaving,
  invalid,
}: {
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
  invalid: boolean
}): React.ReactElement {
  const saveDisabled = isSaving || invalid
  return (
    <div className="flex justify-end space-x-3 mt-6">
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        {"Cancel"}
      </button>
      <button
        onClick={onSave}
        disabled={saveDisabled}
        className={`px-4 py-2 text-white rounded-lg transition-colors ${
          saveDisabled
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        {isSaving ? <Spinner label={"Saving..."} /> : "Save"}
      </button>
    </div>
  )
}

/** Card holding the list: spinner, then the empty state or the table. */
export function AdminListPanel({
  isLoading,
  isEmpty,
  emptyIcon,
  emptyText,
  children,
}: {
  isLoading: boolean
  isEmpty: boolean
  emptyIcon: string
  emptyText: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {isLoading ? (
        <div className="p-8 text-center text-gray-500">
          <Spinner label={"Loading..."} size="lg" />
        </div>
      ) : isEmpty ? (
        <div className="p-8 text-center text-gray-500">
          <i className={`fas ${emptyIcon} text-4xl mb-3`}></i>
          <p>{emptyText}</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function AdminRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}): React.ReactElement {
  return (
    <td className="px-4 py-3 text-right">
      <button
        onClick={onEdit}
        className="text-blue-600 hover:text-blue-800 mr-3"
        title={"Edit"}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        onClick={onDelete}
        className="text-red-600 hover:text-red-800"
        title={"Delete"}
      >
        <i className="fas fa-trash"></i>
      </button>
    </td>
  )
}

export function AdminDeleteDialog({
  title,
  prompt,
  onClose,
  onConfirm,
  isDeleting,
}: {
  title: string
  prompt: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}): React.ReactElement {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={onConfirm}
            label={"Delete"}
            loadingLabel={"Deleting..."}
            isSubmitting={isDeleting}
            variant="red"
          />
        </>
      }
    >
      <p className="text-gray-600">{prompt}</p>
    </Dialog>
  )
}
