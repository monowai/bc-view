import React from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

function HeaderBrand(): React.ReactElement {
  const router = useRouter();
  return (
    <div className="navbar-brand">
      <a
        className="navbar-item"
        onClick={() => {
          router.push("/");
        }}
      >
        Holds<i>worth</i>
        {/*<img src={Logo} />*/}
      </a>
      <div className="navbar-burger burger">
        <span />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});

export default HeaderBrand;
