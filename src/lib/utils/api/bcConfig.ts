export function getDataUrl(path: string = ""): string {
  return `${process.env.BC_DATA}${path}`
}

export function getPositionsUrl(path: string = ""): string {
  return `${process.env.BC_POSITION}${path}`
}

export function getEventUrl(path: string = ""): string {
  return `${process.env.BC_EVENT}${path}`
}

export function getRetireUrl(path: string = ""): string {
  return `${process.env.BC_RETIRE}${path}`
}

export function getRebalanceUrl(path: string = ""): string {
  return `${process.env.BC_REBALANCE}${path}`
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

export function getSentryDebug(): boolean {
  return process.env.SENTRY_DEBUG === "true"
}

export function getSentryEnabled(): boolean {
  return process.env.SENTRY_ENABLED === "true"
}

export function getSentryEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT || "local"
}

export function getSentryTracesSampleRate(): number {
  return Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 1.0)
}

// Default patterns to ignore in Sentry transactions
// /_next/data = client-side navigation data fetches (getServerSideProps JSON)
// /_next/image = image optimization requests
// /_next/static = static asset requests
const DEFAULT_IGNORE_PATTERNS = [
  "/api/ping",
  "/_next/data",
  "/_next/image",
  "/_next/static",
]

export function getSentryIgnoreTransactions(): string[] {
  const envPatterns = process.env.SENTRY_IGNORE_TRANSACTIONS
  if (envPatterns) {
    return envPatterns.split(",").map((p) => p.trim())
  }
  return DEFAULT_IGNORE_PATTERNS
}

export function getTracePropagationTargets(): (string | RegExp)[] {
  const targets: (string | RegExp)[] = []
  if (process.env.BC_DATA) targets.push(process.env.BC_DATA)
  if (process.env.BC_POSITION) targets.push(process.env.BC_POSITION)
  if (process.env.BC_EVENT) targets.push(process.env.BC_EVENT)
  if (process.env.BC_RETIRE) targets.push(process.env.BC_RETIRE)
  if (process.env.BC_REBALANCE) targets.push(process.env.BC_REBALANCE)
  return targets
}
