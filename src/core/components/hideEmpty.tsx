import Switch from "react-switch";
import React from "react";
import { useHoldingState } from "@domain/holdings/holdingState";

export function HideEmpty(): JSX.Element {
  const holdingState = useHoldingState();
  return (
    /*// @ts-ignore */
    <Switch
      className="react-switch"
      onColor="#000"
      onChange={holdingState.toggleHideEmpty}
      checked={holdingState.hideEmpty}
      required
    />
  );
}
