import { Kafka, Producer, Partitioners } from "kafkajs"
import { MessageBroker, BrokerMessage, SendResult, BrokerConfig } from "./types"

/**
 * Kafka implementation of the MessageBroker interface
 */
export class KafkaBroker implements MessageBroker {
  private producer: Producer | null = null
  private kafka: Kafka
  private config: BrokerConfig

  constructor(config: BrokerConfig) {
    this.config = config
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.hosts,
    })
  }

  async connect(): Promise<void> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        createPartitioner: Partitioners.LegacyPartitioner,
      })
      await this.producer.connect()
      console.log(
        `Kafka broker connected: hosts=${this.config.hosts}, clientId=${this.config.clientId}`
      )
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect()
      this.producer = null
      console.log("Kafka broker disconnected")
    }
  }

  async send(message: BrokerMessage): Promise<SendResult> {
    try {
      // Ensure connected
      await this.connect()

      if (!this.producer) {
        return {
          success: false,
          error: new Error("Kafka producer not initialized"),
        }
      }

      const result = await this.producer.send({
        topic: message.topic,
        messages: [
          {
            key: message.key,
            value: JSON.stringify(message.value),
            partition: 0,
          },
        ],
      })

      console.log(`Kafka message sent to topic ${message.topic}, key=${message.key}`)

      return {
        success: true,
        messageId: `${result[0].topicName}-${result[0].partition}-${result[0].baseOffset}`,
      }
    } catch (error) {
      console.error("Kafka send error:", error)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }
}
