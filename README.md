# Notification Service

Production-ready notification microservice with TypeScript, Express, and RabbitMQ integration.

## Features

- 📧 Email notifications using Nodemailer
- 🐰 RabbitMQ event consumption for task assignments
- 🚀 Express REST API with health check and test endpoints
- 🐳 Docker support for development and production
- 📝 TypeScript with strict type checking
- ✅ Comprehensive error handling

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose (for containerized development)
- RabbitMQ (running in Docker or separately)

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3002
API_VERSION=v1
SERVICE_NAME=notification-service
LOG_LEVEL=info

# RabbitMQ Configuration
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Task Management System
```

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev:local
```

### Docker Development

```bash
# Start with Docker Compose
pnpm dev

# Or use the script directly
./scripts/dev.sh
```

## API Endpoints

### Health Check

```http
GET /api/v1/health
```

### Send Test Email

```http
POST /api/v1/test-email
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "message": "This is a test email"
}
```

## Event Handling

The service listens to RabbitMQ events:

- `task.assigned` - Sends email notification when a task is assigned to a user

## Project Structure

```
notification-service/
├── src/
│   ├── config/          # Configuration
│   ├── controllers/    # Request handlers
│   ├── middlewares/     # Express middlewares
│   ├── messaging/       # RabbitMQ EventBus
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   ├── validations/     # Request validation schemas
│   ├── app.ts           # Express app
│   └── server.ts        # Server entry point
├── scripts/             # Development scripts
├── Dockerfile           # Production Docker image
├── Dockerfile.dev       # Development Docker image
├── docker-compose.yml   # Docker Compose configuration
└── package.json
```

## Building for Production

```bash
# Build TypeScript
pnpm build

# Start production server
pnpm start
```

## Docker Production

```bash
# Build and run production container
docker-compose --profile production up notification-service-prod
```

## License

ISC

