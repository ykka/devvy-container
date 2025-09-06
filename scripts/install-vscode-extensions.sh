#!/bin/bash

# VS Code Extension Installer for Docker Development Container
# This script installs VS Code extensions from the extensions.txt file

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running inside container
if [ ! -f /.dockerenv ]; then
    echo -e "${YELLOW}Warning: This script should be run inside the Docker container${NC}"
    echo "To run it from the host:"
    echo "  docker exec -it claude-dev /home/devvy/scripts/install-vscode-extensions.sh"
    exit 1
fi

# Path to extensions file
EXTENSIONS_FILE="/home/devvy/vscode-config/extensions.txt"

# Check if extensions file exists
if [ ! -f "$EXTENSIONS_FILE" ]; then
    echo -e "${RED}Error: Extensions file not found at $EXTENSIONS_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}Installing VS Code extensions...${NC}"
echo "Reading from: $EXTENSIONS_FILE"
echo

# Counter for statistics
installed=0
failed=0
skipped=0

# Read extensions file line by line
while IFS= read -r extension || [ -n "$extension" ]; do
    # Skip empty lines and comments
    if [[ -z "$extension" || "$extension" =~ ^#.*$ ]]; then
        continue
    fi
    
    # Remove any leading/trailing whitespace
    extension=$(echo "$extension" | xargs)
    
    echo -n "Installing $extension... "
    
    # Check if already installed
    if code --list-extensions 2>/dev/null | grep -qi "^$extension$"; then
        echo -e "${YELLOW}[SKIPPED]${NC} (already installed)"
        ((skipped++))
    else
        # Try to install the extension
        if code --install-extension "$extension" --force 2>/dev/null; then
            echo -e "${GREEN}[OK]${NC}"
            ((installed++))
        else
            echo -e "${RED}[FAILED]${NC}"
            ((failed++))
        fi
    fi
done < "$EXTENSIONS_FILE"

echo
echo "================================"
echo -e "${GREEN}Installation complete!${NC}"
echo "  Installed: $installed"
echo "  Skipped:   $skipped"
echo "  Failed:    $failed"
echo "================================"

# List all installed extensions
echo
echo "Currently installed extensions:"
code --list-extensions 2>/dev/null | sort

# If any failed, exit with error code
if [ $failed -gt 0 ]; then
    echo
    echo -e "${YELLOW}Note: Some extensions failed to install.${NC}"
    echo "This might be because:"
    echo "  - The extension ID has changed"
    echo "  - The extension is no longer available"
    echo "  - Network connectivity issues"
    exit 1
fi

echo
echo -e "${GREEN}All extensions installed successfully!${NC}"
echo "You may need to reload the VS Code window for some extensions to take effect."