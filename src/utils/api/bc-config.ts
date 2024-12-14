export function getDataUrl(path: string = ""): string {
  return `${process.env.BC_DATA}${path}`
}

export function getPositionsUrl(path: string = ""): string {
  return `${process.env.BC_POSITION}${path}`
}

export function getTrnTopic(): string {
  return `${process.env.KAFKA_TOPIC_TRN}`
}

export function getKafkaHosts(): string[] {
  return [`${process.env.KAFKA_URL}`]
}

export function getKafkaClient(): string {
  return `${process.env.KAFKA_CLIENT}`
}

export function getSentryDsn(): string {
  return `${process.env.SENTRY_DSN}`
}

export function getSentryTracesSampleRate(): string {
  return `${process.env.SENTRY_TRACE_SAMPLE_RATE}`
}
