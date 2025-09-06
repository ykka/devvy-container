#!/bin/bash
set -e

# Get the actual group name for devvy user
DEVVY_GROUP=$(id -gn devvy)

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

    # Add to ssh-agent
    sudo -u devvy bash -c 'eval $(ssh-agent -s) && ssh-add ~/.ssh/container_rsa'
fi

# Setup SSH authorized_keys for host access
if [ -f /secrets/authorized_keys ]; then
    cp /secrets/authorized_keys /home/devvy/.ssh/authorized_keys
    chown devvy:${DEVVY_GROUP} /home/devvy/.ssh/authorized_keys
    chmod 600 /home/devvy/.ssh/authorized_keys
fi

# Setup GitHub authentication if token provided
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | sudo -u devvy gh auth login --with-token
fi

# Git config is mounted from host system as read-only, no need to configure

# Fix permissions on mounted directories
chown -R devvy:${DEVVY_GROUP} /home/devvy/claudespace 2>/dev/null || true

# Start SSH daemon
if [ "$1" = "/usr/sbin/sshd" ]; then
    echo "Container ready! SSH available on port 22"
    echo "Host key fingerprint:"
    ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
    exec "$@"
else
    exec "$@"
fi