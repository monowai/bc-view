import React from "react"
import { formatQuantity } from "@utils/formatters"
import type { HeldNotShown } from "types/beancounter"

/**
 * Holdings at the brokerage account that the screenshot does not show. A
 * screenshot can be partial, so nothing is proposed for them.
 */
export default function NotShownList({
  notShown,
}: {
  notShown: HeldNotShown[]
}): React.ReactElement | null {
  if (notShown.length === 0) return null
  return (
    <section aria-label="Held at this account but not in the image">
      <h3 className="font-semibold text-gray-900">
        Held at this account but not in the image
      </h3>
      <p className="text-gray-600 mt-1">
        An image may not show every holding, so nothing changes for these.
      </p>
      <ul className="mt-2 space-y-1 text-gray-900">
        {notShown.map((holding) => (
          <li key={holding.assetId}>
            {`${holding.code} (${holding.market}): ${formatQuantity(holding.quantity)} held`}
          </li>
        ))}
      </ul>
    </section>
  )
}
