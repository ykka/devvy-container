#!/bin/bash

# Start VNC server with virtual display for browser monitoring
# This allows viewing Chrome/Playwright from the host machine

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting VNC server for browser monitoring...${NC}"

# Check if Xvfb is already running
if pgrep -x "Xvfb" > /dev/null; then
    echo -e "${YELLOW}Xvfb is already running${NC}"
else
    echo "Starting Xvfb on display :99..."
    Xvfb :99 -screen 0 1920x1080x24 &
    sleep 2
fi

# Check if fluxbox is already running
if pgrep -x "fluxbox" > /dev/null; then
    echo -e "${YELLOW}Fluxbox window manager is already running${NC}"
else
    echo "Starting Fluxbox window manager..."
    DISPLAY=:99 fluxbox &
    sleep 1
fi

# Set VNC password if not already set
if [ ! -f /home/devvy/.vnc/passwd ]; then
    echo -e "${YELLOW}Setting VNC password...${NC}"
    mkdir -p /home/devvy/.vnc
    # Set a default password "devvy" (you can change this)
    echo "devvy" | vncpasswd -f > /home/devvy/.vnc/passwd
    chmod 600 /home/devvy/.vnc/passwd
    echo -e "${GREEN}VNC password set to: devvy${NC}"
    echo -e "${YELLOW}You can change it by running: vncpasswd${NC}"
fi

# Start x11vnc
if pgrep -x "x11vnc" > /dev/null; then
    echo -e "${YELLOW}VNC server is already running${NC}"
    echo -e "${GREEN}Connect from your host machine using: vnc://localhost:5900${NC}"
else
    echo "Starting VNC server on port 5900..."
    x11vnc -display :99 -rfbport 5900 -rfbauth /home/devvy/.vnc/passwd -forever -shared -bg

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ VNC server started successfully!${NC}"
        echo ""
        echo -e "${GREEN}To connect from your Mac:${NC}"
        echo -e "  1. Open Finder"
        echo -e "  2. Press Cmd+K (Connect to Server)"
        echo -e "  3. Enter: vnc://localhost:5900"
        echo -e "  4. Password: devvy"
        echo ""
        echo -e "${YELLOW}Or use any VNC client (RealVNC, TigerVNC, etc.)${NC}"
    else
        echo -e "${RED}Failed to start VNC server${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Chrome can now be launched with:${NC}"
echo -e "  DISPLAY=:99 google-chrome --no-sandbox"
echo ""
echo -e "${GREEN}For Playwright MCP, ensure it uses display :99${NC}"