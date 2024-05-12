import React from "react";
import { calculateHoldings } from "@utils/holdings/calculateHoldings";
import { Holdings } from "@components/types/beancounter";
import { rootLoader } from "@components/PageLoader";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import useSwr from "swr";
import { holdingKey, simpleFetcher } from "@utils/api/fetchHelper";
import errorOut from "@components/errors/ErrorOut";
import { useHoldingState } from "@utils/holdings/holdingState";
import { HoldingOptions } from "@components/holdings/HoldingOptions";
import SummaryHeader, { SummaryRow } from "@components/holdings/Summary";
import Rows from "@components/holdings/Rows";
import SubTotal from "@components/holdings/SubTotal";
import Header from "@components/holdings/Header";
import Total from "@components/holdings/Total";

function HoldingsPage(): React.ReactElement {
  const router = useRouter();
  const { data, error, isLoading } = useSwr(
    holdingKey(`${router.query.code}`),
    simpleFetcher(holdingKey(`${router.query.code}`)),
  );
  const { t, ready } = useTranslation("common");
  const holdingState = useHoldingState();

  if (error && ready) {
    console.error(error); // Log the error for debugging
    return errorOut(
      t("holdings.error.retrieve", { code: router.query.code }),
      error,
    );
  }
  if (isLoading) {
    return rootLoader("Crunching data...");
  }
  const holdingResults = data.data;
  // Render where we are in the initialization process
  const holdings = calculateHoldings(
    holdingResults,
    holdingState.hideEmpty,
    holdingState.valueIn.value,
    holdingState.groupBy.value,
  ) as Holdings;

  return (
    <div className="page-box">
      <HoldingOptions portfolio={holdingResults.portfolio} />
      <div>
        <table className={"stats-container"}>
          <SummaryHeader {...holdingResults.portfolio} />
          <SummaryRow totals={holdings.totals} currency={holdings.currency} />
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
}

export default withPageAuthRequired(HoldingsPage);

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
