import React, { ReactElement } from "react"

export function rootLoader(message: string, show = true): ReactElement {
  if (!show) {
    return <div />
  }
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-50 h-screen w-screen"
      data-testid={"loading"}
    >
      <span className="text-white text-lg font-bold">{message}</span>
    </div>
  )
}
