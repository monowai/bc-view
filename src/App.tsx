import React from "react";
import { Switch, withRouter } from "react-router";
import Header from "./header/Header";
import Portfolios from "./portfolio/Portfolios";
import { Redirect } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/ssr";
import { Login } from "./user/Login";
import { RouteAuthenticated, RouteUnAuthenticated } from "./auth/RouteAuthentication";
import Home from "./Home";
import Logout from "./user/Logout";
import Registration from "./user/Registration";
import { RoutePortfolio, RoutePortfolioDelete } from "./portfolio/portfolioRoutes";
import { RouteHoldings } from "./holdings/holdingRoutes";
import { RouteEventList, RouteTradeList, RouteTrnEdit } from "./trns/trnRoutes";

const App = (): JSX.Element => {
  const { keycloak } = useKeycloak();
  const authenticated = keycloak && keycloak.token
  const fallbackUri = `${authenticated ? '/dashboard' : '/'}`;
  return (
    <div className={"page.box"}>
      <Header />
      <Switch>
        <RouteAuthenticated path={"/dashboard"}
                            component={Portfolios}/>
        <RouteAuthenticated path={"/holdings/:portfolioId" }
                            component={RouteHoldings}/>
        <RouteAuthenticated path={"/portfolios/:portfolioId/delete" }
                            component={RoutePortfolioDelete}/>
        <RouteAuthenticated path={"/portfolios/:portfolioId" }
                            component={RoutePortfolio}/>
        <RouteAuthenticated path={"/trns/:portfolioId/asset/:assetId/trades" }
                            component={RouteTradeList}/>
        <RouteAuthenticated path={"/trns/:portfolioId/asset/:assetId/events" }
                            component={RouteEventList}/>
        <RouteAuthenticated path={"/trns/:portfolioId/:trnId" }
                            component={RouteTrnEdit}/>

        <RouteUnAuthenticated path={"/register"} component={Registration}/>
        <RouteUnAuthenticated path={"/login"} component={Login}/>
        <RouteUnAuthenticated path={"/logout"} component={Logout}/>
        <RouteUnAuthenticated path={"/"} component={Home} exact={true}/>
        <Redirect to={fallbackUri} />
      </Switch>
    </div>
  );
};

export default withRouter(App);
