#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Container name
CONTAINER_NAME="claude-dev"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: Container '${CONTAINER_NAME}' is not running${NC}"
    echo "Please start the container first with: ./devvy start"
    exit 1
fi

# Check if SSH key exists
SSH_KEY="$HOME/.ssh/claude_docker_rsa"
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
    echo "Please run './devvy init' to set up SSH keys"
    exit 1
fi

echo -e "${GREEN}Connecting to claude-dev container via mosh on port 2222...${NC}"

# Connect via mosh with SSH on port 2222 and run tmux commands
mosh --ssh="ssh -p 2222 -i ~/.ssh/claude_docker_rsa" devvy@localhost -- bash -c '
    # Check GitHub connectivity
    echo "Checking GitHub connectivity..."
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        echo -e "\033[0;32m✓ GitHub SSH connection successful\033[0m"
    else
        echo -e "\033[1;33m⚠ Warning: Cannot connect to GitHub via SSH\033[0m"
        echo "You may need to:"
        echo "  1. Add your SSH key to the container"
        echo "  2. Configure git with: git config --global user.email \"you@example.com\""
        echo "  3. Configure git with: git config --global user.name \"Your Name\""
        echo ""
    fi
    
    # Check if tmux session exists and attach/create
    if tmux has-session -t dev 2>/dev/null; then
        echo "Attaching to existing dev tmux session..."
        exec tmux attach-session -t dev
    else
        echo "Creating new dev tmux session..."
        exec tmux new-session -s dev
    fi
'