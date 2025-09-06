#!/bin/bash
echo "Claude Docker Environment Cleanup"
echo "===================================="
echo ""

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Interactive cleanup options
echo "What would you like to clean up?"
echo ""

# Container and image
read -p "1. Remove container and image? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Stopping container..."
    docker-compose down 2>/dev/null || true
    docker rm -f claude-dev 2>/dev/null || true
    echo "   Removing image..."
    docker rmi claude-docker_claude-dev 2>/dev/null || true
    echo "   Container and image removed"
fi

# Volumes
echo ""
read -p "2. Remove Docker volumes (nvim, npm cache, etc)? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for vol in nvim-data zsh-history npm-cache pnpm-store claude-code-data vscode-server; do
        docker volume rm "claude-docker_${vol}" 2>/dev/null || true
    done
    echo "   Volumes removed"
fi

# VS Code/Cursor settings
echo ""
read -p "3. Reset VS Code/Cursor settings to defaults? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d vscode-config ]; then
        rm -f vscode-config/settings.json
        rm -f vscode-config/keybindings.json
        rm -f vscode-config/extensions.txt
        echo "{}" > vscode-config/settings.json
        echo "[]" > vscode-config/keybindings.json
        touch vscode-config/extensions.txt
        echo "   VS Code settings reset to defaults"
    fi
fi

# SSH keys and secrets
echo ""
read -p "4. Remove SSH keys and secrets? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf secrets/*
    rm -f ~/.ssh/claude_docker_rsa*
    echo "   SSH keys and secrets removed"
fi

# Environment files
echo ""
read -p "5. Remove environment files (.env, .env.local)? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f .env .env.local
    echo "   Environment files removed"
fi

# Full reset option
echo ""
echo "──────────────────────────────────"
read -p "WARNING: FULL RESET - Remove everything? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Performing full cleanup..."
    docker-compose down -v 2>/dev/null || true
    docker rm -f claude-dev 2>/dev/null || true
    docker rmi claude-docker_claude-dev 2>/dev/null || true
    rm -rf secrets
    rm -f .env .env.local
    rm -f ~/.ssh/claude_docker_rsa*
    # Reset VS Code config but keep directory
    if [ -d vscode-config ]; then
        rm -f vscode-config/*
        echo "{}" > vscode-config/settings.json
        echo "[]" > vscode-config/keybindings.json
        touch vscode-config/extensions.txt
    fi
    echo "   Full cleanup complete!"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Cleanup complete!"
echo ""
echo "To rebuild the environment, run:"
echo "  ./setup-scripts/setup.sh"
echo "═══════════════════════════════════════════════════════════"