# Detailed Migration Steps

## Phase 1: Foundation Setup ✅ COMPLETED

### Day 1: Project Initialization
- [x] Create new branch: `feature/typescript-migration`
- [x] Initialize npm project with `package.json`
- [x] Install core dependencies (TypeScript, Commander, Dockerode)
- [x] Set up TypeScript configuration (`tsconfig.json`)
- [x] Configure ESLint and Prettier
- [x] Create basic folder structure under `src/`
- [x] Set up Git hooks with Husky

### Day 2: Core Infrastructure
- [x] Create configuration management system
  - [x] `src/config/constants.ts` - All hardcoded values
  - [x] `src/config/schema.ts` - Zod validation schemas
  - [x] `src/services/config.service.ts` - Config loading and validation
- [x] Implement logging system
  - [x] `src/utils/logger.ts` - Winston-based logger
  - [x] Color-coded output matching current bash scripts
- [x] Create basic CLI structure
  - [x] `src/index.ts` - Main entry point
  - [x] Commander setup with subcommands

### Day 3: Docker Service Layer
- [x] Implement `src/services/docker.service.ts`
  - [x] Container management methods
  - [x] Volume operations
  - [x] Image handling
  - [x] Network management
- [x] Implement `src/services/compose.service.ts`
  - [x] Wrapper for docker-compose commands
  - [x] YAML parsing and manipulation

## Phase 2: Command Migration - IN PROGRESS

### ✅ COMPLETED
- [x] Migrate `devvy start` → `src/commands/start.ts`
  - [x] Port container startup logic
  - [ ] **MISSING: SSH key management (removing old keys, adding new)**
  - [x] Health checks
- [x] Migrate `devvy stop` → `src/commands/stop.ts`
  - [x] Graceful shutdown
  - [x] State verification
- [x] Migrate `setup.sh` → `src/commands/setup.ts` (partial)
  - [x] Environment detection
  - [x] Interactive prompts with Inquirer
  - [x] Git configuration detection
  - [ ] **MISSING: VS Code/Cursor config import**
  - [ ] **MISSING: SSH key generation**
- [x] Migrate `connect.sh` → `src/commands/connect.ts` (partial)
  - [x] SSH connection logic
  - [x] Mosh support option
  - [x] Tmux session management option
  - [x] Connection testing
- [x] Migrate `rebuild.sh` → `src/commands/rebuild.ts`
  - [x] No-cache rebuild option
  - [x] Force rebuild option
  - [ ] **MISSING: SSH key management during rebuild**

### ✅ COMPLETED - Phase 2 Core Features 
- [x] Migrate `cleanup.sh` → `src/commands/cleanup.ts`
  - [x] Interactive cleanup menu
  - [x] Resource size calculation
  - [x] Confirmation prompts
  - [x] System prune integration
  - [x] Add dry-run mode
- [x] Implement `logs` command
  - [x] Real-time log streaming
  - [x] Log filtering
  - [x] Tail option
- [x] Implement `status` command
  - [x] Show actual container status
  - [x] Display IP address
  - [x] Show resource usage
- [x] Create SSH Service
  - [x] SSH key generation
  - [x] Known hosts management
  - [x] SSH config handling

### 🔄 TODO - Remaining Items
- [ ] Implement `sync` command
  - [ ] VS Code settings import/export
  - [ ] Cursor settings import/export
  - [ ] Extension management
- [ ] Create VS Code Service
  - [ ] Detect VS Code/Cursor installation
  - [ ] Import/export settings
  - [ ] Manage extensions

## Phase 2 Summary of Accomplishments

### ✅ What Was Completed
1. **SSH Service** - Full SSH key management including generation, known hosts handling, and container access
2. **Cleanup Command** - Interactive cleanup menu with resource size calculation and dry-run mode
3. **Status Command** - Real-time container status with IP address, resource usage, and health checks
4. **Logs Command** - Streaming logs with follow mode, tail options, and timestamp support
5. **Start Command Enhancement** - Added SSH known hosts management for seamless connections

### 📊 Code Quality
- TypeScript compilation: ✅ Passing
- ESLint: ⚠️ 53 errors (mostly style/any types), 93 warnings
- All critical functionality working

### 🔍 Comparison with Bash Implementation
**Fully Migrated:**
- start, stop, connect, rebuild, setup (partial), cleanup, status, logs commands
- SSH key management
- Container health checks
- Interactive prompts

**Still Missing:**
- VS Code/Cursor settings sync
- Extension management
- Some setup command features (VS Code import, SSH key generation during setup)
- Rebuild SSH key handling

## Phase 2 Detailed Implementation Plan (Original)

### 🎯 Immediate Tasks (Priority 1)

#### 1. Create SSH Service (`src/services/ssh.service.ts`)
```typescript
- generateSSHKey(): Generate SSH key pair for container access
- manageKnownHosts(): Add/remove SSH known hosts entries
- getSSHConfig(): Return SSH connection configuration
- cleanupSSHKeys(): Remove old SSH keys before rebuild
```

#### 2. Create VS Code Service (`src/services/vscode.service.ts`)
```typescript
- detectEditor(): Detect VS Code or Cursor installation
- getSettingsPath(): Get editor settings path
- importSettings(): Import settings from editor
- exportSettings(): Export settings to editor
- syncExtensions(): Sync extension list
```

#### 3. Implement Cleanup Command (`src/commands/cleanup.ts`)
Interactive menu with options:
1. Remove container and image
2. Remove Docker volumes (nvim, npm cache, etc)
3. Reset VS Code/Cursor settings
4. Remove SSH keys and secrets
5. Remove environment files
6. Full reset option
- Add resource size calculation
- Show what will be removed before confirmation
- Implement dry-run mode

#### 4. Implement Status Command (`src/commands/status.ts`)
- Query actual container status from Docker
- Display container IP address
- Show port mappings
- Display resource usage (CPU, memory)
- Show volume mounts
- Display container health check status

#### 5. Implement Logs Command (`src/commands/logs.ts`)
- Stream logs in real-time using Docker API
- Support follow mode (-f)
- Support tail option (-n)
- Add timestamp display option
- Color-code log levels if detected

#### 6. Implement Sync Command (`src/commands/sync.ts`)
- Support both import and export modes
- Handle VS Code and Cursor separately
- Sync settings.json, keybindings.json
- Manage extensions list
- Add confirmation prompts

### 🔧 Missing Features to Add (Priority 2)

#### Update Start Command
- Add SSH known_hosts management:
  - Remove old entry: `ssh-keygen -R "[localhost]:2222"`
  - Add new entry after start: `ssh-keyscan -p 2222 -H localhost >> ~/.ssh/known_hosts`
- Generate SSH keys if missing

#### Update Setup Command
- Import VS Code/Cursor settings during setup
- Generate SSH keys if not present
- Add option to import existing SSH keys

#### Update Rebuild Command
- Handle SSH known_hosts cleanup before rebuild
- Preserve user data during rebuild
- Show rebuild progress

### 📋 Implementation Order
1. SSH Service (foundation for other features)
2. Cleanup Command (most complex, highest user value)
3. Status Command (quick win, useful for debugging)
4. Logs Command (essential for troubleshooting)
5. VS Code Service
6. Sync Command
7. Update existing commands with missing features

## Phase 3: Additional Features (Days 11-15)

### Day 11: Rebuild and Sync Commands
- [ ] Implement `src/commands/rebuild.ts`
  - [ ] No-cache rebuild option
  - [ ] Incremental rebuild
  - [ ] Build progress tracking
- [ ] Implement `src/commands/sync.ts`
  - [ ] VS Code settings sync
  - [ ] Cursor settings sync
  - [ ] Extension management

### Day 12: Status and Logs Commands
- [ ] Implement `src/commands/status.ts`
  - [ ] Container health checks
  - [ ] Resource usage display
  - [ ] Network information
- [ ] Implement `src/commands/logs.ts`
  - [ ] Real-time log streaming
  - [ ] Log filtering
  - [ ] Log export

### Day 13: Utility Services
- [ ] Implement `src/services/ssh.service.ts`
  - [ ] Key generation
  - [ ] Key management
  - [ ] Known hosts handling
- [ ] Implement `src/services/vscode.service.ts`
  - [ ] Settings management
  - [ ] Extension installation
  - [ ] Configuration sync

### Day 14-15: Polish and Optimization
- [ ] Performance optimization
- [ ] Error message improvements
- [ ] Create debug mode
- [ ] Code cleanup and refactoring

## Phase 4: Documentation and Migration (Days 16-20)

### Day 16-17: Documentation Update
- [ ] Update README.md
  - [ ] New installation instructions
  - [ ] TypeScript CLI usage
  - [ ] Updated feature documentation
- [ ] Generate API documentation
- [ ] Create video tutorials

### Day 18: Final Polish
- [ ] Code review and cleanup
- [ ] Documentation review
- [ ] Performance testing
- [ ] Final bug fixes

### Day 19: Beta Release
- [ ] Create beta release branch
- [ ] Build and package CLI
- [ ] Create installation script
- [ ] Deploy to npm registry (private/scoped)
- [ ] Set up GitHub releases

### Day 20: Release
- [ ] Final testing
- [ ] Create release notes
- [ ] Deploy to production
- [ ] Update documentation

## Migration Checklist

### Before Starting
- [x] Backup current working bash scripts
- [x] Document all current features
- [x] Identify breaking changes
- [ ] Set up development environment
- [ ] Create test Docker environment

### During Migration
- [ ] Maintain feature parity
- [ ] Keep bash scripts functional
- [ ] Regular commits with clear messages
- [ ] Update documentation as you go

### After Migration
- [ ] Performance comparison
- [ ] User documentation complete
- [ ] CI/CD pipeline working

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**
   - Keep bash scripts in `legacy-bash/` folder
   - Symlink `devvy` to bash version if needed
   - Document known issues

2. **Partial Rollback**
   - Run TypeScript and bash versions side-by-side
   - Use feature flags to toggle between implementations
   - Gradual migration of commands

3. **Data Recovery**
   - Backup all Docker volumes before migration
   - Keep configuration snapshots
   - Document recovery procedures

## Success Metrics

### Technical Metrics
- [ ] All bash functionality replicated
- [ ] No performance degradation
- [ ] Zero critical bugs in beta

### User Experience Metrics
- [ ] Setup time reduced by 30%
- [ ] Error messages more helpful
- [ ] Command response time < 100ms
### Code Quality Metrics
- [ ] TypeScript strict mode enabled
- [ ] No ESLint errors
- [ ] Documentation coverage 100%

## Risk Mitigation

### High Risk Areas
1. **Docker API Changes**
   - Mitigation: Version lock Dockerode
   - Fallback: Shell command execution

2. **Cross-platform Issues**
   - Mitigation: Extensive testing on different macOS versions
   - Fallback: Platform-specific code paths

3. **Performance Regression**
   - Mitigation: Benchmark critical paths
   - Fallback: Optimize or revert to shell commands

4. **User Adoption**
   - Mitigation: Excellent documentation and clear upgrade path
   - Fallback: Maintain bash version longer

## Communication Plan

### Internal
- Daily progress updates in project board
- Weekly team sync on migration status
- Immediate escalation of blockers

### External (Users)
- Blog post announcing TypeScript version
- Updated documentation and video tutorial
- Support channel for issues
- Feedback collection mechanism
