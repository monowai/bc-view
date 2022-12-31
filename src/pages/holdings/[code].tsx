import React, { useState } from "react";
import { SubTotal } from "@/domain/holdings/SubTotal";
import { calculate } from "@/domain/holdings/calculate";
import { defaultGroup, groupOptions } from "@/types/groupBy";
import { GroupOption, Holdings, ValuationOption } from "@/types/beancounter";
import Total from "@/domain/holdings/Total";
import SummaryHeader, { SummaryRow } from "@/domain/holdings/Summary";
import Switch from "react-switch";
import Select, { OnChangeValue } from "react-select";
import { valuationOptions, ValueIn } from "@/types/constants";
import { Rows } from "@/domain/holdings/Rows";
import { Header } from "@/domain/holdings/Header";
import { rootLoader } from "@/core/common/PageLoader";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import useSwr from "swr";
import { holdingKey, simpleFetcher } from "@/core/api/fetchHelper";
import errorOut from "@/core/errors/ErrorOut";

// import { TrnDropZone } from "../../domain/portfolio/DropZone";
export default withPageAuthRequired(function Holdings(): React.ReactElement {
  const router = useRouter();
  const { data, error, isLoading } = useSwr(
    holdingKey(`${router.query.code}`),
    simpleFetcher(holdingKey(`${router.query.code}`))
  );
  const { t, ready } = useTranslation("common");
  const [valueIn, setValueIn] = useState<ValuationOption>({
    value: ValueIn.PORTFOLIO,
    label: "Portfolio",
  });
  const [hideEmpty, setHideEmpty] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<GroupOption>(groupOptions()[defaultGroup]);

  if (error && ready) {
    return errorOut(t("holdings.error.retrieve", { code: router.query.code }), error);
  }
  if (isLoading) {
    return rootLoader("Crunching data...");
  }
  const holdingResults = data.data;
  // Render where we are in the initialization process
  const holdings = calculate(holdingResults, hideEmpty, valueIn.value, groupBy.value) as Holdings;
  return (
    <div className="page-box">
      <div className="filter-columns">
        <div className="filter-label">Value In</div>
        <div className="filter-column">
          <Select
            options={valuationOptions()}
            defaultValue={valueIn}
            isSearchable={false}
            isClearable={false}
            onChange={(newValue: OnChangeValue<ValuationOption, false>) => {
              if (newValue) {
                setValueIn(newValue as ValuationOption);
              }
            }}
          />
        </div>
        <div className="filter-label">{t("holdings.groupBy")}</div>
        <div className="filter-column">
          <Select
            options={groupOptions()}
            defaultValue={groupBy}
            isSearchable={false}
            isClearable={false}
            onChange={(newValue: OnChangeValue<GroupOption, false>) => {
              if (newValue) {
                setGroupBy(newValue as GroupOption);
              }
            }}
          />
        </div>
        <div className="filter-label">Open Only</div>
        <div className="filter-column">
          <Switch
            className="react-switch"
            onColor="#000"
            onChange={setHideEmpty}
            checked={hideEmpty}
            required
          />
        </div>
      </div>
      <div className={"stats-container"}>
        <table>
          <SummaryHeader {...holdingResults.portfolio} />
          <SummaryRow
            portfolio={holdingResults.portfolio}
            moneyValues={holdings.totals}
            valueIn={valueIn.value}
          />
        </table>
      </div>
      <div className={"all-getData"}>
        <table className={"table is-striped is-hoverable"}>
          {Object.keys(holdings.holdingGroups)
            .sort()
            .map((groupKey) => {
              return (
                <React.Fragment key={groupKey}>
                  <Header groupKey={groupKey} />
                  <Rows
                    portfolio={holdingResults.portfolio}
                    groupBy={groupKey}
                    holdingGroup={holdings.holdingGroups[groupKey]}
                    valueIn={valueIn.value}
                  />
                  <SubTotal
                    groupBy={groupKey}
                    subTotals={holdings.holdingGroups[groupKey].subTotals}
                    valueIn={valueIn.value}
                  />
                </React.Fragment>
              );
            })}
          <Total holdings={holdings} valueIn={valueIn.value} />
        </table>
      </div>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
