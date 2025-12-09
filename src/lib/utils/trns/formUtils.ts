import { Portfolio } from "types/beancounter"
import { convert } from "@lib/trns/tradeUtils"
import { useEffect } from "react"
import { postData } from "@components/ui/DropZone"

export const copyToClipboard = (text: string): void => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Failed to copy text: ", err)
    })
  } else {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      document.execCommand("copy")
    } catch (err) {
      console.error("Fallback: Failed to copy text: ", err)
    }
    document.body.removeChild(textarea)
  }
}

export const onSubmit = (
  portfolio: Portfolio,
  errors: any,
  data: any,
  setTradeModalOpen: (open: boolean) => void,
): void => {
  if (Object.keys(errors).length > 0) {
    console.log("Validation errors:", errors)
    return
  }
  const row = convert(data)
  if (window.confirm("Submit the transaction?")) {
    postData(portfolio, false, row.split(",")).then()
    setTradeModalOpen(false)
  } else {
    console.log("Transaction submission canceled")
  }
}

export const useEscapeHandler = (
  isDirty: boolean,
  setModalOpen: (open: boolean) => void,
): void => {
  useEffect((): (() => void) => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (isDirty) {
          if (
            window.confirm(
              "You have unsaved changes. Do you really want to close?",
            )
          ) {
            setModalOpen(false)
          }
        } else {
          setModalOpen(false)
        }
      }
    }

    document.addEventListener("keydown", handleEscape)
    return (): void => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isDirty, setModalOpen])
}

export default useEscapeHandler
