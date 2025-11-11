import React from "react"
import * as Sentry from "@sentry/nextjs"
import NextError from "next/error"
import { NextPageContext } from "next"
import ErrorOut from "@components/errors/ErrorOut"

interface CustomErrorComponentProps {
  statusCode: number
  err?: Error
}

const CustomErrorComponent = ({
  statusCode,
  err,
}: CustomErrorComponentProps): React.ReactElement => {
  // Create a descriptive error object
  const error = err || new Error(`HTTP ${statusCode}`)

  // Determine error type based on status code
  let type: "404" | "500" | "generic" = "generic"
  if (statusCode === 404) {
    type = "404"
  } else if (statusCode >= 500) {
    type = "500"
  }

  return (
    <ErrorOut
      error={error}
      type={type}
      autoDetect={false}
      message={
        statusCode
          ? `An error ${statusCode} occurred on the server`
          : "An error occurred on the client"
      }
    />
  )
}

CustomErrorComponent.getInitialProps = async (
  contextData: NextPageContext,
): Promise<{ statusCode: number }> => {
  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(contextData)

  // This will contain the status code of the response
  return NextError.getInitialProps(contextData)
}

export default CustomErrorComponent
