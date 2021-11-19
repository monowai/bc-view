import React from "react";
import HeaderBrand from "./HeaderBrand";
import HeaderUserControls from "./HeaderUserControls";
import { translate } from "../common/i18nUtils";

export default function Header(): React.ReactElement {
  return (
    <header>
      <nav className="navbar">
        <HeaderBrand />
        <div className="navbar-menu">
          <div className="navbar-start">
            <div className="navbar-item">
              <small>{translate("tagline")}&nbsp;&nbsp;</small>
              <i className="fas fa-euro-sign"> </i>
              <i className="fas fa-dollar-sign"> </i>
              <i className="fas fa-pound-sign"> </i>
            </div>
          </div>
          <HeaderUserControls />
        </div>
      </nav>
    </header>
  );
}
