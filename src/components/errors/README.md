# Error Handling Components

Comprehensive error handling system for BC-View with auto-detection for common
error scenarios.

## Components

### 1. ErrorOut Component

Main error display component with user-friendly UI and auto-detection capabilities.

**Features:**

- Auto-detects authentication and backend errors
- Custom icons for different error types (lock for auth, server for backend,
  alert for others)
- Suggested actions and helpful tips
- Retry and navigation buttons
- Technical details toggle (development only)
- Fully responsive and accessible

**Usage:**

```typescript
import ErrorOut from "@components/errors/ErrorOut"

// Auto-detect error type (recommended)
<ErrorOut error={error} autoDetect={true} />

// With custom message
<ErrorOut
  error={error}
  message="Failed to load your portfolio data"
  autoDetect={true}
/>

// Backward compatible (old signature)
import { errorOut } from "@components/errors/ErrorOut"
return errorOut("Error loading holdings", error)
```

### 2. Error Detector

Utility functions to detect and categorize common errors.

**Detects:**

- Authentication errors (401, 403, "unauthorized", "auth0", etc.)
- Backend unavailable (503, 502, ECONNREFUSED, "failed to fetch", etc.)
- 404 Not Found
- 500 Server Error
- Network errors
- Generic errors

**Usage:**

```typescript
import {
  detectErrorType,
  isAuthError,
  isBackendError,
} from "@components/errors/errorDetector"

// Detect error type
const detected = detectErrorType(error)
console.log(detected.type) // "auth" | "backend" | "404" | "500" | "network" | "generic"
console.log(detected.title) // User-friendly title
console.log(detected.message) // User-friendly message
console.log(detected.canRetry) // Boolean
console.log(detected.suggestedAction) // Optional helpful tip

// Check specific error types
if (isAuthError(error)) {
  // Redirect to login
}

if (isBackendError(error)) {
  // Show backend unavailable message
}
```

### 3. Error Boundary

React Error Boundary to catch rendering errors.

**Features:**

- Catches React component errors
- Integrates with Sentry
- Shows fallback UI automatically
- Allows retry

**Usage:**

```typescript
import ErrorBoundary from "@components/errors/ErrorBoundary"

// Wrap your app or specific components
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<CustomErrorPage />}>
  <YourComponent />
</ErrorBoundary>
```

## Common Error Scenarios

### Authentication Errors

**Detected when:**

- HTTP 401, 403 **ONLY**
- Status code takes absolute priority over message content

**IMPORTANT:**

- Only 401 and 403 status codes are treated as authentication errors
- Message content is ignored to prevent false positives (e.g., 500 error with
  "auth" in message)

**Display:**

- Yellow lock icon
- "Authentication Required" title
- Login button (navigates to `/api/auth/login`)
- No retry button
- Helpful tip about logging in

**Example:**

```typescript
const error = { response: { status: 401 } }
<ErrorOut error={error} autoDetect={true} />
```

### Backend Unavailable

**Detected when:**

- HTTP 503, 502, 504
- Error codes: ECONNREFUSED, ETIMEDOUT, ENOTFOUND
- Error message contains: "failed to fetch", "service unavailable",
  "connection refused", "backend"

**Display:**

- Orange server icon
- "Service Unavailable" title
- Retry button
- Helpful tip about starting the backend service
- Suggested action: "Please ensure the backend service is running"

**Example:**

```typescript
const error = { code: "ECONNREFUSED", message: "Connection refused" }
<ErrorOut error={error} autoDetect={true} />
```

### 404 Not Found

**Display:**

- Red error icon
- "404" status code
- "Page Not Found" title
- Go Home button
- No retry button

### 500 Server Error

**Display:**

- Red error icon
- "500" status code
- "Server Error" title
- Retry button
- Go Home button

## Testing

All components have comprehensive test coverage:

```bash
# Run all error tests
yarn jest src/components/errors/

# Run specific test file
yarn jest src/components/errors/__tests__/ErrorOut.test.tsx
yarn jest src/components/errors/__tests__/errorDetector.test.ts
```

**Test Coverage:**

- 43 tests total
- Error detection (26 tests)
- ErrorOut component (17 tests)
- Authentication error scenarios
- Backend unavailable scenarios
- UI rendering and interactions
- Accessibility

## API Reference

### ErrorOut Props

```typescript
interface ErrorOutProps {
  error: Error | any // Required: The error object
  message?: string // Optional: Custom message (auto-generated if not provided)
  type?: ErrorType // Optional: Force specific error type
  showRetry?: boolean // Optional: Show retry button (default: auto-determined)
  showHome?: boolean // Optional: Show home button (default: true)
  showLogin?: boolean // Optional: Show login button (default: auto for auth errors)
  onRetry?: () => void // Optional: Custom retry handler
  autoDetect?: boolean // Optional: Auto-detect error type (default: true)
}
```

### Error Types

```typescript
type ErrorType = "auth" | "backend" | "network" | "404" | "500" | "generic"
```

## Integration with Existing Code

All existing `errorOut` function calls continue to work:

```typescript
// Old code (still works)
import errorOut from "@components/errors/ErrorOut"
if (error) {
  return errorOut("Failed to load data", error)
}

// Or use new import style
import { errorOut } from "@components/errors/ErrorOut"
if (error) {
  return errorOut("Failed to load data", error)
}
```

## Production vs Development

**Development Mode:**

- Shows technical details toggle
- Displays error stack traces
- Console logging enabled

**Production Mode:**

- Hides technical details completely
- Only shows user-friendly messages
- Reports to Sentry
- Clean, professional appearance

## Best Practices

1. **Always use autoDetect for SWR/fetch errors:**

   ```typescript
   const { data, error } = useSwr(url, fetcher)
   if (error) {
     return <ErrorOut error={error} autoDetect={true} />
   }
   ```

2. **Provide custom messages for domain-specific errors:**

   ```typescript
   <ErrorOut
     error={error}
     message="Unable to load your portfolio holdings"
     autoDetect={true}
   />
   ```

3. **Use Error Boundary at the root level:**

   ```typescript
   // _app.tsx
   <ErrorBoundary>
     <Component {...pageProps} />
   </ErrorBoundary>
   ```

4. **Custom retry handlers for data refetching:**

   ```typescript
   const { data, error, mutate } = useSwr(url, fetcher)
   if (error) {
     return (
       <ErrorOut
         error={error}
         autoDetect={true}
         onRetry={() => mutate()}
       />
     )
   }
   ```
