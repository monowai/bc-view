import React from "react";
import useSwr from "swr";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "next-i18next";
import { Portfolio } from "@core/types/beancounter";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { portfoliosKey, simpleFetcher } from "@core/api/fetchHelper";
import errorOut from "@core/errors/ErrorOut";
import { rootLoader } from "@core/common/PageLoader";
import { deletePortfolio } from "@domain/trns/apiHelper";
import { useRouter } from "next/router";

export default withPageAuthRequired(function Portfolios(): React.ReactElement {
  const { t, ready } = useTranslation("common");
  const router = useRouter();
  const { data, error } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey));
  if (error) {
    return errorOut(t("portfolios.error.retrieve"), error);
  }
  if (!data || !ready) {
    return rootLoader(t("loading"));
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
                router.push(`/portfolios/__NEW__`);
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
                      <Link href={`/holdings/${portfolio.code}`}>
                        {portfolio.code}
                      </Link>
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
                      <Link
                        href={`/portfolios/${portfolio.id}`}
                        className="far fa-edit"
                      ></Link>
                      <span> </span>
                      <a
                        onClick={() =>
                          deletePortfolio(
                            portfolio.id,
                            t("portfolio.delete", { code: portfolio.code })
                          )
                        }
                        className="simple-padding far fa-trash-alt"
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
  }
  return <div id="root">{t("error.portfolios.empty")}</div>;
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
