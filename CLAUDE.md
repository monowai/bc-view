# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BC-View is the user interface for the Beancounter financial transaction processing system. It's a Next.js application that provides portfolio management, transaction tracking, and financial reporting capabilities. This is the primary interaction point for users to access the Beancounter services.

## Technology Stack

- **Framework**: Next.js 15 with React 18
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x + Sass
- **Authentication**: Auth0 (@auth0/nextjs-auth0)
- **State Management**: Hookstate + Redux
- **Testing**: Jest with React Testing Library
- **Internationalization**: next-i18next
- **Data Fetching**: SWR for API calls
- **Build Tool**: Yarn with Node.js 20
- **Monitoring**: Sentry for error tracking

## Common Development Commands

```bash
# Development server with Turbopack
yarn dev

# Production build
yarn build

# Start production server
yarn start

# Testing
yarn test          # Run tests with coverage
yarn test:watch    # Watch mode for development

# Code quality
yarn lint          # ESLint + TypeScript checks
yarn prettier     # Format code and run linting

# Debug mode
yarn node-debug   # Start with Node.js inspector
```

## Project Structure

```
src/
├── components/    # React components organized by feature
├── pages/        # Next.js pages (file-based routing)
├── utils/        # Utility functions and helpers
├── hooks/        # Custom React hooks
styles/           # Global styles and Sass modules
types/            # TypeScript type definitions
tests/            # Test files and fixtures
public/           # Static assets
```

## Authentication & Integration

- **Auth0 Integration**: Uses `@auth0/nextjs-auth0` for authentication
- **Backend Services**: Communicates with bc-data, bc-position, bc-event services
- **Kafka Integration**: Real-time transaction processing via KafkaJS
- **Configuration**: Environment variables in `.env.local` and `.env.test.local`

## CI/CD Pipeline (CircleCI)

The project uses CircleCI with optimized workflows:

- **install-dependencies**: Dependency installation with retry logic
- **test**: Jest test execution with caching
- **build**: Next.js build with performance optimizations
- **docker-build**: Multi-platform Docker images (linux/amd64, linux/arm64)
- **Container Registry**: `ghcr.io/monowai/bc-view`

## Docker Configuration

```bash
# Development
docker build . -t monowai/bc-view

# With Kafka URL for different environments
docker build --build-arg KAFKA_URL=kafka:9092 . -t monowai/bc-view-demo
docker build --build-arg KAFKA_URL=host.minikube.internal:9092 . -t monowai/bc-view
```

## Development Workflow

1. **Local Development**: Use `yarn dev` with Turbopack for fast rebuilds
2. **Environment Setup**: Configure `.env.local` with Auth0 and API endpoints
3. **Testing**: Run `yarn test:watch` during development
4. **Code Quality**: Pre-commit hooks run `yarn precommit` (lint-staged)
5. **Debugging**: Use `yarn node-debug` for Node.js inspector access

## Key Features

- **Portfolio Management**: View and manage investment portfolios
- **Transaction Tracking**: Import and track financial transactions
- **Reporting**: Financial reports and analytics
- **Real-time Updates**: Kafka-based real-time transaction processing
- **Internationalization**: Multi-language support via i18next
- **Responsive Design**: Mobile-first responsive interface

## Configuration Files

- **TypeScript**: Path aliases configured in `tsconfig.json` (@components, @pages, @utils, @hooks, @styles)
- **ESLint**: Strict TypeScript and React rules in `.eslintrc.js`
- **Jest**: Component testing with jsdom environment in `jest.config.js`
- **Next.js**: Optimized build configuration in `next.config.js`
- **Sentry**: Error monitoring with source maps upload

## API Interaction Strategies

### Authentication Challenge

The UI requires authentication, but there are several approaches to interact with the system:

**1. Next.js API Routes (Recommended)**

- **Endpoint Pattern**: `/api/{resource}` (e.g., `/api/portfolios`, `/api/trns`)
- **Authentication**: Uses `withApiAuthRequired` wrapper and Auth0 `getAccessToken`
- **Bearer Token**: Can potentially be called directly with `Authorization: Bearer {token}`
- **Proxy Behavior**: API routes act as authenticated proxies to backend services

**Available API Endpoints:**

```
GET  /api/portfolios         - List user portfolios
GET  /api/portfolios/{id}    - Get specific portfolio
GET  /api/currencies         - Get currencies
GET  /api/holdings/{code}    - Get holdings for portfolio
GET  /api/assets/{id}        - Get asset information
POST /api/register           - Register user
GET  /api/trns               - Transaction operations
GET  /api/trns/trades/{portfolioId}/{assetId} - Trade data
GET  /api/trns/events/{portfolioId}/{assetId} - Event data
POST /api/trns/import        - Import transactions
```

**2. Direct Backend Access**

- Backend services accessible via environment variables:
  - `BC_DATA` - Data service URL
  - `BC_POSITION` - Position service URL
- Requires JWT token from `BC_TOKEN` environment variable
- May bypass Next.js middleware but lose session management

**3. Unauthenticated Endpoints**

- `/ping` - Basic health check (has SSR but minimal auth)
- `/api/git-info` - Git information endpoint

### Technical Implementation

**API Route Pattern:**

```typescript
// All API routes use this pattern:
export default withApiAuthRequired(async function handler(req, res) {
  const { accessToken } = await getAccessToken(req, res)
  // Proxy to backend with: Authorization: Bearer ${accessToken}
})
```

**Frontend Pages:**

- All main pages use `withPageAuthRequired` wrapper
- SSR via `getServerSideProps` for translations
- Client-side data fetching with SWR + `/api/*` endpoints

## Important Notes

- **Standalone Output**: Configured for containerized deployment
- **Performance Optimizations**: Webpack splitting, compression, and caching enabled
- **Memory Limits**: CI builds use `--max-old-space-size=4096` for Node.js
- **Pre-commit Hooks**: Automatic code formatting and linting via Husky + lint-staged
- **Authentication**: All meaningful endpoints require Auth0 JWT tokens
- **Proxy Architecture**: Next.js API routes proxy authenticated requests to backend services
