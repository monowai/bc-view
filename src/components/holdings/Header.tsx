import React, { ReactElement } from "react";
import { GroupKey } from "@components/types/beancounter";
import { useTranslation } from "next-i18next";

export default function Header({ groupKey }: GroupKey): ReactElement {
  const { t } = useTranslation("common");
  return (
    <tbody className={"table-header"}>
      <tr>
        <th>{groupKey}</th>
        <th align={"right"}>{t("asset.price")}</th>
        <th align={"right"}>{t("asset.change")}</th>
        <th align={"right"}>{t("gain.onday")}</th>
        <th align={"right"}>{t("quantity")}</th>
        <th align={"right"}>{t("cost")}</th>
        <th align={"right"}>{t("cost.avg")}</th>
        <th align={"right"}>{t("summary.value")}</th>
        <th align={"right"}>{t("gain.unrealised")}</th>
        <th align={"right"}>{t("weight")}</th>
        <th align={"right"}>{t("summary.dividends")}</th>
        <th align={"right"}>{t("gain.realised")}</th>
        <th align={"right"}>{t("gain")}</th>
      </tr>
    </tbody>
  );
}
