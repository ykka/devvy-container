#!/bin/bash
echo "🧹 Cleaning up Claude Docker environment..."

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Stop everything
docker-compose down 2>/dev/null || true

# Remove container
docker rm -f claude-dev 2>/dev/null || true

# Remove image
docker rmi claude-docker_claude-dev 2>/dev/null || true

# Remove volumes
for vol in nvim-data zsh-history npm-cache pnpm-store claude-code-data; do
    docker volume rm "claude-docker_${vol}" 2>/dev/null || true
done

# Clean secrets but keep the directory
# rm -rf secrets/*
# mkdir -p secrets

# Remove environment files
# rm -f .env .env.local

echo "✅ Cleanup complete! You can now run ./scripts/setup.sh"