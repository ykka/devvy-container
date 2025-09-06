#!/bin/bash
# Script to rebuild container and clean SSH known_hosts

echo "🔧 Rebuilding claude-docker container..."

# Remove old SSH host key for localhost:2222
echo "🔑 Removing old SSH host key..."
ssh-keygen -R "[localhost]:2222" 2>/dev/null || true

# Rebuild the container
echo "🏗️  Building container..."
docker-compose down
docker-compose build "$@"
docker-compose up -d

# Wait for SSH to be ready
echo "⏳ Waiting for SSH service to start..."
sleep 3

# Add new host key automatically
echo "🔑 Adding new SSH host key..."
ssh-keyscan -p 2222 -H localhost >> ~/.ssh/known_hosts 2>/dev/null

echo "✅ Container rebuilt and SSH keys updated!"
echo "📝 You can now connect with: ./devvy connect"