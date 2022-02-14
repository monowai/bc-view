import React from "react";
import { useHistory } from "react-router";

function HeaderBrand(): React.ReactElement {
  const history = useHistory();
  return (
    <div className="navbar-brand">
      <a
        className="navbar-item"
        onClick={() => {
          history.push("/");
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

export default HeaderBrand;
