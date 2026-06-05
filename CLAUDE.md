# bc-view

Next.js frontend for the Beancounter financial transaction processing system.

## Related Repositories

**IMPORTANT:** Before starting work, review these related repositories for system-wide context:

| Repository  | Path             | Purpose                                                                        |
| ----------- | ---------------- | ------------------------------------------------------------------------------ |
| bc-claude   | `../bc-claude`   | **Read first** - System architecture, Auth0, service URLs, cross-service flows |
| bc-deploy   | `../bc-deploy`   | Kubernetes/Helm deployment, OpenAPI endpoints, debugging                       |
| beancounter | `../beancounter` | Spring Boot backend services (Kotlin source code)                              |

Key resources in bc-deploy/CLAUDE.md:

- Service ports (HTTP and Actuator)
- OpenAPI/Swagger URLs: `http://kauri.monowai.com:{actuator-port}/actuator/openapi`
- RabbitMQ management, health checks, debugging commands

## Technology Stack

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x + Sass
- **Authentication**: Auth0 (`@auth0/nextjs-auth0`)
- **Data Fetching**: SWR
- **Testing**: Jest 30 + React Testing Library
- **Build Tool**: Yarn 1.22 / Node.js 20+
- **Monitoring**: Sentry

## Development Commands

```bash
yarn dev           # Start with Turbopack (fast refresh)
yarn build         # Production build
yarn test          # Run tests with coverage
yarn test:watch    # Watch mode
yarn lint          # ESLint + markdownlint
yarn prettier      # Format code
yarn typecheck     # TypeScript checks only
yarn check-imports # Validate import paths
```

## Local Development Setup

### 1. Environment Configuration

**Secrets should be set in your shell environment** (e.g., `.zshrc`, `.bashrc`):

```bash
# Add to your shell profile - never commit these
export AUTH0_CLIENT_ID='your-client-id'
export AUTH0_CLIENT_SECRET='your-client-secret'
export AUTH0_SECRET='your-32-byte-hex-value'  # generate with: openssl rand -hex 32
```

Then in `.env.local`, reference shell variables for secrets and set non-sensitive config:

```bash
# Auth0 - secrets come from shell environment
APP_BASE_URL='http://localhost:3000'
AUTH0_DOMAIN='beancounter.eu.auth0.com'
# AUTH0_AUDIENCE is configured in src/lib/utils/auth0.ts (not an env var in v4)

# Backend services (point to local or remote)
BC_DATA='http://localhost:9510'      # or kauri.monowai.com:30610
BC_POSITION='http://localhost:9500'  # or kauri.monowai.com:30600
BC_EVENT='http://localhost:9520'     # or kauri.monowai.com:30630

# Message broker (choose one)
BROKER_TYPE='RABBIT'                 # or 'KAFKA'
RABBIT_URL='localhost:5672'
RABBIT_EXCHANGE='bc-trn-csv-dev'
# OR
KAFKA_URL='localhost:9092'
KAFKA_TOPIC_TRN='bc-trn-csv-dev'
```

Next.js automatically merges shell environment variables with `.env.local`.

### 2. Running Locally

```bash
# Against remote kauri services (easiest)
BC_DATA='http://kauri.monowai.com:30610' \
BC_POSITION='http://kauri.monowai.com:30600' \
BC_EVENT='http://kauri.monowai.com:30630' \
yarn dev

# Against local backend (requires beancounter services running)
yarn dev
```

### 3. Testing Auth Flow

The app requires authentication. For local testing:

1. Navigate to `http://localhost:3000`
2. Click login - redirects to Auth0
3. After login, session stored in cookies
4. API routes proxy authenticated requests to backend

## Project Structure

```
src/
├── components/
│   ├── errors/      # Error handling, boundaries
│   ├── features/    # Feature components (holdings, portfolios, transactions)
│   ├── layout/      # Header, navigation
│   └── ui/          # Reusable UI components
├── lib/utils/
│   ├── api/         # Backend configuration, fetch helpers
│   ├── broker/      # Kafka/RabbitMQ message broker abstraction
│   ├── holdings/    # Holdings calculations, sorting
│   └── trns/        # Transaction utilities
├── pages/
│   ├── api/         # Next.js API routes (auth proxy)
│   ├── holdings/    # Holdings views
│   ├── portfolios/  # Portfolio management
│   └── trns/        # Transaction entry (trade, cash, events)
└── providers/       # React context providers

styles/              # Global Sass styles
types/               # TypeScript type definitions
tests/               # Test utilities and fixtures
```

## Path Aliases

Configured in `tsconfig.json`:

```typescript
import { Something } from "@components/ui/Something"
import { fetchHelper } from "@utils/api/fetchHelper"
import { HoldingType } from "@types/holdings"
```

**`@lib/*` and `@utils/*` both resolve to `src/lib/utils/*`** at compile
time (`tsconfig.json`), but **`@lib/api/*` BREAKS at runtime** — the
Next.js bundler fails to resolve it and returns 500. A pre-commit hook
(`scripts/check-imports.js`) blocks `@lib/api` imports for this reason.

Rules for new code:

- API fetch helpers: **must** use `@utils/api/...` (e.g.,
  `@utils/api/fetchHelper`). Never `@lib/api/...`.
- Other lib subdirs (assets, independence, broker, etc.): either alias
  works; prefer `@lib/...` for consistency with newer code.
- Never `@lib/utils/...` — double-`utils`; the alias already points
  inside `src/lib/utils/`.

CodeRabbit gets this wrong; reject any suggestion that rewrites
`@utils/api/*` to `@lib/api/*`.

## API Routes

Most API routes go through a centralised handler (`src/lib/api/createApiHandler.ts`)
that applies Auth0 v4 session handling and proxies to the backend. ~11 routes import
`@auth0/nextjs-auth0` directly (register, admin-check, trns/import, assets/_,
portfolios/_, holdings/weights, admin/services).

The v3 helper `withApiAuthRequired` has been removed — use `auth0.getSession(req)`

- `auth0.getAccessToken(req, res)` for manual access-token handling.

Common proxy routes:

| Endpoint                  | Backend     | Purpose                |
| ------------------------- | ----------- | ---------------------- |
| `/api/portfolios`         | bc-data     | Portfolio CRUD         |
| `/api/holdings/[code]`    | bc-position | Portfolio holdings     |
| `/api/trns/*`             | bc-data     | Transaction operations |
| `/api/corporate-events/*` | bc-event    | Corporate actions      |
| `/api/assets/[id]`        | bc-data     | Asset lookup           |
| `/api/currencies`         | bc-data     | Currency list          |

## Message Broker

Supports both Kafka and RabbitMQ for CSV imports:

```typescript
// Automatically uses BROKER_TYPE from environment
import { getBroker } from "@lib/broker"

const broker = getBroker()
await broker.send(csvData)
```

## Key Pages

| Route                                        | Purpose                                |
| -------------------------------------------- | -------------------------------------- |
| `/portfolios`                                | List user portfolios                   |
| `/holdings/[code]`                           | View portfolio holdings with valuation |
| `/portfolios/trades/[portfolioId]/[assetId]` | Trade history                          |
| `/trns/trade`                                | Enter new trade                        |
| `/trns/cash`                                 | Enter cash transaction                 |
| `/trns/events/[portfolioId]/[assetId]`       | Corporate event transactions           |

## Testing

```bash
# Run all tests
yarn test

# Watch mode for development
yarn test:watch

# Run specific test file
yarn test src/components/features/holdings/__tests__/Summary.test.tsx
```

Test files are colocated with source in `__tests__` directories.

### Shared Fixtures

Domain-type builders live at `src/test-fixtures/beancounter.ts`, exposed via
the `@test-fixtures/*` path alias (wired into both `tsconfig.json` and
`jest.config.js`). Use these instead of hand-rolling `Portfolio` / `Position` /
`Holdings` shapes — keeps fixtures consistent as types evolve.

```ts
import {
  makePortfolio,
  makePosition,
  makeHoldingGroup,
  makeHoldings,
  makeAsset,
  makeCashAsset,
  USD,
  NZD,
  SGD,
} from "@test-fixtures/beancounter"

const position = makePosition({ price: 150, quantityValues: { total: 100 } })
const holdings = makeHoldings({
  holdingGroups: { Equity: makeHoldingGroup({ positions: [position] }) },
})
```

Each builder accepts a `Partial<T>` overrides object. `makePosition` also
accepts a top-level `price` shortcut that sets `priceData.close`.

### Global Jest Mocks

Common cross-cutting mocks live in `jest.setup.js` — **don't re-mock these
locally** unless you need per-test overrides:

| Module                       | Behavior                                               |
| ---------------------------- | ------------------------------------------------------ |
| `next/router`                | `useRouter` returns fixed shape with `push: jest.fn()` |
| `next/link`                  | Renders as plain `<a href>`                            |
| `react-markdown`             | Renders `<div data-testid="markdown">{children}</div>` |
| `remark-gfm`                 | No-op                                                  |
| `@auth0/nextjs-auth0/client` | `useUser` returns mock user, providers pass through    |
| `global.fetch`               | Returns `{ data: [] }`                                 |

Override locally only when the test asserts on a specific call (e.g.
`expect(mockPush).toHaveBeenCalledWith(...)`) or stubs different state per
test (`(useRouter as jest.Mock).mockReturnValue(...)`).

## TDD Workflow

Follow Red-Green-Refactor:

1. **Write failing test first** - Cover expected behavior
2. **Implement minimal code** - Just enough to pass
3. **Refactor** - Improve while keeping tests green
4. **Lint** - Lastly, lint the code and resolve warnings and errors then rerun the tests

```bash
# Typical TDD cycle
yarn test:watch  # Keep running in terminal
# Write test -> Watch fail -> Implement -> Watch pass -> Refactor
```

## React Compiler

React Compiler is enabled (Next 16 / `eslint-plugin-react-hooks` v7). All
`react-hooks/*` rules are at **error** level in `eslint.config.mjs` — CI
blocks any new compiler bailout. `yarn lint` is the gate.

**Don't add `"use no memo"` or `@ts-expect-error react-compiler`.** Fix the
bailout instead. Intentional bailouts are scoped via
`// eslint-disable-next-line` at the call site, with a comment explaining
why. Acceptable patterns (currently allowed):

- **External-trigger effects** — modal-open reset, URL `?action=...`
  side effects, `phases/displayCurrency` mark-stale (`MovePositionDialog`,
  `HoldingActions`, `StressTestTab`). Listing the omitted dep changes
  behaviour (re-fires on every state tick), not just shuts the linter up.

**Common false bailouts and how to clear them:**

- **Pure helper inside component** — hoist to module scope, type the arg
  directly instead of `(typeof someState)[0]`. See `getNetRentalIncome` in
  `ContributionsStep.tsx`.
- **Effect dep is a fresh fn from a hook** — wrap the function in
  `useCallback` inside the source hook (deps must themselves be stable —
  SWR's `mutate` is). Then the consumer can list it honestly. See
  `useIndependenceSettings.updateSettings`.
- **Inline object/array prop causing child re-render** — `useMemo` at the
  call site or hoist a constant if truly static.

When in doubt: prefer refactoring the _source_ (hook author) over
suppressing at the _consumer_ — one fix removes N suppressions.

## Debugging

```bash
# Node.js inspector
yarn node-debug
# Then open chrome://inspect

# Check for import issues (prevents 500 errors)
yarn check-imports
```

## Common Issues

**Auth redirect loop**: Check `APP_BASE_URL` matches actual URL

**Backend connection refused**: Verify `BC_DATA`, `BC_POSITION`, `BC_EVENT` URLs are accessible

**CORS errors**: Backend services must allow origin from `APP_BASE_URL`

**Message broker connection failed**: Check `RABBIT_URL` or `KAFKA_URL` and `BROKER_TYPE`

## Docker Build

```bash
# Standard build
docker build . -t monowai/bc-view

# With specific broker URL
docker build --build-arg KAFKA_URL=host.minikube.internal:9092 . -t monowai/bc-view
```

Output is `standalone` mode for containerized deployment.

### CI build pipeline

`.github/workflows/build.yml` deliberately runs `yarn build` twice:

1. **`build` job (CI runner)** — fast-fail signal. Compiles `.next/`, runs the
   Sentry DSN guards, then throws the output away.
2. **`docker` job (matrix)** — the single source of truth for the image. Re-runs
   `yarn install` + `yarn build` inside the Dockerfile's builder stage with
   `NEXT_PUBLIC_SENTRY_DSN` passed via `--build-arg`. A `RUN` guard in the
   Dockerfile asserts the DSN is inlined into the instrumentation-client chunk;
   image build fails if not.

No artifact handoff. The previous artifact pattern (upload `.next/`, download
in the Docker job, Dockerfile picks it up via `if [ -d .next ]`) was a foot-gun:
`actions/upload-artifact@v6` silently drops dot-prefixed paths
(`include-hidden-files: false` default), so `.next/` never reached the Docker
job, the conditional always rebuilt, and the CI guard was verifying a
throwaway compile while a separately-built bundle shipped to kauri. Took
PRs #762-#766 to untangle.

### Future investigation — conditional artifact handoff

The `docker` job already only runs on `push` to `main` or
`workflow_dispatch + build_image`. PR builds never trigger it. So if the
artifact handoff is ever re-enabled for the ~20s/main-build speedup, the
`upload-artifact` and `download-artifact` steps should be **gated by the same
`if:` condition as the docker job**, and `include-hidden-files: true` must be
set on the upload step.

That preserves the speedup when it matters (main → deploy) without paying any
storage cost on the much-more-frequent PR builds. Estimated saving: ~50 min of
GH Actions minutes per month. Reliability constraint: the Dockerfile's
post-build DSN guard must run regardless of which path produced `.next/`, so
a split-state regression is caught on the image side.
