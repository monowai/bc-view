import {
  getBrokerType,
  getBrokerConfig,
  createBroker,
  resetBroker,
} from "./brokerFactory"
import { KafkaBroker } from "./kafkaBroker"
import { RabbitBroker } from "./rabbitBroker"

describe("BrokerFactory", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(async () => {
    process.env = originalEnv
    await resetBroker()
  })

  describe("getBrokerType", () => {
    it("should return KAFKA by default when BROKER_TYPE is not set", () => {
      delete process.env.BROKER_TYPE
      expect(getBrokerType()).toBe("KAFKA")
    })

    it("should return KAFKA when BROKER_TYPE is KAFKA", () => {
      process.env.BROKER_TYPE = "KAFKA"
      expect(getBrokerType()).toBe("KAFKA")
    })

    it("should return RABBIT when BROKER_TYPE is RABBIT", () => {
      process.env.BROKER_TYPE = "RABBIT"
      expect(getBrokerType()).toBe("RABBIT")
    })

    it("should be case-insensitive for BROKER_TYPE", () => {
      process.env.BROKER_TYPE = "rabbit"
      expect(getBrokerType()).toBe("RABBIT")
    })

    it("should return KAFKA for unknown broker types", () => {
      process.env.BROKER_TYPE = "UNKNOWN"
      expect(getBrokerType()).toBe("KAFKA")
    })
  })

  describe("getBrokerConfig", () => {
    it("should return Kafka config when broker type is KAFKA", () => {
      process.env.BROKER_TYPE = "KAFKA"
      process.env.KAFKA_URL = "kafka:9092"
      process.env.KAFKA_CLIENT = "test-client"
      process.env.KAFKA_TOPIC_TRN = "test-topic"

      const config = getBrokerConfig()

      expect(config.type).toBe("KAFKA")
      expect(config.hosts).toEqual(["kafka:9092"])
      expect(config.clientId).toBe("test-client")
      expect(config.topic).toBe("test-topic")
    })

    it("should return RabbitMQ config when broker type is RABBIT", () => {
      process.env.BROKER_TYPE = "RABBIT"
      process.env.RABBIT_URL = "rabbitmq:5672"
      process.env.RABBIT_CLIENT = "rabbit-client"
      process.env.RABBIT_EXCHANGE = "test-exchange"

      const config = getBrokerConfig()

      expect(config.type).toBe("RABBIT")
      expect(config.hosts).toEqual(["rabbitmq:5672"])
      expect(config.clientId).toBe("rabbit-client")
      expect(config.topic).toBe("test-exchange")
    })

    it("should use default values when env vars are not set", () => {
      delete process.env.BROKER_TYPE
      delete process.env.KAFKA_URL
      delete process.env.KAFKA_CLIENT
      delete process.env.KAFKA_TOPIC_TRN

      const config = getBrokerConfig()

      expect(config.type).toBe("KAFKA")
      expect(config.hosts).toEqual(["localhost:9092"])
      expect(config.clientId).toBe("bc-view")
      expect(config.topic).toBe("bc-trn-csv-dev")
    })

    it("should use RABBIT_EXCHANGE when set", () => {
      process.env.BROKER_TYPE = "RABBIT"
      process.env.RABBIT_EXCHANGE = "my-exchange"

      const config = getBrokerConfig()

      expect(config.topic).toBe("my-exchange")
    })

    it("should use default exchange if RABBIT_EXCHANGE not set", () => {
      process.env.BROKER_TYPE = "RABBIT"
      delete process.env.RABBIT_EXCHANGE

      const config = getBrokerConfig()

      expect(config.topic).toBe("bc-trn-csv-dev")
    })
  })

  describe("createBroker", () => {
    it("should create KafkaBroker when type is KAFKA", async () => {
      process.env.BROKER_TYPE = "KAFKA"
      await resetBroker()

      const broker = createBroker()

      expect(broker).toBeInstanceOf(KafkaBroker)
    })

    it("should create RabbitBroker when type is RABBIT", async () => {
      process.env.BROKER_TYPE = "RABBIT"
      await resetBroker()

      const broker = createBroker()

      expect(broker).toBeInstanceOf(RabbitBroker)
    })

    it("should return the same instance on subsequent calls (singleton)", async () => {
      process.env.BROKER_TYPE = "KAFKA"
      await resetBroker()

      const broker1 = createBroker()
      const broker2 = createBroker()

      expect(broker1).toBe(broker2)
    })

    it("should use provided config instead of environment config", async () => {
      process.env.BROKER_TYPE = "KAFKA"
      await resetBroker()

      const customConfig = {
        type: "RABBIT" as const,
        hosts: ["custom-host:5672"],
        clientId: "custom-client",
        topic: "custom-queue",
      }

      const broker = createBroker(customConfig)

      expect(broker).toBeInstanceOf(RabbitBroker)
    })
  })

  describe("resetBroker", () => {
    it("should reset the broker instance allowing a new one to be created", async () => {
      process.env.BROKER_TYPE = "KAFKA"
      const broker1 = createBroker()

      await resetBroker()

      process.env.BROKER_TYPE = "RABBIT"
      const broker2 = createBroker()

      expect(broker1).toBeInstanceOf(KafkaBroker)
      expect(broker2).toBeInstanceOf(RabbitBroker)
      expect(broker1).not.toBe(broker2)
    })
  })
})
