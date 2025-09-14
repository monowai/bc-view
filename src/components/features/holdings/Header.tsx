import React, { ReactElement } from "react"
import { GroupKey } from "types/beancounter"
import { useTranslation } from "next-i18next"

export const headers = [
  { key: "asset.price", align: "left", mobile: true, medium: true },
  { key: "asset.change", align: "right", mobile: false, medium: false },
  { key: "gain.onday", align: "right", mobile: false, medium: false },
  { key: "quantity", align: "right", mobile: true, medium: true },
  { key: "cost", align: "right", mobile: false, medium: true },
  { key: "summary.value", align: "right", mobile: true, medium: true },
  { key: "summary.dividends", align: "right", mobile: false, medium: false },
  { key: "gain.unrealised", align: "right", mobile: true, medium: true },
  { key: "gain.realised", align: "right", mobile: false, medium: false },
  { key: "irr", align: "right", mobile: false, medium: false },
  { key: "weight", align: "right", mobile: false, medium: false },
  { key: "gain", align: "right", mobile: true, medium: true },
]

export default function Header({ groupKey }: GroupKey): ReactElement {
  const { t } = useTranslation("common")

  return (
    <thead className="bg-gray-100">
      <tr className="border-t-2 border-b-2 border-gray-400">
        <th className="px-2 py-2 sm:px-4 text-left text-xs sm:text-sm font-medium">
          {groupKey}
        </th>
        {headers.map((header) => {
          let visibility
          if (header.mobile) {
            visibility = ""
          } else if (header.medium) {
            visibility = "hidden md:table-cell"
          } else {
            visibility = "hidden xl:table-cell"
          }

          return (
            <th
              key={header.key}
              className={`px-1 py-2 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${header.align} ${visibility}`}
            >
              {t(header.key)}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
