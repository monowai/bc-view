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
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://beancounter.eu.auth0.com'
AUTH0_AUDIENCE='https://holdsworth.app'

# Backend services (point to local or remote)
BC_DATA='http://localhost:9610'      # or kauri.monowai.com:30610
BC_POSITION='http://localhost:9600'  # or kauri.monowai.com:30600
BC_EVENT='http://localhost:9630'     # or kauri.monowai.com:30630

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
import { fetchHelper } from "@lib/api/fetchHelper"
import { HoldingType } from "@types/holdings"
```

## API Routes

All routes use `withApiAuthRequired` and proxy to backend services:

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

## Debugging

```bash
# Node.js inspector
yarn node-debug
# Then open chrome://inspect

# Check for import issues (prevents 500 errors)
yarn check-imports
```

## Common Issues

**Auth redirect loop**: Check `AUTH0_BASE_URL` matches actual URL

**Backend connection refused**: Verify `BC_DATA`, `BC_POSITION`, `BC_EVENT` URLs are accessible

**CORS errors**: Backend services must allow origin from `AUTH0_BASE_URL`

**Message broker connection failed**: Check `RABBIT_URL` or `KAFKA_URL` and `BROKER_TYPE`

## Docker Build

```bash
# Standard build
docker build . -t monowai/bc-view

# With specific broker URL
docker build --build-arg KAFKA_URL=host.minikube.internal:9092 . -t monowai/bc-view
```

Output is `standalone` mode for containerized deployment.
