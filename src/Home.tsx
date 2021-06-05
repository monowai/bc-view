import React from "react";
import { useKeycloak } from "@react-keycloak/ssr";
import { Redirect } from "react-router";
import Portfolios from "./portfolio/Portfolios";

const Home = (): JSX.Element => {
  const { keycloak } = useKeycloak();
  if (keycloak?.authenticated && keycloak?.token) {
    return <Portfolios />;
  }
  return <Redirect to="/login" />;
};

export default Home;
