import React from "react";
import { NumericFormat } from "react-number-format";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/router";
import { assetKey, simpleFetcher, tradeKey } from "@core/api/fetchHelper";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { Transaction } from "@core/types/beancounter";
import { rootLoader } from "@core/common/PageLoader";
import errorOut from "@core/errors/ErrorOut";
import useSwr from "swr";

export default withPageAuthRequired(function Events(): React.ReactElement {
  const router = useRouter();
  const portfolioId = router.query.trades
    ? router.query.trades[0]
    : "undefined";
  const assetId = router.query.trades ? router.query.trades[1] : "undefined";
  const { t } = useTranslation("common");
  const asset = useSwr(assetKey(assetId), simpleFetcher(assetKey(assetId)));
  const trades = useSwr(
    tradeKey(portfolioId, assetId),
    simpleFetcher(tradeKey(portfolioId, assetId))
  );
  if (trades.error) {
    return errorOut(t("trades.error.retrieve"), trades.error);
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error);
  }
  if (asset.isLoading) {
    return rootLoader(t("loading"));
  }
  if (trades.isLoading) {
    // console.log( `trades: ${trades.isLoading}, asset: ${asset.isLoading}`)
    return rootLoader(t("loading"));
  }
  const trnResults = trades.data.data;
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
                <th align={"right"}>Quantity</th>
                <th align={"right"}>Price</th>
                <th align={"right"}>Amount</th>
                <th align={"right"}>T/B Rate</th>
                <th align={"right"}>T/C Rate</th>
                <th align={"right"}>T/P Rate</th>
                <th align={"right"}>Cash</th>
                <th align={"right"}>Tax</th>
                <th align={"right"}>Charges</th>
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
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
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
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={0}
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

                  <td align={"right"}>
                    <NumericFormat
                      value={trn.cashAmount}
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
                      value={trn.fees}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/portfolios/${trn.portfolio.id}/${trn.id}`}
                      className="fa fa-edit"
                    ></Link>
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
