import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import React from "react"
export default withPageAuthRequired(function AddTrade(): React.ReactElement {
  return (
    <section className="section">
      <h1 className="title">{"Transactions"}</h1>
    </section>
  )
})
