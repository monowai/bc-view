const ICON_BUTTON_BASE =
  "rounded text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"

/** An icon button beside an asset's label: a tight hit area inside the text. */
export const INLINE_ICON_BUTTON = `-m-1.5 p-1.5 ${ICON_BUTTON_BASE}`

/** An icon button in a row of actions: a fixed 32px square. */
export const ROW_ICON_BUTTON = `inline-flex h-8 w-8 items-center justify-center ${ICON_BUTTON_BASE}`
