import React from "react";
import useSwr from "swr";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { useTranslation } from "next-i18next";
import { Portfolio } from "@/types/beancounter";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
const url = "/api/portfolios";
const fetcher = () => fetch(url).then((res) => res.json());

export default withPageAuthRequired(function Portfolios(): React.ReactElement {
  const { data, error } = useSwr(url, fetcher);
  const { t } = useTranslation("common");
  if (error) {
    return (
      <>
        <p>{t("error.portfolios.retrieve")}</p>
        <pre style={{ color: "red" }}>{JSON.stringify(error, null, 2)}</pre>
      </>
    );
  }
  if (!data) {
    return (
      <div id="root" data-testid="loading">
        {t("loading")}
      </div>
    );
  }
  const portfolios: Portfolio[] = data.data;
  if (portfolios && portfolios.length > 0) {
    return (
      <div>
        <nav className="container has-background-grey-lighter">
          <div className="column is-left">
            <button
              className="navbar-item button is-link is-small"
              onClick={() => {
                //
              }}
            >
              {t("portfolio.create")}
            </button>
          </div>
        </nav>
        <div className="page-box is-primary has-background-light">
          <div className="container">
            <table className={"table is-striped is-hoverable"}>
              <thead>
                <tr>
                  <th>{t("portfolio.code")}</th>
                  <th>{t("portfolio.name")}</th>
                  <th>{t("portfolio.currency.report")}</th>
                  <th>{t("portfolio.currency.base")}</th>
                  <th>{t("portfolio.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map((portfolio) => (
                  <tr key={portfolio.id}>
                    <td>
                      <Link href={`/holdings/${portfolio.code}`}>{portfolio.code}</Link>
                    </td>
                    <td>{portfolio.name}</td>
                    <td>
                      {portfolio.currency.symbol}
                      {portfolio.currency.code}
                    </td>
                    <td>
                      {portfolio.base.symbol}
                      {portfolio.base.code}
                    </td>
                    <td>
                      <Link href={`/portfolios/${portfolio.id}`} className="far fa-edit">

                      </Link>
                      <span> </span>
                      <Link href={`/portfolios/${portfolio.id}/delete`} className="far fa-trash-alt">

                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  return <div id="root">{t("error.portfolios.empty")}</div>;
});

// noinspection JSUnusedGlobalSymbols
export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
