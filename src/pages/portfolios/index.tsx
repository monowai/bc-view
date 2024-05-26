import React from "react";
import useSwr from "swr";
import { UserProfile, withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "next-i18next";
import { Portfolio } from "@components/types/beancounter";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper";
import errorOut from "@components/errors/ErrorOut";
import { useRouter } from "next/router";
import { rootLoader } from "@components/PageLoader";

const CreatePortfolioButton = (): React.ReactElement<HTMLButtonElement> => {
  const router = useRouter();
  const { t } = useTranslation("common");

  return (
    <button
      className="navbar-item button is-link is-small"
      onClick={async () => {
        await router.push(`/portfolios/__NEW__`);
      }}
    >
      {t("portfolio.create")}
    </button>
  );
};

export default withPageAuthRequired(function Portfolios({
  user,
}: UserProfile): React.ReactElement {
  const { t, ready } = useTranslation("common");
  const router = useRouter();
  const { data, mutate, error } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  );
  if (error) {
    return errorOut(t("portfolios.error.retrieve"), error);
  }

  if (!user) {
    return rootLoader(t("loading"));
  }

  async function deletePortfolio(
    portfolioId: string,
    message: string,
  ): Promise<void> {
    if (window.confirm(message)) {
      try {
        await fetch(`/api/portfolios/${portfolioId}`, {
          method: "DELETE",
        });
        await mutate({ ...data });
        await router.push("/portfolios", "/portfolios", {
          shallow: true,
        });
      } catch (error) {
        console.error("Failed to delete portfolio:", error);
      }
    }
  }

  function listPortfolios(portfolios: Portfolio[]): React.ReactElement {
    if (!portfolios || portfolios.length == 0) {
      return (
        <nav className="container has-background-grey-lighter">
          <div id="root">{t("error.portfolios.empty")}</div>
          <div className="column is-left">
            <CreatePortfolioButton />
          </div>
        </nav>
      );
    }
    return (
      <div>
        <nav className="container has-background-grey-lighter">
          <div className="column is-left">
            <CreatePortfolioButton />
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
                      <Link rel="preload" href={`/holdings/${portfolio.code}`}>
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
                            t("portfolio.delete", { code: portfolio.code }),
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

  if (!data || !ready) {
    return rootLoader(t("loading"));
  }
  // Use the user variable somewhere in your component
  return listPortfolios(data.data);
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
