#!/bin/bash

# Colors for terminal output
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
RESET='\033[0m'
BOLD='\033[1m'

# Clear screen for clean presentation
clear

# ASCII Art Banner
cat << "EOF"

    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║     ██████╗ ███████╗██╗   ██╗██╗   ██╗██╗   ██╗             ║
    ║     ██╔══██╗██╔════╝██║   ██║██║   ██║╚██╗ ██╔╝             ║
    ║     ██║  ██║█████╗  ██║   ██║██║   ██║ ╚████╔╝              ║
    ║     ██║  ██║██╔══╝  ╚██╗ ██╔╝╚██╗ ██╔╝  ╚██╔╝               ║
    ║     ██████╔╝███████╗ ╚████╔╝  ╚████╔╝    ██║                ║
    ║     ╚═════╝ ╚══════╝  ╚═══╝    ╚═══╝     ╚═╝                ║
    ║                                                               ║
    ║           🚀 Development Environment Container 🚀             ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝

EOF

echo ""
echo -e "${CYAN}${BOLD}Welcome to your Devvy container!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# System Info
echo -e "${YELLOW}📊 System Information:${RESET}"
echo -e "   ${BLUE}•${RESET} Hostname: $(hostname)"
echo -e "   ${BLUE}•${RESET} Kernel: $(uname -r)"
echo -e "   ${BLUE}•${RESET} Architecture: $(uname -m)"
echo -e "   ${BLUE}•${RESET} User: $(whoami)"
echo -e "   ${BLUE}•${RESET} Date: $(date '+%A, %B %d, %Y - %H:%M:%S %Z')"
echo ""

# Development Tools
echo -e "${YELLOW}🛠️  Available Tools:${RESET}"
echo -e "   ${BLUE}•${RESET} Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
echo -e "   ${BLUE}•${RESET} npm: $(npm --version 2>/dev/null || echo 'Not installed')"
echo -e "   ${BLUE}•${RESET} Git: $(git --version 2>/dev/null | cut -d' ' -f3 || echo 'Not installed')"
echo -e "   ${BLUE}•${RESET} Neovim: $(nvim --version 2>/dev/null | head -1 | cut -d' ' -f2 || echo 'Not installed')"
echo -e "   ${BLUE}•${RESET} Python: $(python3 --version 2>/dev/null | cut -d' ' -f2 || echo 'Not installed')"
echo -e "   ${BLUE}•${RESET} GitHub CLI: $(gh --version 2>/dev/null | head -1 | cut -d' ' -f3 || echo 'Not installed')"
echo ""

# Quick Commands
echo -e "${YELLOW}⚡ Quick Commands:${RESET}"
echo -e "   ${MAGENTA}btop${RESET}              - System resource monitor"
echo -e "   ${MAGENTA}tmux${RESET}              - Start terminal multiplexer"
echo -e "   ${MAGENTA}nvim${RESET}              - Launch Neovim editor"
echo -e "   ${MAGENTA}cd ~/repos${RESET}        - Go to projects directory"
echo -e "   ${MAGENTA}gh auth status${RESET}    - Check GitHub authentication"
echo ""

# Projects Directory Status
if [ -d "$HOME/repos" ]; then
    PROJECT_COUNT=$(find "$HOME/repos" -maxdepth 1 -type d | wc -l)
    echo -e "${YELLOW}📁 Projects:${RESET}"
    echo -e "   ${BLUE}•${RESET} Location: ~/repos"
    echo -e "   ${BLUE}•${RESET} Total projects: $((PROJECT_COUNT - 1))"
    echo ""
fi

# Git Configuration Status
GIT_NAME=$(git config --global user.name 2>/dev/null)
GIT_EMAIL=$(git config --global user.email 2>/dev/null)
if [ -n "$GIT_NAME" ] && [ -n "$GIT_EMAIL" ]; then
    echo -e "${YELLOW}🔧 Git Configuration:${RESET}"
    echo -e "   ${BLUE}•${RESET} Name: $GIT_NAME"
    echo -e "   ${BLUE}•${RESET} Email: $GIT_EMAIL"
    echo ""
fi

# SSH Key Status
if [ -f "$HOME/.ssh/github_rsa" ]; then
    echo -e "${GREEN}✅ GitHub SSH key configured${RESET}"
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}Happy coding! 💻✨${RESET}"
echo ""