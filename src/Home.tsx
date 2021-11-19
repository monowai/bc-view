import React from "react";
import { translate } from "./common/i18nUtils";

const Home = (): JSX.Element => {
  return (
    <div>
      Welcome to {translate("app")}. Would you like to <a href="/login">login?</a>
    </div>
  );
};

export default Home;
