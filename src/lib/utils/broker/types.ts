import { TransactionUpload } from "types/app"

/**
 * Supported broker types
 */
export type BrokerType = "KAFKA" | "RABBIT"

/**
 * Result of a message send operation
 */
export interface SendResult {
  success: boolean
  messageId?: string
  error?: Error
}

/**
 * Message to be sent to the broker
 */
export interface BrokerMessage {
  key: string
  value: TransactionUpload
  topic: string
}

/**
 * Broker configuration
 */
export interface BrokerConfig {
  type: BrokerType
  hosts: string[]
  clientId: string
  topic: string
  // RabbitMQ specific
  exchange?: string
  routingKey?: string
}

/**
 * Abstract broker interface for message publishing
 */
export interface MessageBroker {
  /**
   * Send a transaction message to the broker
   */
  send(message: BrokerMessage): Promise<SendResult>

  /**
   * Connect to the broker (if needed)
   */
  connect(): Promise<void>

  /**
   * Disconnect from the broker (if needed)
   */
  disconnect(): Promise<void>
}
