import React from "react";
import { useLogin } from "./loginHook";
import { Redirect } from "react-router-dom";

export const Login = (): JSX.Element => {
  const loggedIn = useLogin();
  if (loggedIn) {
    return <Redirect to="/dashboard"/>
  }
  return <div>Logging in...</div>;
};
