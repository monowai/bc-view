import React, { ReactElement } from "react"
import { GroupKey } from "types/beancounter"
import { useTranslation } from "next-i18next"

export const headers = [
  { key: "asset.price", align: "left" },
  { key: "asset.change", align: "right" },
  { key: "quantity", align: "right" },
  { key: "cost", align: "right" },
  { key: "summary.value", align: "right" },
  { key: "gain.onday", align: "right" },
  { key: "gain.unrealised", align: "right" },
  { key: "gain.realised", align: "right" },
  { key: "summary.dividends", align: "right" },
  { key: "irr", align: "right" },
  { key: "weight", align: "right" },
  { key: "gain", align: "right" },
]

export default function Header({ groupKey }: GroupKey): ReactElement {
  const { t } = useTranslation("common")

  return (
    <thead className="bg-gray-100">
      <tr>
        <th className="px-4 py-2 text-left">{groupKey}</th>
        {headers.map((header) => (
          <th key={header.key} className={`px-4 py-2 text-${header.align}`}>
            {t(header.key)}
          </th>
        ))}
      </tr>
    </thead>
  )
}
