import React from "react";
import { SubTotal } from "@domain/holdings/SubTotal";
import { calculate } from "@domain/holdings/calculate";
import { Holdings } from "@core/types/beancounter";
import Total from "@domain/holdings/Total";
import SummaryHeader, { SummaryRow } from "@domain/holdings/Summary";
import { Rows } from "@domain/holdings/Rows";
import { Header } from "@domain/holdings/Header";
import { rootLoader } from "@core/common/PageLoader";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import useSwr from "swr";
import { holdingKey, simpleFetcher } from "@core/api/fetchHelper";
import errorOut from "@core/errors/ErrorOut";
import { useHoldingState } from "@domain/holdings/holdingState";
import { HoldingOptions } from "@domain/holdings/HoldingOptions";

export default withPageAuthRequired(function Holdings(): React.ReactElement {
  const router = useRouter();
  const { data, error, isLoading } = useSwr(
    holdingKey(`${router.query.code}`),
    simpleFetcher(holdingKey(`${router.query.code}`))
  );
  const { t, ready } = useTranslation("common");
  const holdingState = useHoldingState();

  if (error && ready) {
    return errorOut(
      t("holdings.error.retrieve", { code: router.query.code }),
      error
    );
  }
  if (isLoading) {
    return rootLoader("Crunching data...");
  }
  const holdingResults = data.data;
  // Render where we are in the initialization process
  const holdings = calculate(
    holdingResults,
    holdingState.hideEmpty,
    holdingState.valueIn.value,
    holdingState.groupBy.value
  ) as Holdings;
  return (
    <div className="page-box">
      <HoldingOptions {...holdingResults.portfolio} />
      <div>
        <table className={"stats-container"}>
          <SummaryHeader {...holdingResults.portfolio} />
          <SummaryRow
            moneyValues={holdings.totals}
            valueIn={holdingState.valueIn.value}
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
                    valueIn={holdingState.valueIn.value}
                  />
                  <SubTotal
                    groupBy={groupKey}
                    subTotals={holdings.holdingGroups[groupKey].subTotals}
                    valueIn={holdingState.valueIn.value}
                  />
                </React.Fragment>
              );
            })}
          <Total holdings={holdings} valueIn={holdingState.valueIn.value} />
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
