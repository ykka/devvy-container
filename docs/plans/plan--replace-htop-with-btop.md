# Implementation Plan: Replace htop with btop in Devvy Container

## Executive Summary

This plan outlines the implementation for Linear issue YKK-268, which involves replacing htop with btop in the devvy container. After thorough analysis, btop is already installed in the container (line 48 of Dockerfile), and htop was never installed or referenced in the codebase. The implementation focuses on promoting btop's availability through the container's MOTD script to improve discoverability and user experience.

## Clarification Questions

Before implementation, the following questions should be considered:

#### 1. Should we add any btop configuration files to customize its appearance?
   a. Keep btop with default settings (simpler, users can customize themselves)
   b. Add a pre-configured `.config/btop/btop.conf` with optimized settings for containers

#### 2. Should we document btop's keyboard shortcuts in the MOTD or elsewhere?
   a. Keep the MOTD concise with just the command mention
   b. Add a help tip like "btop (press 'h' for help)" in the Quick Commands

#### 3. Should we add btop to the README.md documentation?
   a. Yes, create or update a "Available Tools" section
   b. No, keep README focused on setup and usage only

#### 4. Should we create an alias for btop (like 'top' -> 'btop')?
   a. No, keep commands explicit to avoid confusion
   b. Yes, add alias in .zshrc template for convenience

## Current State Analysis

### What We Found
1. **btop is already installed**: The Dockerfile includes btop in the development utilities layer (line 48)
2. **htop is not installed**: No references to htop exist anywhere in the codebase
3. **No system monitoring promoted**: The MOTD script doesn't mention any system monitoring tool
4. **Container uses modern stack**: zsh, tmux, and other tools that fully support btop's requirements

### Key Files Involved
- `/Dockerfile` - Already has btop installed (no changes needed)
- `/container-scripts/devvy-motd.sh` - Welcome message shown when connecting (needs update)
- `/templates/zsh/.zshrc` - Zsh configuration (optional alias addition)
- `/README.md` - Main documentation (optional update)

## Technical Architecture

### Component Diagram
```
┌─────────────────────────────────────┐
│         Docker Container            │
├─────────────────────────────────────┤
│  System Tools Layer                 │
│  ├── btop (already installed)       │
│  ├── ripgrep                        │
│  ├── fzf                           │
│  └── other dev utilities           │
├─────────────────────────────────────┤
│  User Interface Layer               │
│  ├── MOTD Script (needs update)     │
│  ├── Zsh Configuration             │
│  └── Tmux Configuration            │
└─────────────────────────────────────┘
```

### btop Container Resource Monitoring
- Correctly reads cgroup v2 limits
- Shows container-specific CPU/memory limits
- Network statistics work within container namespace
- Process tree shows only container processes

## Implementation Phases

### Phase 1: Update Container MOTD Script (Required)

**File**: `container-scripts/devvy-motd.sh`

**Changes**:
1. Add btop to the Quick Commands section (after line 60)

```bash
# Updated Quick Commands section (lines 57-63)
echo -e "${YELLOW}⚡ Quick Commands:${RESET}"
echo -e "   ${MAGENTA}tmux${RESET}              - Start terminal multiplexer"
echo -e "   ${MAGENTA}nvim${RESET}              - Launch Neovim editor"
echo -e "   ${MAGENTA}btop${RESET}              - Monitor system resources (CPU, RAM, processes)"
echo -e "   ${MAGENTA}cd ~/repos${RESET}        - Go to projects directory"
echo -e "   ${MAGENTA}gh auth status${RESET}    - Check GitHub authentication"
echo ""
```

### Phase 2: Add Convenient Alias (Optional - Recommended)

**File**: `templates/zsh/.zshrc`

**Addition** (add to aliases section if it exists, or create one):
```bash
# System monitoring
alias top='btop'  # Use modern btop instead of traditional top
```

### Phase 3: Update Documentation (Optional - Recommended)

**File**: `README.md`

**Addition** after the features section:
```markdown
## Available Development Tools

The container includes modern development tools pre-installed:

### System Monitoring
- **btop**: Beautiful and powerful resource monitor with real-time graphs for CPU, memory, network, and disk usage. Much more visual and informative than traditional `top` or `htop`.

### Text Editors & IDEs
- **Neovim**: Modern vim with LazyVim configuration
- **VS Code/Cursor Integration**: Seamless connection from your host IDE

### Terminal & Shell
- **tmux**: Terminal multiplexer for managing multiple sessions
- **zsh**: Modern shell with oh-my-zsh framework
- **fzf**: Fuzzy finder for files and command history

### Development Utilities
- **ripgrep (rg)**: Ultra-fast recursive search
- **fd**: Modern replacement for find
- **GitHub CLI (gh)**: Interact with GitHub from the command line
- **lazygit**: Terminal UI for git commands
```

## Code Examples

### Testing btop Functionality
```bash
# Basic launch
btop

# Key commands within btop:
# q - Quit
# h - Help menu
# m - Switch between CPU modes
# p - Toggle program path
# f - Filter processes
# t - Tree view
# Space - Pause updates
# + / - : Expand/collapse process tree
```

### Verifying Container Resource Limits
```bash
# Check if btop correctly shows container limits
docker exec -it devvy-container btop

# Should display:
# - Container's CPU limit (not host's total CPUs)
# - Container's memory limit (not host's total RAM)
# - Only processes within the container
```

## File Structure

No new files are created. Updates to existing files:
```
claude-devvy-container/
├── container-scripts/
│   └── devvy-motd.sh          # UPDATE: Add btop to Quick Commands
├── templates/
│   └── zsh/
│       └── .zshrc              # OPTIONAL: Add alias top='btop'
└── README.md                   # OPTIONAL: Document btop availability
```

## Testing Strategy

### 1. Unit Testing
Not applicable - no code logic changes.

### 2. Integration Testing
```bash
# Rebuild container to ensure changes are applied
npm run dev rebuild

# Connect and verify MOTD
devvy connect
# Should see btop in Quick Commands list

# Test btop launch
btop
# Verify:
# - UI renders correctly
# - Shows container resources, not host
# - Keyboard shortcuts work
# - Mouse interaction works (if terminal supports it)
```

### 3. User Experience Testing
```bash
# Test discoverability
devvy connect
# User should immediately see btop in Quick Commands

# Test alias (if implemented)
top
# Should launch btop

# Test in different terminals
# - VS Code integrated terminal
# - iTerm2
# - Terminal.app
# - Through SSH
# - Through mosh
```

### 4. Performance Testing
```bash
# Run stress test while monitoring with btop
docker exec -it devvy-container bash -c "
  btop &
  sleep 2
  stress --cpu 2 --timeout 10s
"
# Verify btop shows CPU spike correctly
```

## Validation Requirements

### Required Validations
1. ✅ btop launches without errors
2. ✅ MOTD displays btop in Quick Commands
3. ✅ btop shows container limits, not host limits
4. ✅ All keyboard shortcuts work

### Optional Validations
1. ⚪ Alias works if implemented
2. ⚪ Documentation is clear and helpful
3. ⚪ btop config file loads if provided

## Risk Mitigation

### Risk Matrix
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Terminal incompatibility | Low | Low | Container uses modern terminals |
| Resource confusion | Low | Medium | btop handles cgroups correctly |
| User unfamiliarity | Medium | Low | Built-in help, intuitive UI |
| Breaking existing workflows | None | None | Not replacing anything in use |

### Rollback Plan
If any issues arise:
1. Remove btop from MOTD Quick Commands
2. Remove alias if added
3. No need to uninstall btop as it doesn't interfere

## Deployment Considerations

### Build Process
No changes to build process - btop is already in Dockerfile.

### CI/CD
No impact on CI/CD pipelines.

### Container Size
btop is already installed - no size change.

### Resource Requirements
btop itself uses minimal resources:
- ~20-30MB RAM
- <1% CPU when running
- No persistent storage needed

## Implementation Checklist

### Required Tasks
- [ ] Update `container-scripts/devvy-motd.sh` to add btop to Quick Commands
- [ ] Test btop launches correctly in container
- [ ] Verify MOTD displays updated Quick Commands
- [ ] Confirm btop shows container resources correctly

### Optional Tasks
- [ ] Add `alias top='btop'` to `templates/zsh/.zshrc`
- [ ] Update README.md with Available Tools section
- [ ] Create custom btop.conf if specific settings desired

### Git Workflow
- [ ] Create branch: `patryk/ykk-268-replace-htop-with-btop-in-the-devvy-container`
- [ ] Make changes
- [ ] Test thoroughly
- [ ] Commit with message:
```
feat: promote btop as system monitoring tool in container

- Add btop to Quick Commands in container MOTD
- btop provides superior container resource monitoring with modern UI
- Already installed in container, improving discoverability

Closes: YKK-268
```
- [ ] Create pull request
- [ ] Merge after review

## Benefits of btop over htop

1. **Modern, Intuitive UI**: Clean design with real-time graphs
2. **Better Container Support**: Properly handles cgroup v2 limits
3. **Comprehensive Monitoring**: CPU, memory, network, disk, and processes in one view
4. **Mouse Support**: Full mouse interaction in supported terminals
5. **Customizable Themes**: Multiple color schemes available
6. **Responsive Design**: Adapts to terminal size changes
7. **Detailed Process Info**: More detailed than htop with tree view
8. **Active Development**: Regular updates and improvements

## References

- [btop GitHub Repository](https://github.com/aristocratos/btop)
- [btop Wiki - Configuration](https://github.com/aristocratos/btop/wiki/CONFIG)
- [Docker cgroup v2 Documentation](https://docs.docker.com/config/containers/runmetrics/)
- [Linear Issue YKK-268](https://linear.app/ykka/issue/YKK-268)

## Summary

This implementation replaces the concept of htop with btop by promoting btop's availability in the devvy container. Since btop is already installed and htop was never present, this is primarily a user experience enhancement. The main deliverable is updating the MOTD script to include btop in the Quick Commands section, making this powerful monitoring tool discoverable to users.

The implementation is low-risk with high value - improving developer experience by highlighting a superior tool that's already available. The changes are minimal, focused, and easily reversible if needed.

**Estimated Implementation Time**: 15-30 minutes including testing
**Risk Level**: Very Low
**Value**: High - Immediate improvement to user experience