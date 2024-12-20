import React, { ReactElement } from "react"
import { GroupKey } from "@components/types/beancounter"
import { useTranslation } from "next-i18next"

export const headers = [
  "asset.price",
  "asset.change",
  "quantity",
  "cost",
  "summary.value",
  "gain.onday",
  "gain.unrealised",
  "gain.realised",
  "summary.dividends",
  "irr",
  "weight",
  "gain",
]

export default function Header({ groupKey }: GroupKey): ReactElement {
  const { t } = useTranslation("common")

  return (
    <tbody className={"table-header"}>
      <tr>
        <th>{groupKey}</th>
        {headers.map((header) => (
          <th key={header} align={"right"}>
            {t(header)}
          </th>
        ))}
      </tr>
    </tbody>
  )
}
