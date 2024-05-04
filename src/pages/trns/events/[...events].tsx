import React from "react";
import { NumericFormat } from "react-number-format";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { Transaction } from "@components/types/beancounter";
import useSwr from "swr";
import errorOut from "@components/errors/ErrorOut";
import { assetKey, eventKey, simpleFetcher } from "@utils/api/fetchHelper";
import {rootLoader} from "@components/PageLoader";
import { deleteTrn } from "@utils/trns/apiHelper";

export default withPageAuthRequired(function Events(): React.ReactElement {
  const router = useRouter();
  const portfolioId = router.query.events
    ? router.query.events[0]
    : "undefined";
  const assetId = router.query.events ? router.query.events[1] : "undefined";
  const { t } = useTranslation("common");
  const asset = useSwr(assetKey(assetId), simpleFetcher(assetKey(assetId)));
  const events = useSwr(
    eventKey(portfolioId, assetId),
    simpleFetcher(eventKey(portfolioId, assetId))
  );
  if (events.error) {
    return errorOut(t("events.error.retrieve"), events.error);
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error);
  }
  if (asset.isLoading) {
    return rootLoader(t("loading"));
  }
  if (events.isLoading) {
    return rootLoader(t("loading"));
  }
  const trnResults = events.data.data;
  if (!trnResults || trnResults.length === 0) {
    return <div id="root">{t("trn.noTransactions")}</div>;
  }

  return (
    <div>
      <nav className="container">
        <div className={"page-title"}>
          <div className={"column page-title subtitle is-6"}>
            {asset.data.data.name}:{asset.data.data.market.code}
          </div>
        </div>
      </nav>
      <div className="page-box is-primary has-background-light">
        <div className="container">
          <table className={"table is-striped is-hoverable"}>
            <thead>
              <tr>
                <th>{t("trn.type")}</th>
                <th>{t("trn.currency")}</th>
                <th>{t("trn.tradeDate")}</th>
                <th align={"right"}>{t("event.amount")}</th>
                <th align={"right"}>{t("trn.amount.tax")}</th>
                <th align={"right"}>{t("event.quantity")}</th>
                <th align={"right"}>{t("event.price")}</th>
                <th align={"right"}>{t("trn.rate.tb")}</th>
                <th align={"right"}>{t("trn.rate.tc")}</th>
                <th align={"right"}>{t("trn.rate.tp")}</th>
                <th>{t("trn.action")}</th>
              </tr>
            </thead>
            <tbody>
              {trnResults.map((trn: Transaction) => (
                <tr key={trn.id}>
                  <td>{trn.trnType}</td>
                  <td>{trn.tradeCurrency.code}</td>
                  <td>{trn.tradeDate}</td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tax}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={0}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.price}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeBaseRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeCashRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradePortfolioRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"left"}>
                    <Link
                      href={`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`}
                      className="fa fa-edit"
                    ></Link>
                    <a
                      onClick={() => deleteTrn(trn.id, t("trn.delete"))}
                      className="simple-padding fa fa-trash-can"
                    ></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
