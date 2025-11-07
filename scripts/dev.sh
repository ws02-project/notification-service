#!/bin/bash

# Script to start development environment with proper image handling
# This ensures the Docker image is built if it doesn't exist

set -e

echo "🚀 Starting notification-service development environment..."

# Check if the image exists
if ! docker images | grep -q "notification-service_notification-service-dev"; then
    echo "📦 Docker image not found. Building..."
    # Remove old containers if they exist
    docker-compose down 2>/dev/null || true
    docker-compose build notification-service-dev
fi

# Start the container
echo "🐳 Starting containers..."
docker-compose up

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    docker-compose down
    exit 0
}

trap cleanup INT TERM

