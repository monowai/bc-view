import { ValueInOption } from "@core/components/ValueIn";
import { GroupByOption } from "@core/components/GroupBy";
import { HideEmpty } from "@core/components/HideEmpty";
import React, {ReactElement} from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";

export function HoldingOptions(): ReactElement {
  const { t } = useTranslation("common");
  const router = useRouter();
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
          onClick={() => {
            router.push("/trns");
          }}
        >
          {t("trn.add")}
        </button>
      </div>
    </div>
  );
}
