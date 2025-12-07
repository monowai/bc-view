# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BC-View is the user interface for the Beancounter financial transaction
processing system. It's a Next.js application that provides portfolio
management, transaction tracking, and financial reporting capabilities.
This is the primary interaction point for users to access the Beancounter
services.

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
yarn check-imports # Import path regression check (prevents 500 errors)

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

# Test-Driven Development (TDD) Approach

## Mandatory TDD Workflow

When implementing new features or fixing bugs, ALWAYS follow this strict TDD cycle:

### 1. Understand Requirements First

- Clarify the feature/fix requirements before writing any code
- Ask questions if specifications are ambiguous
- Identify edge cases and expected behaviors

### 2. Write Tests FIRST (Red Phase)

- Write failing tests BEFORE implementing any functionality
- Tests should cover:
  - Happy path scenarios
  - Edge cases
  - Error conditions
  - Boundary values
- Use descriptive test names that explain the expected behavior
- Start with the simplest test case

### 3. Run Tests to Confirm Failure

- Verify that new tests fail for the right reasons
- Ensure test failure messages are clear and informative

### 4. Implement Minimal Code (Green Phase)

- Write the SIMPLEST code that makes the tests pass
- Don't add functionality that isn't tested
- Focus on making tests green, not on perfect code

### 5. Run Tests to Confirm Success

- All new tests should pass
- All existing tests should still pass (no regressions)

### 6. Refactor (Refactor Phase)

- Improve code quality while keeping tests green
- Remove duplication
- Improve naming and structure
- Run tests after each refactoring step

### 7. Repeat the Cycle

- Continue with the next smallest piece of functionality

## Testing Framework Preferences

For Next.js/React projects, prefer:

- **Unit Tests**: Jest + React Testing Library
- **Component Tests**: React Testing Library
- **Integration Tests**: Jest + MSW (Mock Service Worker)
- **E2E Tests**: Playwright or Cypress

TDD Guidelines
DO:

Write tests that describe behavior, not implementation
Keep tests focused and atomic (one assertion concept per test)
Use meaningful test descriptions
Mock external dependencies
Test user-facing behavior over internal implementation
Keep tests fast and independent

DON'T:

Write implementation code before tests
Skip tests because "it's simple"
Test implementation details
Write tests that depend on other tests
Leave failing tests uncommitted
Mock everything (only mock boundaries)

Test Coverage Expectations

Aim for 80%+ code coverage
100% coverage for critical business logic
Focus on meaningful coverage, not just hitting percentages

When Working on Existing Code
If adding to untested code:

Write tests for the NEW functionality first
Add tests for AFFECTED existing code
Refactor with tests in place
Gradually improve test coverage

Checklist Before Committing

All tests are passing
New functionality has corresponding tests
Tests are clear and well-named
No commented-out test code
Test coverage hasn't decreased
Tests run quickly
Linting checks pass

Remember
"Red, Green, Refactor" - This is the rhythm of TDD. Never skip the Red phase!
