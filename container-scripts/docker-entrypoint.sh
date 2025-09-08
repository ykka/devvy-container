#!/bin/bash
set -e

# Get the devvy user's group name for use later
DEVVY_GROUP=$(id -gn devvy)

# Set the PROJECTS_PATH environment variable
# The /home/devvy/repos directory is mounted from the host's ${PROJECTS_PATH}
export PROJECTS_PATH=/home/devvy/repos

# Initialize firewall if running with network admin capabilities
if capsh --print | grep -q cap_net_admin; then
    echo "Initializing firewall rules..."
    /usr/local/bin/init-firewall.sh
fi

# Setup SSH authorized_keys for access from local machine
if [ -f /secrets/authorized_keys ]; then
    cp /secrets/authorized_keys /home/devvy/.ssh/authorized_keys
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/authorized_keys
    chmod 600 /home/devvy/.ssh/authorized_keys
fi

# Setup GitHub authentication if token provided
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | su - devvy -c 'gh auth login --with-token'
fi

# Configure Git with provided user info - skip if .gitconfig is read-only
if [ -w "/home/devvy/.gitconfig" ] || [ ! -e "/home/devvy/.gitconfig" ]; then
    if [ -n "$GIT_USER_NAME" ] && [ "$GIT_USER_NAME" != "Your Name" ]; then
        su - devvy -c "git config --global user.name \"$GIT_USER_NAME\"" || echo "Warning: Could not set git user.name"
    fi

    if [ -n "$GIT_USER_EMAIL" ] && [ "$GIT_USER_EMAIL" != "your.email@example.com" ]; then
        su - devvy -c "git config --global user.email \"$GIT_USER_EMAIL\"" || echo "Warning: Could not set git user.email"
    fi
else
    echo "Git config is read-only, skipping git configuration"
fi

# Install LazyVim plugins if config is mounted
if [ -d "/home/devvy/.config/nvim" ] && [ -f "/home/devvy/.config/nvim/init.lua" ]; then
    echo "Neovim config detected, installing plugins..."
    # Since config is read-only, plugins will be installed to ~/.local/share/nvim
    su - devvy -c 'nvim --headless "+Lazy! sync" +qa' || echo "Plugin installation completed or skipped"
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
    # Skip if .zshrc is read-only
    if [ -w "/home/devvy/.zshrc" ]; then
        if ! grep -q "vscode-server-install-extensions" /home/devvy/.zshrc 2>/dev/null; then
            echo '# Auto-install VS Code/Cursor extensions' >> /home/devvy/.zshrc
            echo '[ -f ~/.vscode-server-install-extensions.sh ] && ~/.vscode-server-install-extensions.sh &' >> /home/devvy/.zshrc
        fi
    else
        echo "Note: .zshrc is read-only, VS Code extensions will need manual installation"
    fi
    
    echo "VS Code Server extension installer prepared"
fi

# Skip permission changes on mounted directories - they inherit from host

# Start SSH daemon
if [ "$1" = "/usr/sbin/sshd" ]; then
    echo "Starting SSH daemon..."
    # Generate host keys if they don't exist
    if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
        ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""
    fi
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N ""
    fi
    
    echo "Container ready! SSH available on port 22"
    echo "Host key fingerprint:"
    ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
    
    # Start sshd in foreground
    exec /usr/sbin/sshd -D
else
    exec "$@"
fi