import React from "react";
import { Loading } from "../types/app";

export default function PageLoader({ message, show }: Loading): JSX.Element {
  if (!show) {
    return <div />;
  }
  return (
    <div className="pageloader is-active is-dark" data-testid={"loading"}>
      <span className="title">{message}</span>
    </div>
  );
}
