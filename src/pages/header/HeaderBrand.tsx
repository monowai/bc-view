import React from "react";
import { useRouter } from "next/router";

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

export default HeaderBrand;
