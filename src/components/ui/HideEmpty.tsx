import Switch from "react-switch"
import React, { ReactElement } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"

export function HideEmpty(): ReactElement {
  const holdingState = useHoldingState()
  return (
    <Switch
      className="react-switch"
      onColor="#000"
      onChange={holdingState.toggleHideEmpty}
      checked={holdingState.hideEmpty}
      required
    />
  )
}
