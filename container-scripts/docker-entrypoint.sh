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

# Git config is mounted from host system as read-only, no need to configure

# Install LazyVim if requested
if [ "$INSTALL_LAZYVIM" = "true" ] && [ ! -d "/home/devvy/.config/nvim_local" ]; then
    echo "Installing LazyVim..."
    su - devvy -c 'git clone https://github.com/LazyVim/starter /home/devvy/.config/nvim_local'
    su - devvy -c 'rm -rf /home/devvy/.config/nvim_local/.git'
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