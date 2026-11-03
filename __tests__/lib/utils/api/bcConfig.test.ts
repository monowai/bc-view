import * as cfg from "@utils/api/bcConfig"

const KEYS = [
  "BC_DATA",
  "BC_DATA_ACTUATOR",
  "BC_POSITION",
  "BC_POSITION_ACTUATOR",
  "BC_EVENT",
  "BC_EVENT_ACTUATOR",
  "BC_RETIRE",
  "BC_RETIRE_ACTUATOR",
  "BC_REBALANCE",
  "BC_REBALANCE_ACTUATOR",
  "BC_AGENT",
  "BC_AGENT_ACTUATOR",
  "SENTRY_DSN",
  "SENTRY_ENABLED",
  "SENTRY_ENVIRONMENT",
  "SENTRY_TRACES_SAMPLE_RATE",
  "SENTRY_IGNORE_TRANSACTIONS",
]

describe("bcConfig", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    KEYS.forEach((k) => {
      saved[k] = process.env[k]
      delete process.env[k]
    })
  })
  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    })
  })

  it("builds service urls with an optional path", () => {
    process.env.BC_DATA = "http://d"
    process.env.BC_POSITION = "http://p"
    process.env.BC_EVENT = "http://e"
    process.env.BC_RETIRE = "http://r"
    process.env.BC_REBALANCE = "http://b"
    process.env.BC_AGENT = "http://a"
    expect(cfg.getDataUrl("/x")).toBe("http://d/x")
    expect(cfg.getPositionsUrl()).toBe("http://p")
    expect(cfg.getEventUrl("/y")).toBe("http://e/y")
    expect(cfg.getRetireUrl("/z")).toBe("http://r/z")
    expect(cfg.getRebalanceUrl("/m")).toBe("http://b/m")
    expect(cfg.getAgentUrl("/q")).toBe("http://a/q")
    expect(cfg.getCompositeProjectionUrl()).toBe(
      "http://r/composite/projection",
    )
    expect(cfg.getCompositeScenariosUrl()).toBe("http://r/composite/scenarios")
    expect(cfg.getCompositeMonteCarloUrl()).toBe(
      "http://r/composite/monte-carlo",
    )
  })

  it("actuator urls fall back to the main url, prefer the actuator override", () => {
    process.env.BC_DATA = "http://d"
    process.env.BC_POSITION = "http://p"
    process.env.BC_EVENT = "http://e"
    process.env.BC_RETIRE = "http://r"
    process.env.BC_REBALANCE = "http://b"
    process.env.BC_AGENT = "http://a"
    expect(cfg.getDataActuatorUrl("/h")).toBe("http://d/h")
    expect(cfg.getPositionActuatorUrl()).toBe("http://p")
    expect(cfg.getEventActuatorUrl()).toBe("http://e")
    expect(cfg.getRetireActuatorUrl()).toBe("http://r")
    expect(cfg.getRebalanceActuatorUrl()).toBe("http://b")
    expect(cfg.getAgentActuatorUrl()).toBe("http://a")

    process.env.BC_DATA_ACTUATOR = "http://da"
    process.env.BC_POSITION_ACTUATOR = "http://pa"
    process.env.BC_EVENT_ACTUATOR = "http://ea"
    process.env.BC_RETIRE_ACTUATOR = "http://ra"
    process.env.BC_REBALANCE_ACTUATOR = "http://ba"
    process.env.BC_AGENT_ACTUATOR = "http://aa"
    expect(cfg.getDataActuatorUrl()).toBe("http://da")
    expect(cfg.getPositionActuatorUrl()).toBe("http://pa")
    expect(cfg.getEventActuatorUrl()).toBe("http://ea")
    expect(cfg.getRetireActuatorUrl()).toBe("http://ra")
    expect(cfg.getRebalanceActuatorUrl()).toBe("http://ba")
    expect(cfg.getAgentActuatorUrl()).toBe("http://aa")
  })

  it("sentry settings have defaults and honour env", () => {
    expect(cfg.getSentryDsn()).toBe("")
    expect(cfg.getSentryEnabled()).toBe(false)
    expect(cfg.getSentryEnvironment()).toBe("local")
    expect(cfg.getSentryTracesSampleRate()).toBe(1)
    expect(cfg.getSentryIgnoreTransactions()).toContain("/api/ping")

    process.env.SENTRY_DSN = "dsn"
    process.env.SENTRY_ENABLED = "true"
    process.env.SENTRY_ENVIRONMENT = "prod"
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25"
    process.env.SENTRY_IGNORE_TRANSACTIONS = "/a, /b"
    expect(cfg.getSentryDsn()).toBe("dsn")
    expect(cfg.getSentryEnabled()).toBe(true)
    expect(cfg.getSentryEnvironment()).toBe("prod")
    expect(cfg.getSentryTracesSampleRate()).toBe(0.25)
    expect(cfg.getSentryIgnoreTransactions()).toEqual(["/a", "/b"])
  })

  it("trace propagation targets include only configured services", () => {
    expect(cfg.getTracePropagationTargets()).toEqual([])
    process.env.BC_DATA = "http://d"
    process.env.BC_AGENT = "http://a"
    expect(cfg.getTracePropagationTargets()).toEqual(["http://d", "http://a"])
  })
})
