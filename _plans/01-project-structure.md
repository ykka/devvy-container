# Project Structure Plan

## New TypeScript Project Structure

```
claude-docker/
├── src/                          # TypeScript source code
│   ├── index.ts                 # Main CLI entry point (replaces devvy)
│   ├── commands/                # Command implementations
│   │   ├── start.ts            # Start container command
│   │   ├── stop.ts             # Stop container command
│   │   ├── connect.ts          # Connect to container
│   │   ├── cleanup.ts          # Cleanup resources
│   │   ├── setup.ts            # Initial setup
│   │   ├── rebuild.ts          # Rebuild container
│   │   ├── sync.ts             # Sync VS Code/Cursor settings
│   │   ├── status.ts           # Show container status
│   │   └── logs.ts             # Show container logs
│   │
│   ├── services/                # Business logic services
│   │   ├── docker.service.ts   # Docker API interactions
│   │   ├── compose.service.ts  # Docker Compose operations
│   │   ├── ssh.service.ts      # SSH key management
│   │   ├── git.service.ts      # Git configuration
│   │   ├── vscode.service.ts   # VS Code/Cursor settings
│   │   ├── config.service.ts   # Configuration management
│   │   └── env.service.ts      # Environment variable handling
│   │
│   ├── utils/                   # Utility functions
│   │   ├── logger.ts           # Logging with colors and formatting
│   │   ├── spinner.ts          # Progress indicators
│   │   ├── prompt.ts           # User input prompts
│   │   ├── fs.ts               # File system operations
│   │   ├── shell.ts            # Shell command execution
│   │   ├── platform.ts         # OS-specific operations
│   │   └── validation.ts       # Input validation
│   │
│   ├── types/                   # TypeScript type definitions
│   │   ├── config.ts           # Configuration types
│   │   ├── docker.ts           # Docker-related types
│   │   ├── commands.ts         # Command option types
│   │   └── index.ts            # Re-export all types
│   │
│   └── config/                  # Configuration files
│       ├── constants.ts        # Application constants
│       ├── defaults.ts         # Default values
│       └── schema.ts           # Configuration schema validation
│
├── container-scripts/            # Scripts that run INSIDE container (stay as bash)
│   ├── docker-entrypoint.sh    # Container initialization (stays bash)
│   └── init-firewall.sh        # Firewall setup (stays bash)
│
├── legacy-bash/                  # Temporary: Original bash scripts during migration
│   ├── setup.sh                # Will be removed after migration
│   ├── cleanup.sh              # Will be removed after migration
│   └── ...                     # Other bash scripts
│
│
├── dist/                         # Compiled JavaScript (git-ignored)
│   └── ...
│
├── docs/                         # Documentation
│   ├── development.md          # Development setup
│   ├── api.md                  # API documentation
│   └── architecture.md         # Architecture decisions
│
├── scripts/                      # Build and development scripts
│   ├── build.ts                # Build script
│   └── watch.ts                # Development watch mode
│
├── .github/                      # GitHub specific files
│   └── workflows/
│       ├── ci.yml              # Continuous Integration
│       └── release.yml         # Release automation
│
├── devvy                         # Main executable (compiled from TypeScript)
├── devvy.ts                     # TypeScript source for devvy executable
├── package.json                 # Node.js dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── .eslintrc.json              # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── .nvmrc                      # Node version specification
├── docker-compose.yml          # Docker Compose configuration (unchanged)
├── Dockerfile                  # Container definition (unchanged)
└── README.md                   # Updated documentation

```

## Files That Stay as Bash Scripts

### Container Scripts (Run Inside Container)
- `container-scripts/docker-entrypoint.sh` - Must be bash for container initialization
- `container-scripts/init-firewall.sh` - Low-level system operations

### Why These Stay as Bash
1. They run inside the container at startup
2. Need to be lightweight (no Node.js dependency)
3. Perform system-level operations
4. Already working well and rarely change

## Migration Strategy for Each File

### High Priority (Core Functionality)
1. `devvy` → `src/index.ts` + `src/commands/*.ts`
2. `setup-scripts/setup.sh` → `src/commands/setup.ts`
3. `setup-scripts/cleanup.sh` → `src/commands/cleanup.ts`
4. `setup-scripts/connect.sh` → `src/commands/connect.ts`

### Medium Priority (Supporting Features)
1. `setup-scripts/rebuild.sh` → `src/commands/rebuild.ts`
2. `setup-scripts/install-vscode-extensions.sh` → `src/services/vscode.service.ts`

### Low Priority (May Not Migrate)
1. Simple one-liner scripts might remain as bash
2. Scripts only used during development

## Build Output Structure

The TypeScript compilation will produce:
- `devvy` - Executable Node.js script with shebang
- `dist/` - Compiled JavaScript files (git-ignored)
- Source maps for debugging

## Configuration Files Location

- Runtime configs stay in project root (docker-compose.yml, Dockerfile)
- VS Code configs stay in `vscode-config/`
- User secrets stay in `secrets/` (git-ignored)
- Environment files stay in root (.env, .env.local)
