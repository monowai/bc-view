import React, { ReactElement, useState } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import Link from "next/link";
import { HideEmpty } from "@components/HideEmpty";
import { Portfolios } from "@components/Portfolios";
import { Portfolio } from "@components/types/beancounter";
import GroupByOptions from "@components/holdings/GroupByOptions";
import TrnInputForm from "@pages/trns/input";

interface HoldingOptionsProps {
  portfolio: Portfolio;
}

export const HoldingOptions: React.FC<HoldingOptionsProps> = ({
  portfolio,
}): ReactElement => {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        <GroupByOptions />
      </div>
      <div className="filter-label">{t("holdings.openOnly")}</div>
      <div className="filter-column">
        <HideEmpty />
      </div>
      <div className="filter-column">
        <TrnInputForm
          portfolio={portfolio}
          isOpen={isModalOpen}
          closeModal={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  );
};
