import Select from "react-select";
import React, {ReactElement} from "react";
import { useTranslation } from "next-i18next";
import { rootLoader } from "@core/common/PageLoader";
import useSwr from "swr";
import { portfoliosKey, simpleFetcher } from "@core/api/fetchHelper";
import { Portfolio } from "@core/types/beancounter";
import { useRouter } from "next/router";

export function Portfolios(selectedPortfolio: Portfolio): ReactElement {
  const { data } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey));
  const { t, ready } = useTranslation("common");
  const router = useRouter();
  if (!ready || !data) {
    return rootLoader(t("loading"));
  }
  const portfolios: Portfolio[] = data.data;

  return (
    <Select
      options={portfolios}
      defaultValue={selectedPortfolio}
      getOptionLabel={(portfolio) => portfolio.name}
      getOptionValue={(portfolio) => portfolio.code}
      isSearchable={false}
      isClearable={false}
      theme={(theme) => ({
        ...theme,
        borderRadius: 3,
        colors: {
          ...theme.colors,
          //primary25: 'hotpink',
          //primary: 'black',
        },
      })}
      onChange={(e) => {
        router.push(`${e!!.code}`).then();
      }}
    />
  );
}
