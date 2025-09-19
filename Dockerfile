# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

# Core system utilities (rarely change)
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    sudo \
    locales \
    && rm -rf /var/lib/apt/lists/*

# Version control and essential dev tools (rarely change)
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Network and SSH tools (rarely change)
RUN apt-get update && apt-get install -y \
    openssh-server \
    mosh \
    iptables \
    ipset \
    libcap2-bin \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

# Python ecosystem (occasionally change)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Shell and terminal tools (occasionally change)
RUN apt-get update && apt-get install -y \
    zsh \
    tmux \
    fzf \
    && rm -rf /var/lib/apt/lists/*

# Development utilities (frequently change)
RUN apt-get update && apt-get install -y \
    ripgrep \
    fd-find \
    jq \
    btop \
    imagemagick \
    xclip \
    luarocks \
    libmsgpack-dev \
    && rm -rf /var/lib/apt/lists/*

# Build Neovim from source (latest stable) - do this early for better caching
RUN git clone --depth 1 --branch stable https://github.com/neovim/neovim.git /tmp/neovim && \
    cd /tmp/neovim && \
    make CMAKE_BUILD_TYPE=Release && \
    make install && \
    rm -rf /tmp/neovim

# Database clients (occasionally change)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Playwright browser dependencies (required for Chromium, Firefox, WebKit)
RUN apt-get update && apt-get install -y \
    libnspr4 \
    libnss3 \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    libgstreamer-gl1.0-0 \
    libgtk-4-1 \
    libgraphene-1.0-0 \
    libxslt1.1 \
    libwoff1 \
    libvpx7 \
    libevent-2.1-7 \
    libflite1 \
    libharfbuzz-icu0 \
    libenchant-2-2 \
    libsecret-1-0 \
    libhyphen0 \
    libmanette-0.2-0 \
    libgles2 \
    libx264-164 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# XFCE Desktop and TigerVNC for browser monitoring (browser-use-mcp-server approach)
RUN apt-get update && \
    apt-get install --no-install-recommends -y \
    xfce4 \
    xfce4-terminal \
    dbus-x11 \
    tigervnc-standalone-server \
    tigervnc-tools \
    fonts-freefont-ttf \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-noto-color-emoji && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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
# Always create a group named 'devvy' with the specified GID
RUN groupadd -f -g ${HOST_GID} devvy && \
    useradd -u ${HOST_UID} -g devvy -m -s /bin/zsh devvy

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

# Install LazyGit
RUN LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*') && \
    curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" && \
    tar xf lazygit.tar.gz lazygit && \
    install lazygit /usr/local/bin && \
    rm -f lazygit.tar.gz lazygit

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

# VNC configuration for XFCE desktop
RUN mkdir -p /home/devvy/.vnc && \
    printf '#!/bin/sh\nunset SESSION_MANAGER\nunset DBUS_SESSION_BUS_ADDRESS\nstartxfce4' > /home/devvy/.vnc/xstartup && \
    chmod +x /home/devvy/.vnc/xstartup

# Install oh-my-zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Create directory structure
RUN mkdir -p ~/.ssh ~/.config ~/.claude && \
    chmod 700 ~/.ssh

# Copy the template .zshrc configuration
COPY --chown=${HOST_UID}:${HOST_GID} templates/zsh/.zshrc /home/devvy/.zshrc

# Copy the template tmux configuration
COPY --chown=${HOST_UID}:${HOST_GID} templates/tmux/tmux.conf /home/devvy/.tmux.conf

# Install TPM (Tmux Plugin Manager) for the devvy user
RUN git clone https://github.com/tmux-plugins/tpm /home/devvy/.tmux/plugins/tpm

# Setup SSH for GitHub (will be populated by entrypoint)
RUN touch ~/.ssh/known_hosts && \
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null || true

# Environment variables
# PROJECTS_PATH will be set dynamically from the host's .env file
# Display configuration for VNC
ENV DISPLAY=:0

# Switch back to root for runtime setup
USER root

# Copy scripts
COPY container-scripts/init-firewall.sh /usr/local/bin/init-firewall.sh
COPY container-scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY container-scripts/devvy-motd.sh /usr/local/bin/devvy-motd.sh
RUN chmod +x /usr/local/bin/*.sh

# Disable default MOTD and setup custom welcome message
RUN rm -f /etc/motd /etc/update-motd.d/* && \
    echo "" > /etc/motd && \
    touch /home/devvy/.hushlogin && \
    chown ${HOST_UID}:${HOST_GID} /home/devvy/.hushlogin

# Expose ports for various services:
# 22            - SSH access to the container
# 60000-60010/udp - UDP ports for development tools or custom services (e.g., debugging, tunnels)
# 3000-3010     - Common range for web app development servers (e.g., Node.js, React, Vue, etc.)
# 443           - HTTPS/TLS connections
# 8443          - Alternative HTTPS port for development
# 8080-8090     - WebSocket connections and alternative HTTP servers
# 4200          - Angular dev server
# 5000          - Flask/Python web servers
# 5173          - Vite dev server
# 5432          - PostgreSQL database
# 6379          - Redis cache/database
# 8000          - Django/Python alternate server
# 9000          - PHP-FPM
# 9229          - Node.js debugger
# 27017         - MongoDB database
# 3306          - MySQL/MariaDB database
# 5900          - VNC server for browser monitoring
EXPOSE 22 60000-60010/udp 3000-3010 443 8443 8080-8090 4200 5000 5173 5432 6379 8000 9000 9229 27017 3306 5900

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]