#!/bin/bash
set -e

# Runtime UID/GID matching for proper file permissions
# These should be passed from docker-compose.yml
HOST_UID=${HOST_UID:-2000}
HOST_GID=${HOST_GID:-2000}

# Modify devvy user to match host UID/GID
if [ "$HOST_UID" != "2000" ] || [ "$HOST_GID" != "2000" ]; then
    echo "Adjusting devvy user to match host UID:$HOST_UID GID:$HOST_GID..."
    
    # Create group if it doesn't exist
    if ! getent group $HOST_GID > /dev/null 2>&1; then
        groupadd -g $HOST_GID devvy_group
    fi
    
    # Get the group name for the GID
    DEVVY_GROUP=$(getent group $HOST_GID | cut -d: -f1)
    
    # Modify user and group
    usermod -u $HOST_UID -g $HOST_GID devvy
    
    # Fix home directory ownership
    chown -R $HOST_UID:$HOST_GID /home/devvy
else
    DEVVY_GROUP=$(id -gn devvy)
fi

# Initialize firewall if running with network admin capabilities
if capsh --print | grep -q cap_net_admin; then
    echo "Initializing firewall rules..."
    /usr/local/bin/init-firewall.sh
fi

# Setup container SSH key if provided
if [ -f /home/devvy/.ssh/container_rsa ]; then
    # Only try to change ownership if not read-only
    if touch /home/devvy/.ssh/container_rsa 2>/dev/null; then
        chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/container_rsa
        chmod 600 /home/devvy/.ssh/container_rsa
    fi

    # Add to ssh-agent (run as devvy user)
    su - devvy -c 'eval $(ssh-agent -s) && ssh-add ~/.ssh/container_rsa'
fi

# Setup SSH authorized_keys for host access
if [ -f /secrets/authorized_keys ]; then
    cp /secrets/authorized_keys /home/devvy/.ssh/authorized_keys
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/authorized_keys
    chmod 600 /home/devvy/.ssh/authorized_keys
fi

# Setup GitHub authentication if token provided
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | su - devvy -c 'gh auth login --with-token'
fi

# Configure Git with provided user info
if [ -n "$GIT_USER_NAME" ] && [ "$GIT_USER_NAME" != "Your Name" ]; then
    su - devvy -c "git config --global user.name \"$GIT_USER_NAME\""
fi

if [ -n "$GIT_USER_EMAIL" ] && [ "$GIT_USER_EMAIL" != "your.email@example.com" ]; then
    su - devvy -c "git config --global user.email \"$GIT_USER_EMAIL\""
fi

# Install LazyVim if requested
if [ "$INSTALL_LAZYVIM" = "true" ] && [ ! -d "/home/devvy/.config/nvim_local" ]; then
    echo "Installing LazyVim..."
    su - devvy -c 'git clone https://github.com/LazyVim/starter /home/devvy/.config/nvim_local'
    su - devvy -c 'rm -rf /home/devvy/.config/nvim_local/.git'
fi

# Install VS Code/Cursor extensions from extensions.txt
if [ -f "/home/devvy/vscode-config/extensions.txt" ]; then
    echo "Preparing VS Code Server extension list..."
    
    # Create directories for VS Code Server and Cursor Server
    su - devvy -c 'mkdir -p ~/.vscode-server ~/.cursor-server'
    
    # Create a script that will install extensions when VS Code Server is available
    cat > /home/devvy/.vscode-server-install-extensions.sh << 'EOF'
#!/bin/bash
# This script installs extensions when VS Code Server CLI is available

EXTENSIONS_FILE="/home/devvy/vscode-config/extensions.txt"
INSTALLED_MARKER="/home/devvy/.vscode-server/.extensions-installed"

# Check if already installed
if [ -f "$INSTALLED_MARKER" ]; then
    exit 0
fi

# Find VS Code Server CLI
VSCODE_CLI=$(find ~/.vscode-server/cli -name "code" -type f 2>/dev/null | head -1)
CURSOR_CLI=$(find ~/.cursor-server/cli -name "cursor" -type f 2>/dev/null | head -1)

if [ -n "$VSCODE_CLI" ] && [ -f "$EXTENSIONS_FILE" ]; then
    echo "Installing VS Code Server extensions..."
    while IFS= read -r extension || [ -n "$extension" ]; do
        if [ -n "$extension" ] && [[ ! "$extension" =~ ^# ]]; then
            echo "  Installing: $extension"
            "$VSCODE_CLI" --install-extension "$extension" --force 2>/dev/null || echo "    Warning: Could not install $extension"
        fi
    done < "$EXTENSIONS_FILE"
    touch "$INSTALLED_MARKER"
elif [ -n "$CURSOR_CLI" ] && [ -f "$EXTENSIONS_FILE" ]; then
    echo "Installing Cursor Server extensions..."
    while IFS= read -r extension || [ -n "$extension" ]; do
        if [ -n "$extension" ] && [[ ! "$extension" =~ ^# ]]; then
            echo "  Installing: $extension"
            "$CURSOR_CLI" --install-extension "$extension" --force 2>/dev/null || echo "    Warning: Could not install $extension"
        fi
    done < "$EXTENSIONS_FILE"
    touch "$INSTALLED_MARKER"
fi
EOF
    
    chown devvy:${DEVVY_GROUP} /home/devvy/.vscode-server-install-extensions.sh
    chmod +x /home/devvy/.vscode-server-install-extensions.sh
    
    # Add to zshrc so it runs on each login (will check if already installed)
    if ! grep -q "vscode-server-install-extensions" /home/devvy/.zshrc 2>/dev/null; then
        echo '# Auto-install VS Code/Cursor extensions' >> /home/devvy/.zshrc
        echo '[ -f ~/.vscode-server-install-extensions.sh ] && ~/.vscode-server-install-extensions.sh &' >> /home/devvy/.zshrc
    fi
    
    echo "VS Code Server extension installer prepared"
fi

# Fix permissions on mounted directories
chown -R devvy:${DEVVY_GROUP} /home/devvy/repos 2>/dev/null || true

# Start SSH daemon
if [ "$1" = "/usr/sbin/sshd" ]; then
    echo "Container ready! SSH available on port 22"
    echo "Host key fingerprint:"
    ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
    exec "$@"
else
    exec "$@"
fi