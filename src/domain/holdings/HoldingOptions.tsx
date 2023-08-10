import { GroupByOption } from "@core/components/GroupBy";
import { HideEmpty } from "@core/components/HideEmpty";
import React, { ReactElement } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { Portfolios } from "@core/components/Portfolios";
import { Portfolio } from "@core/types/beancounter";
import Link from "next/link";

export function HoldingOptions(portfolio: Portfolio): ReactElement {
  const { t } = useTranslation("common");
  const router = useRouter();
  return (
    <div className="filter-columns">
      <div className="filter-label">{t("option.portfolio")}</div>
      <div style={{ fontSize: 14 }}>
        <Portfolios {...portfolio} />
      </div>
      <div className="filter-label">
        <Link
          href={`/portfolios/${portfolio.id}`}
          className="far fa-edit"
        ></Link>
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
            router.push("/trns").then();
          }}
        >
          {t("trn.add")}
        </button>
      </div>
    </div>
  );
}
