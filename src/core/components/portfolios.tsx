import Select from "react-select";
import React from "react";
import { useTranslation } from "next-i18next";
import { rootLoader } from "@core/common/PageLoader";
import useSwr from "swr";
import { portfoliosKey, simpleFetcher } from "@core/api/fetchHelper";
import { Portfolio } from "@core/types/beancounter";
import {useRouter} from "next/router";

export function Portfolios(selectedPortfolio: Portfolio): JSX.Element {
  const { data } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey));
  const { t, ready } = useTranslation("common");
  if (!ready || !data) {
    return rootLoader(t("loading"));
  }
  const router = useRouter()
  const portfolios: Portfolio[] = data.data;

  return (
    <Select
      options={portfolios}
      defaultValue={selectedPortfolio}
      getOptionLabel={(portfolio) => portfolio.code}
      getOptionValue={(portfolio) => portfolio.code}
      isSearchable={false}
      isClearable={false}
      onChange={(e) => {
        router.push(`${e!!.code}`);
      }}
    />
  );
}
