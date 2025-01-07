import React from "react"
import * as Sentry from "@sentry/nextjs"
import Error from "next/error"
import { NextPageContext } from "next"

interface CustomErrorComponentProps {
  statusCode: number
}

const CustomErrorComponent = ({
  statusCode,
}: CustomErrorComponentProps): JSX.Element => {
  return <Error statusCode={statusCode} />
}

CustomErrorComponent.getInitialProps = async (
  contextData: NextPageContext,
): Promise<{ statusCode: number }> => {
  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(contextData)

  // This will contain the status code of the response
  return Error.getInitialProps(contextData)
}

export default CustomErrorComponent
