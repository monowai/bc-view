import { ErrorPage } from "./ErrorPage";
import { AxiosError } from "axios";
import React from "react";
import Home from "../Home";

export function ShowError(error: AxiosError): JSX.Element {
  if (error.code === "401" || error.response?.status === 401) {
    return <Home />;
  }
  return ErrorPage(error.stack, error.message);
}
