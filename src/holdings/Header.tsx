import React from "react";
import { translate } from "../common/i18nUtils";
import { GroupKey } from "../types/beancounter";

export function Header({ groupKey }: GroupKey): JSX.Element {
  return (
    <tbody className={"table-header"}>
      <tr>
        <th>{groupKey}</th>
        <th align={"right"}>{translate("price")}</th>
        <th align={"right"}>{translate("change")}</th>
        <th align={"right"}>{translate("quantity")}</th>
        <th align={"right"}>{translate("value")}</th>
        <th align={"right"}>{translate("gain.unrealised")}</th>
        <th align={"right"}>{translate("weight")}</th>
        <th align={"right"}>{translate("cost")}</th>
        <th align={"right"}>{translate("cost.avg")}</th>
        <th align={"right"}>{translate("dividends")}</th>
        <th align={"right"}>{translate("gain.realised")}</th>
        <th align={"right"}>{translate("gain")}</th>
      </tr>
    </tbody>
  );
}
