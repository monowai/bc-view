import { ValueInOption } from "@core/components/valueIn";
import { GroupByOption } from "@core/components/groupBy";
import { HideEmpty } from "@core/components/hideEmpty";
import React from "react";
import { useTranslation } from "next-i18next";

export function HoldingOptions(): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <div className="filter-columns">
      <div className="filter-label">{t("holdings.valueIn")}</div>
      <div className="filter-column">
        <ValueInOption />
      </div>
      <div className="filter-label">{t("holdings.groupBy")}</div>
      <div className="filter-column">
        <GroupByOption />
      </div>
      <div className="filter-label">{t("holdings.openOnly")}</div>
      <div className="filter-column">
        <HideEmpty />
      </div>
      <div className="filter-column">
        <button
          className="navbar-item button is-link is-small"
          onClick={() => {}}
        >
          {t("trn.add")}
        </button>
      </div>
    </div>
  );
}
