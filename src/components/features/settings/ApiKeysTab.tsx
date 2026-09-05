import React, { useCallback, useState } from "react"
import Dialog from "@components/ui/Dialog"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Alert from "@components/ui/Alert"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { useApiKeys } from "@hooks/useApiKeys"
import { ApiKey, ApiKeyCreatedResponse, ApiKeyRequest } from "types/beancounter"
import {
  tableContainer,
  tableBase,
  theadBase,
  thBase,
  tbodyBase,
  trHover,
  tdBase,
} from "@utils/tableStyles"

function keyStatusBadge(key: ApiKey): React.ReactElement {
  if (key.revokedAt) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
        {"Revoked"}
      </span>
    )
  }
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        {"Expired"}
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      {"Active"}
    </span>
  )
}

/**
 * Settings tab for managing BC-issued API keys used by external agents/MCP
 * clients. Raw keys are only ever returned once, on creation — the list
 * view only ever shows the short `prefix`.
 */
export default function ApiKeysTab(): React.ReactElement {
  const { keys, error, isLoading, createKey, revokeKey } = useApiKeys()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [expiresDate, setExpiresDate] = useState("")
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(
    null,
  )
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const {
    isSubmitting,
    submitError,
    handleSubmit,
    reset: resetSubmit,
    setError: setSubmitError,
  } = useDialogSubmit({ fallbackError: "Failed to create API key" })

  const openCreateDialog = useCallback((): void => {
    setName("")
    setExpiresDate("")
    setCreatedKey(null)
    setCopied(false)
    setCopyFailed(false)
    resetSubmit()
    setIsCreateOpen(true)
  }, [resetSubmit])

  const closeCreateDialog = useCallback((): void => {
    setIsCreateOpen(false)
    setCreatedKey(null)
    setName("")
    setExpiresDate("")
    setCopied(false)
    setCopyFailed(false)
    resetSubmit()
  }, [resetSubmit])

  const handleCreateSubmit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setSubmitError("Name is required")
      return
    }
    await handleSubmit(async () => {
      const request: ApiKeyRequest = { name: trimmed, scopes: [] }
      if (expiresDate) {
        request.expiresAt = new Date(`${expiresDate}T23:59:59Z`).toISOString()
      }
      const created = await createKey(request)
      setCreatedKey(created)
    })
  }

  const handleCopy = async (): Promise<void> => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey.apiKey)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // The key disappears when this dialog closes - a silent copy failure
      // must not look like success.
      setCopyFailed(true)
    }
  }

  const handleRevokeConfirm = async (): Promise<void> => {
    if (!revokeTarget) return
    const id = revokeTarget.id
    setRevokeTarget(null)
    setBusyId(id)
    setRevokeError(null)
    try {
      await revokeKey(id)
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-sm text-gray-600 max-w-2xl">
          {
            "API keys let external agents and tools access your Beancounter data. Treat them like passwords."
          }
        </p>
        <button
          type="button"
          onClick={openCreateDialog}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium whitespace-nowrap"
        >
          <i className="fas fa-plus mr-2"></i>
          {"Create API Key"}
        </button>
      </div>

      {revokeError && (
        <Alert variant="error" className="mb-4">
          {revokeError}
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {"Failed to load API keys"}
        </Alert>
      )}

      {isLoading && <p className="text-sm text-gray-500">{"Loading…"}</p>}

      {!isLoading && !error && keys.length === 0 && (
        <p className="text-sm text-gray-500 italic">{"No API keys yet."}</p>
      )}

      {!isLoading && !error && keys.length > 0 && (
        <div className={tableContainer}>
          <table className={tableBase}>
            <thead className={theadBase}>
              <tr>
                <th className={thBase}>{"Name"}</th>
                <th className={thBase}>{"Key"}</th>
                <th className={thBase}>{"Status"}</th>
                <th className={thBase}>{"Created"}</th>
                <th className={thBase}>{"Last used"}</th>
                <th className={thBase}>{"Expires"}</th>
                <th className={thBase}></th>
              </tr>
            </thead>
            <tbody className={tbodyBase}>
              {keys.map((key) => (
                <tr key={key.id} className={trHover}>
                  <td className={tdBase}>{key.name}</td>
                  <td className={`${tdBase} font-mono`}>{`${key.prefix}…`}</td>
                  <td className={tdBase}>{keyStatusBadge(key)}</td>
                  <td className={tdBase}>
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className={tdBase}>
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className={tdBase}>
                    {key.expiresAt
                      ? new Date(key.expiresAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className={tdBase}>
                    {!key.revokedAt && (
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(key)}
                        disabled={busyId === key.id}
                        className="text-red-600 hover:text-red-700 disabled:text-gray-400 text-xs font-medium"
                      >
                        {busyId === key.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && !createdKey && (
        <Dialog
          title={"Create API Key"}
          onClose={closeCreateDialog}
          footer={
            <>
              <Dialog.CancelButton onClick={closeCreateDialog} />
              <Dialog.SubmitButton
                onClick={handleCreateSubmit}
                label={"Create"}
                loadingLabel={"Creating..."}
                isSubmitting={isSubmitting}
                disabled={!name.trim()}
                variant="green"
              />
            </>
          }
        >
          <Dialog.ErrorAlert message={submitError} />
          <div>
            <label
              htmlFor="apiKeyName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Name"}
            </label>
            <input
              id="apiKeyName"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={"e.g., Portfolio Agent"}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="apiKeyExpires"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Expires (optional)"}
            </label>
            <input
              id="apiKeyExpires"
              type="date"
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </Dialog>
      )}

      {isCreateOpen && createdKey && (
        <Dialog
          title={"API Key Created"}
          onClose={closeCreateDialog}
          footer={
            <Dialog.CancelButton onClick={closeCreateDialog} label={"Done"} />
          }
        >
          <Alert variant="warning">
            {
              "This key is shown only once. Copy it now — you won't be able to see it again."
            }
          </Alert>
          <div className="font-mono break-all bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-900">
            {createdKey.apiKey}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
            title={copied ? "Copied!" : "Copy to clipboard"}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            <i className={`fas ${copied ? "fa-check" : "fa-copy"} mr-2`}></i>
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          {copyFailed && (
            <p className="text-sm text-red-600">
              {"Copy failed — select the key above and copy it manually."}
            </p>
          )}
        </Dialog>
      )}

      {revokeTarget && (
        <ConfirmDialog
          title={"Revoke API Key"}
          message={
            "Revoking is immediate — anything using this key loses access on its next request."
          }
          confirmLabel={"Revoke Key"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleRevokeConfirm}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  )
}
