# Notification Service - AI Coding Agent Instructions

## Architecture Overview

This is a **TypeScript/Express microservice** that handles email notifications in a distributed task management system. It consumes events from RabbitMQ (via EventBus) and sends notifications via SMTP.

### Core Components & Data Flow

```
RabbitMQ (amqplib) 
  ↓ [EventBus - EventBus.ts]
  ↓ (deserializes protobuf messages)
  ↓ [Event Handlers - notification.service.ts]
  ↓ [Email Service - email.service.ts]
  ↓ Nodemailer (SMTP)
```

**Key Classes:**
- **EventBus** (`src/messaging/EventBus.ts`): Manages RabbitMQ connection, topic-based pub/sub, protobuf deserialization, and handler registry. Initialized in `src/server.ts` → `src/messaging/index.ts`.
- **ApiError** (`src/utils/ApiError.ts`): Custom error class with `statusCode` and `isOperational` flag for error handlers to distinguish between expected and programming errors.

### Service Boundaries

- **RabbitMQ Events**: Only `task.assigned` event type is consumed (defined in `src/messaging/index.ts`).
- **Email**: Nodemailer sends via SMTP; configuration validation happens at startup.
- **HTTP API**: Only provides health check (`GET /health`) and test email endpoint (`POST /test-email`).

---

## Project-Specific Patterns

### 1. Async Error Handling - Use `catchAsync` Wrapper
All route handlers must be wrapped with `catchAsync()` (from `src/utils/catchAsync.ts`). This automatically forwards errors to the error handler middleware instead of requiring manual `try-catch`.

**Pattern:**
```typescript
// ✅ CORRECT
export const myHandler = catchAsync(async (req: Request, res: Response) => {
  // errors here are automatically caught
  const result = await someAsyncCall();
  res.status(200).json(result);
});

// ❌ WRONG - don't do this
export const myHandler = async (req: Request, res: Response) => {
  // unhandled errors crash the process
};
```

### 2. Error Creation - Use `createApiError()`
Always use `createApiError(statusCode, message)` to throw errors; the error handler in `src/middlewares/errorHandler.ts` knows how to respond with these objects.

```typescript
import httpStatus from 'http-status';
import createApiError from '../utils/ApiError';

if (!user) {
  throw createApiError(httpStatus.NOT_FOUND, 'User not found');
}
```

### 3. Request Validation - Joi Schemas + Middleware
Validation schemas are in `src/validations/` (e.g., `notification.validation.ts`). Apply via `validate()` middleware **before** the handler. Joi handles field validation; see `src/middlewares/validate.ts`.

```typescript
// In routes/index.ts
router.post(
  '/test-email',
  validate(notificationValidation.sendTestEmailSchema),  // ← Validates BEFORE handler
  notificationController.sendTestEmail,
);

// In validations/notification.validation.ts
export const sendTestEmailSchema = {
  body: Joi.object({
    to: Joi.string().email().required(),
    subject: Joi.string().optional().max(255),
    message: Joi.string().optional().max(5000),
  }),
};
```

### 4. Event Handling - Register Handlers in messaging/index.ts
New event types are registered in `src/messaging/index.ts` → `registerEventHandlers()` function. Handlers are in `src/services/notification.service.ts`.

**Pattern:** Handler receives `(event: Record<string, unknown>, metadata: EventMetadata)`.

```typescript
// In messaging/index.ts
function registerEventHandlers() {
  eventBus.on('task.assigned', 'TaskAssigned', handleTaskAssigned);
}

// In services/notification.service.ts
export async function handleTaskAssigned(
  event: Record<string, unknown>,
  metadata: EventMetadata,
): Promise<void> {
  // Extract fields, call email service, log events
  logger.info('📧 Processing task assignment', { taskId: event.taskId });
}
```

### 5. Logging - Use Winston Logger
Always use `logger` (from `src/utils/logger.ts`). Include emoji prefixes and context objects for consistency.

```typescript
import logger from '../utils/logger';

logger.info('✅ Operation succeeded', { userId, timestamp });
logger.warn('⚠️ Degraded behavior', { reason });
logger.error('❌ Failed operation:', error);
```

---

## Development Workflows

### Local Development (Hot Reload)
```bash
pnpm install              # Install dependencies
pnpm dev:local           # Runs tsx watch for hot reload
```
Runs on `http://localhost:3002/api/v1/`.

### Docker Development
```bash
pnpm dev                 # = ./scripts/dev.sh, runs docker-compose up
pnpm dev:build          # docker-compose up --build (if Dockerfile.dev changes)
pnpm dev:down           # docker-compose down
pnpm dev:logs           # Tail container logs
```

### Testing
```bash
pnpm test                # Run all tests once
pnpm test:watch         # Run in watch mode
pnpm test:coverage      # Coverage report (must meet 70% threshold)
```
Tests use **supertest** for HTTP assertions and **jest.mock()** for service mocking (see `src/__tests__/notification.test.ts`).

### Linting & Formatting
```bash
pnpm lint               # ESLint check
pnpm lint:fix          # Fix linting issues
pnpm format            # Prettier formatting
pnpm build             # TypeScript compilation
```

---

## Critical Integration Points

### 1. RabbitMQ Connection String
Defined in `config.rabbitmq.url` from `RABBITMQ_URL` env var. Connection is established in `server.ts` via `initializeMessaging()`. Failures during startup log warnings but don't halt the service.

### 2. Protobuf Schema Loading
Located at `/app/proto/task.proto` (Docker path) or relative `./proto/task.proto`. EventBus deserializes incoming AMQP messages using this schema in `EventBus.loadProtoSchema()`.

### 3. Email Configuration
SMTP settings from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`). Validated at startup by `verifyEmailConfig()` in `src/services/email.service.ts`. If invalid, server logs warning but continues.

### 4. Environment Variables
All config in `src/config/index.ts`. Key ones:
- `NODE_ENV`: development/production (affects error stack traces)
- `RABBITMQ_URL`: amqp connection string
- `SMTP_*`: Email credentials
- `LOG_LEVEL`: Winston log verbosity

---

## TypeScript & Build Configuration

- **Target**: ES2022 (CommonJS)
- **Strict Mode**: Enabled (no implicit `any`, null checks, unused locals)
- **Path Alias**: `@/*` → `src/*` (not commonly used; prefer relative imports)
- **Dist Output**: `./dist/` (gitignored)

When adding new files, ensure they compile: `pnpm build`.

---

## Testing Conventions

- Test files: `**/__tests__/**/*.ts` or `**/*.test.ts`
- Mock external services (email, RabbitMQ) using `jest.mock()`
- Use **supertest** to test HTTP routes
- Coverage threshold: 70% (branches, functions, lines, statements)

Example pattern from `notification.test.ts`:
```typescript
jest.mock('../services/email.service', () => ({
  sendTestEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/test-email', () => {
  it('should send a test email', async () => {
    const res = await request(app).post('/api/v1/test-email')
      .send({ to: 'test@example.com', subject: 'Test' });
    
    expect(res.status).toBe(200);
    expect(emailService.sendTestEmail).toHaveBeenCalled();
  });
});
```

---

## When Adding Features

1. **New Routes**: Create handler in `controllers/`, add route in `routes/index.ts`, add validation schema in `validations/`.
2. **New Events**: Register in `messaging/index.ts`, implement handler in `services/notification.service.ts`.
3. **New Services**: Keep in `services/`, export functions, use logger for debugging.
4. **Error Cases**: Throw `createApiError()`, don't `res.status().send()` manually (middleware handles it).

Always wrap async handlers with `catchAsync()` and validate inputs via Joi before handler execution.
