import React from "react";

export default function errorOut(key: string, error: Error): JSX.Element {
  return (
    <>
      <pre style={{ color: "red" }}>
        <p>{key}</p>
        {JSON.stringify(error, null, 2)}
      </pre>
    </>
  );
}
