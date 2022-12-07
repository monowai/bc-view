import React from "react";

export function rootLoader(message: string, show = true): JSX.Element {
  if (!show) {
    return <div />;
  }
  return (
    <div className="pageloader is-active is-dark" data-testid={"loading"}>
      <span className="title">{message}</span>
    </div>
  );
}
