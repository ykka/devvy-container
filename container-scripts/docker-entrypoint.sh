#!/bin/bash
set -euo pipefail

# Error handling
trap 'echo "[INIT:ERROR] Error on line $LINENO"; exit 1' ERR

echo "[INIT] Starting container initialization..."

# Get the devvy user's group name for use later
DEVVY_GROUP=$(id -gn devvy)

# Set the PROJECTS_PATH environment variable
# The /home/devvy/repos directory is mounted from the host's ${PROJECTS_PATH}
export PROJECTS_PATH=/home/devvy/repos

# Fix volume ownership first (Priority 1)
echo "[INIT] Fixing volume ownership..."
for dir in "/home/devvy/.local/share/nvim" \
           "/home/devvy/.local/share/zsh" \
           "/home/devvy/.local/share/pnpm" \
           "/home/devvy/.local/share/claude-code" \
           "/home/devvy/.npm" \
           "/home/devvy/.vscode-server" \
           "/home/devvy/.vscode-server-insiders" \
           "/home/devvy/.tmux/plugins"; do
    if [ -d "$dir" ]; then
        chown -R devvy:${DEVVY_GROUP} "$dir" || echo "Warning: Could not change ownership of $dir"
    fi
done

# Initialize firewall if running with network admin capabilities
if capsh --print | grep -q cap_net_admin; then
    echo "[INIT] Initializing firewall rules..."
    /usr/local/bin/init-firewall.sh || { echo "ERROR: Failed to initialize firewall"; exit 1; }
fi

# Setup SSH authorized_keys for access from local machine
if [ -f /secrets/authorized_keys ]; then
    echo "[INIT] Setting up SSH keys..."
    cp /secrets/authorized_keys /home/devvy/.ssh/authorized_keys
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/authorized_keys
    chmod 600 /home/devvy/.ssh/authorized_keys
fi

# Setup GitHub SSH authentication if keys are mounted
if [ -d "/github-ssh" ] && [ -f "/github-ssh/github_rsa" ]; then
    echo "[INIT] Configuring GitHub SSH..."
    
    # Copy GitHub SSH keys to devvy's .ssh directory
    cp /github-ssh/github_rsa /home/devvy/.ssh/github_rsa
    cp /github-ssh/github_rsa.pub /home/devvy/.ssh/github_rsa.pub
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/github_rsa*
    chmod 600 /home/devvy/.ssh/github_rsa
    chmod 644 /home/devvy/.ssh/github_rsa.pub
    
    # Create SSH config for GitHub
    cat > /home/devvy/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_rsa
    IdentitiesOnly yes
    StrictHostKeyChecking no
EOF
    
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/config
    chmod 600 /home/devvy/.ssh/config
    
    # Add GitHub to known hosts
    if ! su - devvy -c "ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null"; then
        echo "WARNING: Failed to add GitHub to known hosts"
    fi
    
    # Configure gh CLI to use SSH for git operations
    if ! su - devvy -c "gh config set git_protocol ssh --host github.com 2>/dev/null"; then
        echo "WARNING: gh CLI not available or configuration failed"
    fi
    
    echo "[INIT] GitHub SSH authentication configured"
fi

# Configure Git with provided user info - skip if .gitconfig is read-only
if [ -w "/home/devvy/.gitconfig" ] || [ ! -e "/home/devvy/.gitconfig" ]; then
    echo "[INIT] Configuring Git..."
    if [ -n "$GIT_USER_NAME" ] && [ "$GIT_USER_NAME" != "Your Name" ]; then
        su - devvy -c "git config --global user.name \"$GIT_USER_NAME\"" || echo "Warning: Could not set git user.name"
    fi

    if [ -n "$GIT_USER_EMAIL" ] && [ "$GIT_USER_EMAIL" != "your.email@example.com" ]; then
        su - devvy -c "git config --global user.email \"$GIT_USER_EMAIL\"" || echo "Warning: Could not set git user.email"
    fi
else
    echo "Git config is read-only, skipping git configuration"
fi

# Install LazyVim plugins if config is mounted (with timeout)
if [ -d "/home/devvy/.config/nvim" ] && [ -f "/home/devvy/.config/nvim/init.lua" ]; then
    echo "[INIT] Installing Neovim plugins..."
    # Since config is read-only, plugins will be installed to ~/.local/share/nvim
    if ! timeout 30s su - devvy -c 'nvim --headless "+Lazy! sync" +qa'; then
        echo "ERROR: Neovim plugin installation failed or timed out"
        exit 1
    fi
    echo "[INIT] Neovim plugins installed successfully"
fi

# Install tmux plugins using TPM
echo "[INIT] Installing tmux plugins..."
# Ensure TPM is present (it should be from Dockerfile, but check in case volume is empty)
if [ ! -d "/home/devvy/.tmux/plugins/tpm" ]; then
    echo "[INIT] Installing TPM..."
    su - devvy -c "git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm" || echo "Warning: Could not install TPM"
fi

# Install tmux plugins non-interactively
if [ -d "/home/devvy/.tmux/plugins/tpm" ]; then
    echo "[INIT] Running TPM plugin installation..."
    # The install_plugins script can run without tmux being active
    su - devvy -c "~/.tmux/plugins/tpm/bin/install_plugins" || echo "Warning: Some tmux plugins may not have installed correctly"
    echo "[INIT] Tmux plugins installation completed"
fi

# Install VS Code/Cursor extensions from extensions.txt
if [ -f "/home/devvy/vscode-config/extensions.txt" ]; then
    echo "[INIT] Preparing VS Code extensions..."
    
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
    
    echo "[INIT] VS Code Server extension installer prepared"
fi

# Skip permission changes on mounted directories - they inherit from host

# Start SSH daemon
if [ "$1" = "/usr/sbin/sshd" ]; then
    echo "[INIT] Starting SSH daemon..."
    
    # Health check: verify sshd is available
    if ! command -v sshd >/dev/null; then
        echo "ERROR: sshd not found"
        exit 1
    fi
    
    # Generate SSH server keys for the container if they don't exist
    if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
        ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N "" || { echo "ERROR: Failed to generate ED25519 host key"; exit 1; }
    fi
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N "" || { echo "ERROR: Failed to generate RSA host key"; exit 1; }
    fi
    
    echo "[INIT] Container ready! SSH available on port 22"
    echo "[INIT] Container's SSH server key fingerprint:"
    ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
    
    # Final marker indicating successful initialization
    echo "--CLAUDE-DEVVY-CONTAINER-READY--"
    
    # Start sshd in foreground
    exec /usr/sbin/sshd -D
else
    exec "$@"
fi