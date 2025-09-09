# VS Code/Cursor Integration Fix Plan

## Implementation Status: ✅ COMPLETED

## Overview
Fix VS Code and Cursor to properly connect to the devvy container as the `devvy` user (not root) by dynamically creating attached container configurations with extensions from `vscode-config/extensions.txt`.

## Core Concept
- **Template**: Use `templates/devcontainer/claude-devvy-container-devcontainer.json` as base
- **Extensions**: Dynamically inject from `vscode-config/extensions.txt` (imported during sync)
- **Timing**: Create configs only when `devvy cursor` or `devvy vscode` is run
- **Location**: Copy to correct Application Support directories with clear user notification

## Detailed Implementation Plan

### Phase 1: Update VS Code Service (`src/services/vscode.ts`)

#### 1. Fix `getAttachedContainerConfigPath`
- For Cursor on macOS: `~/Library/Application Support/Cursor/User/globalStorage/anysphere.remote-containers/imageConfigs/claude-devvy-container-devcontainer.json`
- For VS Code on macOS: `~/Library/Application Support/Code/User/globalStorage/ms-vscode-remote.remote-containers/imageConfigs/claude-devvy-container-devcontainer.json`
- Include proper platform detection for future Linux/Windows support

#### 2. Add `prepareAttachedContainerConfig` function
- Read template from `templates/devcontainer/claude-devvy-container-devcontainer.json`
- Read extensions from `vscode-config/extensions.txt`
- Parse template JSON
- Replace `customizations.vscode.extensions` array with extensions from txt file
- Return modified JSON object

#### 3. Update `createAttachedContainerConfig`
- Check if destination directory exists, create if missing
- Call `prepareAttachedContainerConfig` to get config with extensions
- Write to destination
- Return status with exact path written

### Phase 2: Update VS Code Commands (`src/commands/vscode.ts`)

#### 1. Update `cursorCommand`
- Check if container is running
- Inform user: "Configuring Cursor to connect as 'devvy' user..."
- Check if vscode-config/extensions.txt exists
- If missing, warn user to run 'devvy sync' first
- Call service to prepare and write config
- Show exact path: "Creating configuration at: [full path]"
- Launch Cursor with URI

#### 2. Update `vscodeCommand`
- Same flow as cursorCommand but for VS Code
- Show exact path where config is created

#### 3. Add verbose output
- "✓ Created devcontainer configuration at: [path]"
- "✓ Included X extensions from vscode-config/extensions.txt"
- "✓ Configured to connect as user: devvy"
- "✓ Workspace folder: /home/devvy"

### Phase 3: Clean Up Container Scripts

#### Update `container-scripts/docker-entrypoint.sh`
- Remove entire VS Code extension installation section (lines 123-178)
- Remove `.vscode-server-install-extensions.sh` creation
- Remove modification of `.zshrc` for extension installation
- Keep only directory creation for `.vscode-server` and `.cursor-server`

### Phase 4: Setup Command Updates (`src/commands/setup.ts`)

#### No automatic devcontainer creation
- Do NOT create devcontainer configs during setup
- Only inform user about VS Code/Cursor commands availability
- Add message: "Use 'devvy cursor' or 'devvy vscode' to connect with your editor"

### Phase 5: Rebuild Command Updates (`src/commands/rebuild.ts`)

#### No devcontainer handling
- Do NOT preserve or recreate devcontainer configs
- Configs will be created on-demand when user runs editor commands

### Phase 6: Sync Command Clarification (`src/commands/sync.ts`)

#### Keep existing functionality
- Still imports settings.json, keybindings.json, extensions.txt, snippets
- These are used by the devcontainer config when created

#### Update messages
- "Extensions list will be used when connecting to container"
- "Run 'devvy cursor' or 'devvy vscode' to connect with these settings"

## User Experience Flow

### 1. Initial Setup
```bash
$ devvy setup
[No devcontainer configs created]
```

### 2. Sync Extensions (if needed)
```bash
$ devvy sync
✓ Imported Cursor settings to vscode-config/
✓ Extensions list saved (36 extensions)
```

### 3. Launch Editor
```bash
$ devvy cursor
Configuring Cursor to connect as 'devvy' user...
✓ Creating configuration at: /Users/username/Library/Application Support/Cursor/User/globalStorage/anysphere.remote-containers/imageConfigs/claude-devvy-container-devcontainer.json
✓ Included 36 extensions from vscode-config/extensions.txt
✓ Configured to connect as user: devvy
✓ Workspace folder: /home/devvy
Launching Cursor and attaching to container...
```

## Key Benefits

1. **Dynamic Extension Management**: Always uses current extensions.txt
2. **On-Demand Creation**: No stale configs, always fresh
3. **Clear Communication**: User knows exactly what's happening and where
4. **No Redundancy**: VS Code handles extension installation via devcontainer.json
5. **Flexibility**: Easy to update extensions - just modify extensions.txt and relaunch

## Error Handling

### Missing extensions.txt
- Warn user to run `devvy sync` first
- Still create config but with empty extensions array

### Directory doesn't exist
- Create all necessary parent directories
- Show what was created

### Config already exists
- Overwrite silently (it's regenerated each time)
- Or add --no-overwrite flag if user wants to preserve custom changes

## Testing Points

1. Fresh system - directories don't exist
2. After sync - extensions.txt exists
3. Without sync - extensions.txt missing
4. Multiple launches - config gets updated
5. Both Cursor and VS Code commands

## Files to Modify

1. **src/services/vscode.ts**
   - Fix `getAttachedContainerConfigPath` (correct paths and filename)
   - Add `prepareAttachedContainerConfig` function
   - Update `createAttachedContainerConfig` to use template

2. **src/commands/vscode.ts**
   - Add verbose output showing paths
   - Check for extensions.txt existence
   - Better error handling

3. **container-scripts/docker-entrypoint.sh**
   - Remove VS Code extension installation (lines 123-178)
   - Keep directory creation only

4. **src/commands/setup.ts**
   - Remove automatic devcontainer config creation
   - Add informational message about editor commands

5. **src/commands/rebuild.ts**
   - Remove devcontainer config preservation logic

6. **src/commands/sync.ts**
   - Update messages to clarify extension usage

## Implementation Order

1. ✅ First: Update vscode.ts service with correct paths
2. ✅ Second: Update commands with verbose output
3. ✅ Third: Clean up container scripts
4. ✅ Fourth: Update setup/rebuild commands
5. ✅ Fifth: Test thoroughly (quality checks passed)
6. ⏳ Sixth: Update documentation (pending)

## What Was Implemented

### 1. VS Code Service (`src/services/vscode.ts`)
- ✅ Fixed `getAttachedContainerConfigPath` to use correct filename and extension ID
  - Cursor uses `anysphere.remote-containers`
  - VS Code uses `ms-vscode-remote.remote-containers`
  - Both use filename `claude-devvy-container-devcontainer.json`
- ✅ Added `prepareAttachedContainerConfig` function to load template and inject extensions
- ✅ Updated `createAttachedContainerConfig` to return path and extension count
- ✅ Added `customizations` field to `AttachedContainerConfig` interface

### 2. VS Code Commands (`src/commands/vscode.ts`)
- ✅ Added check for `extensions.txt` existence with warning if missing
- ✅ Added verbose output showing:
  - Exact path where config is created
  - Number of extensions included
  - User and workspace folder configuration
- ✅ Removed redundant configuration code

### 3. Container Scripts (`container-scripts/docker-entrypoint.sh`)
- ✅ Removed entire VS Code extension installation section (lines 123-178)
- ✅ Kept only directory creation for `.vscode-server` and `.cursor-server`

### 4. Setup Command (`src/commands/setup.ts`)
- ✅ No automatic devcontainer creation (already clean)
- ✅ Added informational messages about `devvy cursor` and `devvy vscode` commands

### 5. Rebuild Command (`src/commands/rebuild.ts`)
- ✅ No devcontainer handling needed (already clean)

### 6. Sync Command (`src/commands/sync.ts`)
- ✅ Updated messages to clarify extension usage
- ✅ Added note about running `devvy cursor` or `devvy vscode` after sync

## Testing Status
- ✅ TypeScript compilation successful
- ✅ Biome linting passed
- ✅ Code formatting applied and verified

## Next Steps for Users
1. Run `devvy sync` to import extensions from local editor
2. Run `devvy cursor` or `devvy vscode` to connect with dynamic config
3. Extensions will be automatically installed by VS Code/Cursor from the devcontainer.json