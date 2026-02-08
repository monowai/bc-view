import { useState, useCallback } from "react"

interface UseDialogSubmitOptions {
  onSuccess?: () => void
  autoCloseDelay?: number
  fallbackError?: string
}

interface UseDialogSubmitResult {
  isSubmitting: boolean
  submitError: string | null
  submitSuccess: boolean
  handleSubmit: (fn: () => Promise<void>) => Promise<void>
  reset: () => void
  setError: (msg: string | null) => void
}

export function useDialogSubmit({
  onSuccess,
  autoCloseDelay = 1000,
  fallbackError = "An error occurred",
}: UseDialogSubmitOptions = {}): UseDialogSubmitResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const reset = useCallback((): void => {
    setIsSubmitting(false)
    setSubmitError(null)
    setSubmitSuccess(false)
  }, [])

  const handleSubmit = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        await fn()
        setSubmitSuccess(true)

        if (onSuccess && autoCloseDelay > 0) {
          setTimeout(() => {
            onSuccess()
          }, autoCloseDelay)
        } else if (onSuccess) {
          onSuccess()
        }
      } catch (error: unknown) {
        setSubmitError(error instanceof Error ? error.message : fallbackError)
      } finally {
        setIsSubmitting(false)
      }
    },
    [onSuccess, autoCloseDelay, fallbackError],
  )

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    handleSubmit,
    reset,
    setError: setSubmitError,
  }
}
