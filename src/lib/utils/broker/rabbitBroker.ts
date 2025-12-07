import amqp, { ChannelModel, Channel } from "amqplib"
import { MessageBroker, BrokerMessage, SendResult, BrokerConfig } from "./types"

/**
 * RabbitMQ implementation of the MessageBroker interface
 */
export class RabbitBroker implements MessageBroker {
  private connection: ChannelModel | null = null
  private channel: Channel | null = null
  private config: BrokerConfig

  constructor(config: BrokerConfig) {
    this.config = config
  }

  private getConnectionUrl(): string {
    // Expects hosts[0] to be in format: amqp://user:pass@host:port or just host:port
    const host = this.config.hosts[0]
    if (host.startsWith("amqp://")) {
      return host
    }
    return `amqp://${host}`
  }

  async connect(): Promise<void> {
    if (!this.connection) {
      const url = this.getConnectionUrl()
      this.connection = await amqp.connect(url)
      this.channel = await this.connection.createChannel()

      // Declare the exchange (creates if not exists)
      // Spring Cloud Stream uses topic exchanges by default
      const exchange = this.config.topic
      await this.channel.assertExchange(exchange, "topic", { durable: true })

      console.log(
        `RabbitMQ broker connected: url=${url}, exchange=${exchange}`
      )
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close()
      this.channel = null
    }
    if (this.connection) {
      await this.connection.close()
      this.connection = null
      console.log("RabbitMQ broker disconnected")
    }
  }

  async send(message: BrokerMessage): Promise<SendResult> {
    try {
      // Ensure connected
      await this.connect()

      if (!this.channel) {
        return {
          success: false,
          error: new Error("RabbitMQ channel not initialized"),
        }
      }

      const exchange = message.topic
      const routingKey = "#" // Matches Spring Cloud Stream default binding
      const content = Buffer.from(JSON.stringify(message.value))
      const messageId = `${message.key}-${Date.now()}`

      // Publish to exchange (Spring Cloud Stream consumers bind to exchanges)
      const sent = this.channel.publish(exchange, routingKey, content, {
        persistent: true,
        messageId,
        contentType: "application/json",
        headers: {
          key: message.key,
        },
      })

      if (!sent) {
        return {
          success: false,
          error: new Error("RabbitMQ exchange buffer full, message not sent"),
        }
      }

      console.log(`RabbitMQ message published to exchange ${exchange}, routingKey=${routingKey}, key=${message.key}`)

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      console.error("RabbitMQ send error:", error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }
}
