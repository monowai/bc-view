import { MessageBroker, BrokerType, BrokerConfig } from "./types"
import { KafkaBroker } from "./kafkaBroker"
import { RabbitBroker } from "./rabbitBroker"

/**
 * Get the configured broker type from environment
 * Defaults to KAFKA for backwards compatibility
 */
export function getBrokerType(): BrokerType {
  const brokerType = process.env.BROKER_TYPE?.toUpperCase()
  if (brokerType === "RABBIT") {
    return "RABBIT"
  }
  return "KAFKA"
}

/**
 * Get broker configuration from environment variables
 */
export function getBrokerConfig(): BrokerConfig {
  const type = getBrokerType()

  if (type === "RABBIT") {
    return {
      type: "RABBIT",
      hosts: [`${process.env.RABBIT_URL || "localhost:5672"}`],
      clientId: `${process.env.RABBIT_CLIENT || "bc-view"}`,
      topic: `${process.env.RABBIT_EXCHANGE || "bc-trn-csv-dev"}`,
    }
  }

  // Default to Kafka configuration
  return {
    type: "KAFKA",
    hosts: [`${process.env.KAFKA_URL || "localhost:9092"}`],
    clientId: `${process.env.KAFKA_CLIENT || "bc-view"}`,
    topic: `${process.env.KAFKA_TOPIC_TRN || "bc-trn-csv-dev"}`,
  }
}

// Singleton broker instance
let brokerInstance: MessageBroker | null = null

/**
 * Create a message broker based on configuration
 * Uses singleton pattern to reuse connections
 */
export function createBroker(config?: BrokerConfig): MessageBroker {
  if (brokerInstance) {
    return brokerInstance
  }

  const brokerConfig = config || getBrokerConfig()

  console.log(`Creating ${brokerConfig.type} broker:`, {
    hosts: brokerConfig.hosts,
    clientId: brokerConfig.clientId,
    topic: brokerConfig.topic,
  })

  switch (brokerConfig.type) {
    case "RABBIT":
      brokerInstance = new RabbitBroker(brokerConfig)
      break
    case "KAFKA":
    default:
      brokerInstance = new KafkaBroker(brokerConfig)
      break
  }

  return brokerInstance
}

/**
 * Get the current broker instance or create one
 */
export function getBroker(): MessageBroker {
  return createBroker()
}

/**
 * Reset the broker instance (useful for testing)
 */
export async function resetBroker(): Promise<void> {
  if (brokerInstance) {
    await brokerInstance.disconnect()
    brokerInstance = null
  }
}
