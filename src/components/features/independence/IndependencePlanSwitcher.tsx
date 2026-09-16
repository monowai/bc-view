import React, { useState } from "react"
import type { IndependencePlan } from "types/independence"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Dialog from "@components/ui/Dialog"

type NameDialogMode = "create" | "rename" | "duplicate"

const NAME_DIALOG_COPY: Record<
  NameDialogMode,
  { title: string; label: string; submit: string }
> = {
  create: { title: "New plan", label: "Plan name", submit: "Create" },
  rename: { title: "Rename plan", label: "Plan name", submit: "Save" },
  duplicate: {
    title: "Duplicate plan",
    label: "New plan name",
    submit: "Copy",
  },
}

/** Understated link-style action, used while there is only one plan. */
const QUIET_LINK_CLASS =
  "text-sm font-medium text-independence-600 hover:text-independence-700 focus:outline-none focus:ring-1 focus:ring-independence-500 rounded"

const ACTION_BUTTON_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-independence-500 disabled:opacity-50 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"

/**
 * Switch between the user's independence plans — the journeys they are
 * comparing ("With Property" against "No Property"). The selection lives in
 * the URL as `?plan=<id>`; see {@link useActiveIndependencePlan}.
 *
 * Stays out of the way until there is something to switch between: nothing
 * at all with no journeys, and a single quiet "add a plan" affordance with
 * one.
 */
export default function IndependencePlanSwitcher(): React.ReactElement | null {
  const {
    plans,
    isLoading,
    activePlan,
    activePlanId,
    setActivePlan,
    create,
    update,
    duplicate,
    setPrimary,
    remove,
  } = useActiveIndependencePlan()

  const [nameDialog, setNameDialog] = useState<NameDialogMode | null>(null)
  const [nameValue, setNameValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seedName = (mode: NameDialogMode): string => {
    if (mode === "rename") return activePlan?.name ?? ""
    if (mode === "duplicate") return `${activePlan?.name ?? "Plan"} (copy)`
    return ""
  }

  const openNameDialog = (mode: NameDialogMode): void => {
    setError(null)
    setNameValue(seedName(mode))
    setNameDialog(mode)
  }

  const run = async (action: () => Promise<void>): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      await action()
      setNameDialog(null)
      setConfirmDelete(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameSubmit = (): void => {
    const name = nameValue.trim()
    // The in-flight guard lives here rather than on each caller: the submit
    // button disables itself while submitting, but Enter in the name field
    // doesn't, so holding it fired a create per repeat and left the user with
    // a pile of identically named plans.
    if (!name || !nameDialog || isSubmitting) return
    void run(async () => {
      if (nameDialog === "create") {
        const created = await create({ name })
        setActivePlan(created.id)
      } else if (nameDialog === "rename" && activePlanId) {
        await update(activePlanId, { name })
      } else if (nameDialog === "duplicate" && activePlanId) {
        const copy = await duplicate(activePlanId, { name })
        setActivePlan(copy.id)
      }
    })
  }

  const nameDialogNode = nameDialog && (
    <Dialog
      title={NAME_DIALOG_COPY[nameDialog].title}
      onClose={() => setNameDialog(null)}
      maxWidth="sm"
      footer={
        <>
          <Dialog.CancelButton onClick={() => setNameDialog(null)} />
          <Dialog.SubmitButton
            onClick={handleNameSubmit}
            label={NAME_DIALOG_COPY[nameDialog].submit}
            variant="blue"
            isSubmitting={isSubmitting}
            disabled={!nameValue.trim()}
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <label
        htmlFor="independence-plan-name"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {NAME_DIALOG_COPY[nameDialog].label}
      </label>
      <input
        id="independence-plan-name"
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleNameSubmit()
        }}
      />
    </Dialog>
  )

  // Nothing to switch between yet — creation of the first journey happens
  // with the first plan, not here.
  if (isLoading || plans.length === 0) return null

  if (plans.length === 1) {
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => openNameDialog("create")}
            className={QUIET_LINK_CLASS}
            title="Map out an alternative plan alongside this one"
          >
            <i className="fas fa-plus mr-1.5 text-xs"></i>
            Add a plan to compare
          </button>
          {/*
           * Forking the only plan is how the second one usually gets made —
           * "the same life, but renting" starts from the figures already
           * captured, not from an empty plan. Offering Duplicate only once a
           * second plan existed had it backwards (svc-retire#260). Rename and
           * Delete stay behind the switcher: with one plan there is nothing to
           * disambiguate, and deleting it is not a one-click affordance.
           */}
          <button
            type="button"
            onClick={() => openNameDialog("duplicate")}
            className={QUIET_LINK_CLASS}
            title="Copy this plan and its phases under a new name"
          >
            <i className="fas fa-copy mr-1.5 text-xs"></i>
            Duplicate this plan
          </button>
        </div>
        {nameDialogNode}
      </>
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label
          htmlFor="independence-plan-switcher"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Plan
        </label>
        <select
          id="independence-plan-switcher"
          value={activePlanId ?? ""}
          onChange={(e) => setActivePlan(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500 dark:border-gray-700"
        >
          {plans.map((plan: IndependencePlan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
              {plan.isPrimary ? " (default)" : ""}
            </option>
          ))}
        </select>
        {activePlan && !activePlan.isPrimary && (
          <button
            type="button"
            className={ACTION_BUTTON_CLASS}
            title="Make this the default plan"
            onClick={() => void run(() => setPrimary(activePlan.id))}
            disabled={isSubmitting}
          >
            <i className="fas fa-star text-[10px]"></i>
            Make default
          </button>
        )}
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          title="Rename this plan"
          onClick={() => openNameDialog("rename")}
        >
          <i className="fas fa-pen text-[10px]"></i>
          Rename
        </button>
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          title="Copy this plan and its phases"
          onClick={() => openNameDialog("duplicate")}
        >
          <i className="fas fa-copy text-[10px]"></i>
          Duplicate
        </button>
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          title="Create another plan"
          onClick={() => openNameDialog("create")}
        >
          <i className="fas fa-plus text-[10px]"></i>
          New
        </button>
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          title="Delete this plan"
          onClick={() => {
            setError(null)
            setConfirmDelete(true)
          }}
          disabled={isSubmitting}
        >
          <i className="fas fa-trash text-[10px]"></i>
          Delete
        </button>
      </div>
      {error && !nameDialog && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}
      {nameDialogNode}
      {confirmDelete && activePlan && (
        <ConfirmDialog
          title="Delete plan"
          message={`Delete "${activePlan.name}"? Its phases are kept and detached — only the plan itself goes.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="red"
          onConfirm={() => void run(() => remove(activePlan.id))}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
