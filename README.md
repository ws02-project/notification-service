# Notification Service

Microservice for sending notifications via email with RabbitMQ event consumption and retry mechanisms.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 24 LTS |
| Language | TypeScript |
| Framework | Express.js |
| Email | Nodemailer |
| Messaging | RabbitMQ |
| Validation | Joi |
| Testing | Jest + Supertest |

## Ports

| Service | Port |
|---------|------|
| HTTP API | 3003 |

## Quick Start

### Docker (Recommended)

```bash
docker-compose up -d
```

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev:local
```

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/test-email` | Send test email |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `task.assigned` | Task Service | Send assignment email |
| `user.created` | User Service | Send welcome email |
| `project.member.added` | Project Service | Send invite email |

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=3003
SERVICE_NAME=notification-service

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin123@localhost:5672

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Task Management System
```

## Project Structure

```
src/
├── config/           # Configuration
├── controllers/      # HTTP handlers
├── services/         # Business logic (email, notification, failureTracking)
├── routes/           # API routes
├── validations/      # Joi schemas
├── messaging/        # RabbitMQ EventBus
├── middlewares/      # Express middleware
├── utils/            # Utilities (logger, ApiError, catchAsync, retry)
└── __tests__/        # Tests (unit + integration)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start with Docker |
| `pnpm dev:local` | Start locally with hot reload |
| `pnpm build` | Build TypeScript |
| `pnpm start` | Start production |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint code |

## Features

### Retry Mechanism

Failed email deliveries are automatically retried with exponential backoff:
- Max retries: 3
- Backoff: 1s, 2s, 4s

### Failure Tracking

Failed notifications are tracked and can be monitored for:
- Bounce detection
- Rate limiting
- Error patterns

## Testing

```bash
# Run all tests
pnpm test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## License

ISC
