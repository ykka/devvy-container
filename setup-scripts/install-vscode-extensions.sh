#!/bin/bash
# Install VS Code extensions from list

EXTENSIONS_FILE="/home/devvy/vscode-config/extensions.txt"

if [ -f "$EXTENSIONS_FILE" ]; then
    echo "Installing VS Code extensions..."
    while IFS= read -r extension || [ -n "$extension" ]; do
        # Skip comments and empty lines
        [[ "$extension" =~ ^#.*$ || -z "$extension" ]] && continue
        
        echo "Installing: $extension"
        code --install-extension "$extension" 2>/dev/null || true
    done < "$EXTENSIONS_FILE"
    echo "Extensions installation complete!"
else
    echo "Extensions file not found: $EXTENSIONS_FILE"
fi