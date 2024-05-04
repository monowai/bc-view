import React, { ReactElement } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import Link from "next/link";
import { GroupByOption } from "@components/GroupBy";
import { HideEmpty } from "@components/HideEmpty";
import { Portfolios } from "@components/Portfolios";
import { Portfolio } from "@components/types/beancounter";

interface HoldingOptionsProps {
  portfolio: Portfolio;
}

export const HoldingOptions: React.FC<HoldingOptionsProps> = ({
  portfolio,
}): ReactElement => {
  const { t } = useTranslation("common");
  const router = useRouter();

  const handleAddTransaction = async (): Promise<void> => {
    await router.push("/trns");
  };

  return (
    <div className="filter-columns">
      <div className="filter-label">{t("option.portfolio")}</div>
      <div style={{ fontSize: "14px" }}>
        <Portfolios {...portfolio} />
      </div>
      <div className="filter-label">
        <Link href={`/portfolios/${portfolio.id}`} className="far fa-edit" />
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
          onClick={handleAddTransaction}
        >
          {t("trn.add")}
        </button>
      </div>
    </div>
  );
};
