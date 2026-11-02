import React from "react"
import MathInput from "@components/ui/MathInput"
import { INPUT_CLS } from "@lib/ui/formClasses"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import IndependenceSettingsFields from "@components/features/independence/IndependenceSettingsFields"
import { useIndependenceSettingsForm } from "@components/features/independence/useIndependenceSettingsForm"

interface IndependenceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function IndependenceSettingsModal({
  isOpen,
  onClose,
}: IndependenceSettingsModalProps): React.ReactElement | null {
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({
    onSuccess: onClose,
    autoCloseDelay: 0,
    fallbackError: "Failed to save settings. Please try again.",
  })
  const form = useIndependenceSettingsForm({
    isActive: isOpen,
    onReseed: () => setError(null),
  })

  if (!isOpen) return null

  const handleSave = async (): Promise<void> => {
    const validationError = form.validate()
    if (validationError) {
      setError(validationError)
      return
    }
    await handleSubmit(form.save)
  }

  return (
    <Dialog
      title="Independence Settings"
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label="Save Settings"
            loadingLabel="Saving..."
            isSubmitting={isSubmitting}
            variant="blue"
          />
        </>
      }
    >
      <p className="text-sm text-gray-600">
        These settings apply across all your independence plans.
      </p>

      <Dialog.ErrorAlert message={error} />

      <div className="space-y-4">
        <IndependenceSettingsFields
          monthOfBirth={form.monthOfBirth}
          onMonthOfBirthChange={form.setMonthOfBirth}
          ageDisplay={form.ageDisplay}
          targetIndependenceAge={form.targetIndependenceAge}
          lifeExpectancy={form.lifeExpectancy}
          yearOfBirthInput={
            <MathInput
              id="settings-yearOfBirth"
              value={form.yearOfBirth}
              onChange={(v) => form.setYearOfBirth(Math.round(v))}
              min={1920}
              max={form.maxYearOfBirth}
              className={INPUT_CLS}
            />
          }
          targetIndependenceAgeInput={
            <MathInput
              id="settings-targetIndependenceAge"
              value={form.targetIndependenceAge}
              onChange={(v) => form.setTargetIndependenceAge(Math.round(v))}
              min={18}
              max={100}
              className={INPUT_CLS}
            />
          }
          lifeExpectancyInput={
            <MathInput
              id="settings-lifeExpectancy"
              value={form.lifeExpectancy}
              onChange={(v) => form.setLifeExpectancy(Math.round(v))}
              min={50}
              max={120}
              className={INPUT_CLS}
            />
          }
        />
      </div>
    </Dialog>
  )
}
