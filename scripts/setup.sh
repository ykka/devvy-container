#!/bin/bash
set -e

echo "🚀 Setting up Claude Docker Development Environment..."

# Get current directory
SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SETUP_DIR"

# Detect user/group IDs
USER_ID=$(id -u)
GROUP_ID=$(id -g)

# Get git config from host
GIT_USER_NAME=$(git config --global user.name 2>/dev/null || echo "")
GIT_USER_EMAIL=$(git config --global user.email 2>/dev/null || echo "")

# Update .env file WITH QUOTES for values that might have spaces
cat > .env <<EOF
# User IDs
USER_ID=$USER_ID
GROUP_ID=$GROUP_ID

# Git config (quoted for names with spaces)
GIT_USER_NAME="$GIT_USER_NAME"
GIT_USER_EMAIL="$GIT_USER_EMAIL"

# Optional: Enable Playwright support
ENABLE_PLAYWRIGHT=false
EOF

echo "✓ Detected configuration:"
echo "  User ID: $USER_ID"
echo "  Group ID: $GROUP_ID"
echo "  Git Name: $GIT_USER_NAME"
echo "  Git Email: $GIT_USER_EMAIL"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    cat > .env.local <<'EOF'
# GitHub Personal Access Token
# Create at: https://github.com/settings/tokens
# Scopes needed: repo, workflow, read:org
GITHUB_TOKEN=

# Linear API Key (optional)
# Get from: https://linear.app/settings/api
LINEAR_API_KEY=

# Database connections (optional)
DATABASE_URL=
MONGODB_URI=
SUPABASE_URL=
SUPABASE_ANON_KEY=
EOF
    echo "⚠️  Created .env.local - Please add your tokens!"
    echo "   Edit: $SETUP_DIR/.env.local"
    echo "   Waiting for you to add tokens..."
    echo ""
    read -p "Press Enter after adding your tokens to .env.local..."
fi

# LOAD the environment files and EXPORT variables for docker-compose
set -a  # automatically export all variables
source .env
[ -f .env.local ] && source .env.local
set +a  # turn off automatic export

# Create necessary directories
mkdir -p secrets
mkdir -p ~/Repos/claudespace/worktrees

# Generate container SSH key if it doesn't exist
if [ ! -f secrets/container_rsa ]; then
    echo ""
    echo "🔐 Generating SSH key for container..."
    ssh-keygen -t ed25519 -f secrets/container_rsa -N "" -C "claude-docker"
    echo "✓ SSH key generated: secrets/container_rsa"
    echo ""
    echo "📋 Add this public key to GitHub:"
    echo "   https://github.com/settings/keys"
    echo ""
    cat secrets/container_rsa.pub
    echo ""
    read -p "Press Enter after adding the SSH key to GitHub..."
fi

# Generate SSH key for host access
if [ ! -f ~/.ssh/claude_docker_rsa ]; then
    ssh-keygen -t ed25519 -f ~/.ssh/claude_docker_rsa -N "" -C "claude-docker-access"
    echo "✓ Host SSH key generated: ~/.ssh/claude_docker_rsa"
fi

# Create authorized_keys for container
cp ~/.ssh/claude_docker_rsa.pub secrets/authorized_keys
chmod 600 secrets/authorized_keys
chmod 600 secrets/container_rsa

# Check if Claude MCP config exists
if [ -f ~/.claude/mcp-config.json ]; then
    echo "✓ Found Claude MCP config at ~/.claude/mcp-config.json"
else
    echo "⚠️  No MCP config found at ~/.claude/mcp-config.json"
    echo "   Claude Code will use default settings"
fi

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    cat > .gitignore <<'EOF'
.env.local
secrets/
*.log
.DS_Store
node_modules/
EOF
fi

# Build the Docker image
echo ""
echo "🔨 Building Docker image..."
docker-compose build

# Recreate container with new image if it changed
echo ""
echo "🚀 Starting container..."
docker-compose up -d --force-recreate

# Wait for container to be ready
echo "⏳ Waiting for container initialization..."
for i in {1..10}; do
    if docker exec claude-dev echo "Container ready" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Verify container is running
if ! docker ps | grep -q claude-dev; then
    echo "❌ Container failed to start!"
    echo "Check logs with: docker-compose logs"
    exit 1
fi

# Show connection info
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ Claude Dev Environment Ready!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📦 Container: claude-dev"
echo "👤 Username: devvy"
echo ""
echo "🔗 Connection Methods:"
echo "  SSH:  ssh -p 2222 devvy@localhost -i ~/.ssh/claude_docker_rsa"
echo "  Mosh: mosh --ssh='ssh -p 2222 -i ~/.ssh/claude_docker_rsa' devvy@localhost"
echo "  Exec: docker exec -it claude-dev zsh"
echo ""
echo "📁 Mounted Directories:"
echo "  CloudSpace: ~/Repos/claudespace → /home/devvy/claudespace"
echo "  Worktrees:  ~/Repos/claudespace/worktrees → /home/devvy/claudespace/worktrees"
echo ""
echo "🚀 Dev Ports: 3000-3010"
echo "🗄️  Database Ports: 5432 (PostgreSQL), 27017 (MongoDB)"
echo ""

# Check for required tokens
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  WARNING: GitHub Token not set in .env.local"
    echo "   Git operations may fail!"
fi

if [ -z "$LINEAR_API_KEY" ]; then
    echo "ℹ️  Note: Linear API Key not set (optional)"
fi

echo ""
echo "📝 Quick Start Commands:"
echo ""
echo "  # Enter container:"
echo "  docker exec -it claude-dev zsh"
echo ""
echo "  # Run Claude Code:"
echo "  claude-code --dangerously-skip-container-sandbox-confirmation"
echo ""
echo "  # Create a worktree:"
echo "  cd ~/claudespace/your-repo"
echo "  git worktree add worktrees/feature-branch"
echo ""
echo "  # Stop container:"
echo "  docker-compose stop"
echo ""
echo "  # Restart container:"
echo "  docker-compose start"
echo ""
echo "  # View logs:"
echo "  docker-compose logs -f"
echo ""
echo "═══════════════════════════════════════════════════════════════════"

# Optional: Jump right into the container
read -p "Would you like to enter the container now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Entering container..."
    docker exec -it claude-dev zsh
fi