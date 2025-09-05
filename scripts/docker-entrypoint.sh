#!/bin/bash
set -e

# Initialize firewall if running with network admin capabilities
if capsh --print | grep -q cap_net_admin; then
    echo "Initializing firewall rules..."
    /usr/local/bin/init-firewall.sh
fi

# Setup container SSH key if provided
if [ -f /home/devvy/.ssh/container_rsa ]; then
    chown devvy:developer /home/devvy/.ssh/container_rsa
    chmod 600 /home/devvy/.ssh/container_rsa

    # Add to ssh-agent
    sudo -u devvy bash -c 'eval $(ssh-agent -s) && ssh-add ~/.ssh/container_rsa'
fi

# Setup SSH authorized_keys for host access
if [ -f /secrets/authorized_keys ]; then
    cp /secrets/authorized_keys /home/devvy/.ssh/authorized_keys
    chown devvy:developer /home/devvy/.ssh/authorized_keys
    chmod 600 /home/devvy/.ssh/authorized_keys
fi

# Setup GitHub authentication if token provided
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | sudo -u devvy gh auth login --with-token
fi

# Configure git
if [ -n "$GIT_USER_NAME" ] && [ -n "$GIT_USER_EMAIL" ]; then
    sudo -u devvy git config --global user.name "$GIT_USER_NAME"
    sudo -u devvy git config --global user.email "$GIT_USER_EMAIL"
fi

# Fix permissions on mounted directories
chown -R devvy:developer /home/devvy/claudespace 2>/dev/null || true

# Start SSH daemon
if [ "$1" = "/usr/sbin/sshd" ]; then
    echo "Container ready! SSH available on port 22"
    exec "$@"
else
    exec "$@"
fi