import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { useKeycloak } from "@react-keycloak/ssr";

export const RouteAuthenticated = ({ component: Component, path }: RouteProps): JSX.Element => {
  // https://joshtronic.com/2020/03/23/protected-routes-with-react-router-v5/
  const { keycloak } = useKeycloak();
  const authenticated = keycloak && keycloak.token
  if (!authenticated) {
    return <Redirect to="/" />;
  }
  return <Route component={Component} path={path} />;
};


export const RouteUnAuthenticated = ({ component: Component, path }: RouteProps): JSX.Element => {
  // https://joshtronic.com/2020/03/23/protected-routes-with-react-router-v5/
  const { keycloak } = useKeycloak();
  const authenticated = keycloak && keycloak.token
  if (authenticated) {
    return <Redirect to="/portfolios" />;
  }
  return <Route component={Component} path={path} />;
};

//export default RouteAuthenticated;