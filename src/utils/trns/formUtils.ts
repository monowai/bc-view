import { Portfolio } from "types/beancounter"
import { convert } from "@utils/trns/tradeUtils"
import { useEffect } from "react"
import { postData } from "@components/DropZone"

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
  if (window.confirm(`Do you want to submit the transaction? \r\n${row}`)) {
    alert(row)
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
