import { Portfolio } from "types/beancounter"
import { convert } from "@lib/trns/tradeUtils"
import { postData } from "@components/ui/DropZone"

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
    return true
  } catch (err) {
    console.error("Failed to copy text: ", err)
    return false
  }
}

export const onSubmit = async (
  portfolio: Portfolio,
  errors: any,
  data: any,
  setTradeModalOpen: (open: boolean) => void,
): Promise<string | null> => {
  if (Object.keys(errors).length > 0) {
    console.log("Validation errors:", errors)
    return null
  }
  try {
    const row = convert(data)
    console.log("Submitting transaction:", row)
    const response = await postData(portfolio, false, row.split(","))
    if (response.ok) {
      setTradeModalOpen(false)
      return null
    }
    const errorData = await response.json().catch(() => ({}))
    console.error("Transaction failed:", response.status, errorData)
    return `Failed to submit transaction: ${errorData.error || response.statusText}`
  } catch (error) {
    console.error("Transaction submission error:", error)
    return `Failed to submit transaction: ${error instanceof Error ? error.message : "Unknown error"}`
  }
}
