#!/bin/bash

# Stop VNC server and related processes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping VNC server and virtual display...${NC}"

# Stop x11vnc
if pgrep -x "x11vnc" > /dev/null; then
    echo "Stopping VNC server..."
    pkill -x x11vnc
    echo -e "${GREEN}✓ VNC server stopped${NC}"
else
    echo "VNC server is not running"
fi

# Stop fluxbox
if pgrep -x "fluxbox" > /dev/null; then
    echo "Stopping Fluxbox window manager..."
    pkill -x fluxbox
    echo -e "${GREEN}✓ Fluxbox stopped${NC}"
else
    echo "Fluxbox is not running"
fi

# Stop Xvfb
if pgrep -x "Xvfb" > /dev/null; then
    echo "Stopping Xvfb virtual display..."
    pkill -x Xvfb
    echo -e "${GREEN}✓ Xvfb stopped${NC}"
else
    echo "Xvfb is not running"
fi

echo -e "${GREEN}All VNC-related processes have been stopped${NC}"