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

# Create devvy user with a temporary UID (will be modified at runtime)
# Using 2000 as it's unlikely to conflict with system users
RUN useradd -u 2000 -m -s /bin/zsh devvy

# Configure SSH for remote access (for mosh/ssh from host)
RUN mkdir /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Install Node.js tools globally (yarn is already included in node:24)
# Note: corepack enable provides pnpm, so we only need to install the other tools
RUN corepack enable && \
    npm install -g typescript @types/node tsx nodemon

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

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Switch to devvy user
USER devvy
WORKDIR /home/devvy

# Install Python packages for Neovim
RUN pip3 install --user --break-system-packages pynvim

# Install oh-my-zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    # Set a nice theme (you can change this to your preference)
    sed -i 's/ZSH_THEME="robbyrussell"/ZSH_THEME="agnoster"/' ~/.zshrc

# Create directory structure
RUN mkdir -p ~/claudespace/worktrees ~/.ssh ~/.config ~/.claude && \
    chmod 700 ~/.ssh

# Setup SSH for GitHub (will be populated by entrypoint)
RUN touch ~/.ssh/known_hosts && \
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null || true

# Environment variables
ENV CLAUDESPACE_PATH=/home/devvy/claudespace
ENV WORKTREES_PATH=/home/devvy/claudespace/worktrees
ENV DEVCONTAINER=true

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
# 5432          - PostgreSQL database
# 27017         - MongoDB database
# 6379          - Redis server
EXPOSE 22 60000-60010/udp 3000-3010 5432 27017 6379

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]