# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

# Install system dependencies including ImageMagick
RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    sudo \
    openssh-server \
    mosh \
    iptables \
    ipset \
    libcap2-bin \
    dnsutils \
    locales \
    fzf \
    build-essential \
    cmake \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    fd-find \
    xclip \
    luarocks \
    libmsgpack-dev \
    zsh \
    tmux \
    imagemagick \
    jq \
    htop \
    postgresql-client \
    # For potential Playwright support (headless Chrome)
    chromium \
    chromium-driver \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Configure locales for UTF-8 support (required for mosh)
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Build arguments for UID/GID matching
ARG HOST_UID=1000
ARG HOST_GID=1000

# Create devvy user with host-matching UID/GID
# If the GID already exists, use that group; otherwise create a new one
RUN (getent group ${HOST_GID} || groupadd -g ${HOST_GID} devvy) && \
    useradd -u ${HOST_UID} -g ${HOST_GID} -m -s /bin/zsh devvy

# Configure SSH for remote access (for mosh/ssh from host)
RUN mkdir /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Enable corepack for pnpm/yarn support
RUN corepack enable

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt update && apt install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Build Neovim from source (latest stable)
RUN git clone --depth 1 --branch stable https://github.com/neovim/neovim.git /tmp/neovim && \
    cd /tmp/neovim && \
    make CMAKE_BUILD_TYPE=Release && \
    make install && \
    rm -rf /tmp/neovim

# Switch to devvy user
USER devvy
WORKDIR /home/devvy

# Configure npm to use a custom directory for global packages
RUN mkdir -p ~/.npm-global && \
    npm config set prefix '~/.npm-global'

# Install Node.js tools globally as devvy user
RUN npm install -g typescript @types/node tsx nodemon @anthropic-ai/claude-code

# Install Python packages for Neovim
RUN pip3 install --user --break-system-packages pynvim

# Install oh-my-zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Create directory structure
RUN mkdir -p ~/.ssh ~/.config ~/.claude && \
    chmod 700 ~/.ssh

# Copy the template .zshrc configuration
COPY --chown=devvy:devvy templates/zsh/.zshrc /home/devvy/.zshrc

# Setup SSH for GitHub (will be populated by entrypoint)
RUN touch ~/.ssh/known_hosts && \
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null || true

# Environment variables
# PROJECTS_PATH will be set dynamically from the host's .env file

# Switch back to root for runtime setup
USER root

# Copy scripts
COPY container-scripts/init-firewall.sh /usr/local/bin/init-firewall.sh
COPY container-scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/*.sh

# Expose ports for various services:
# 22            - SSH access to the container
# 60000-60010/udp - UDP ports for development tools or custom services (e.g., debugging, tunnels)
# 3000-3010     - Common range for web app development servers (e.g., Node.js, React, etc.)
EXPOSE 22 60000-60010/udp 3000-3010

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]