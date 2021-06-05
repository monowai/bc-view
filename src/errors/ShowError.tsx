import { ErrorPage } from "./ErrorPage";
import { AxiosError } from "axios";
import React from "react";
import { Login } from "../user/Login";

export function ShowError(error: AxiosError): JSX.Element {
  if (
    error.code === "403" ||
    error.code == "401" ||
    error.response?.status === 403 ||
    error.response?.status === 401
  ) {
    return <Login />;
  }
  return ErrorPage(error.stack, error.message);
}
