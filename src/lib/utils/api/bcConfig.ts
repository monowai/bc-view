export function getDataUrl(path: string = ""): string {
  return `${process.env.BC_DATA}${path}`
}

export function getPositionsUrl(path: string = ""): string {
  return `${process.env.BC_POSITION}${path}`
}

export function getEventUrl(path: string = ""): string {
  return `${process.env.BC_EVENT}${path}`
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
  return process.env.SENTRY_DSN || ""
}

export function getSentryDebug(): boolean | undefined {
  return Boolean(process.env.SENTRY_DEBUG || false).valueOf()
}

export function getSentryEnabled(): boolean | undefined {
  return Boolean(process.env.SENTRY_ENABLED || false).valueOf()
}

export function getSentryTracesSampleRate(): number {
  return Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 1)
}
