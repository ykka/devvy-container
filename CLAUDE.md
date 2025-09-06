# Claude Development Environment - TypeScript Migration

## Project Overview
This is a Docker-based development environment CLI that's being migrated from bash scripts to TypeScript for improved maintainability, type safety, and developer experience.

## Key Commands to Run

### Linting and Type Checking
```bash
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript type checking
npm run quality     # Run all quality checks
```

### Building
```bash
npm run build       # Build the TypeScript project
npm run dev         # Run in development mode with hot reload
```

### CLI Usage
```bash
devvy setup         # Initial setup wizard (collects env variables interactively)
devvy start         # Start the development container
devvy connect       # Connect to the container via SSH
devvy rebuild       # Rebuild container (handles SSH known hosts automatically)
devvy stop          # Stop the container
```

## Project Structure
- `src/` - TypeScript source code
  - `commands/` - CLI command implementations
  - `services/` - Business logic services
  - `utils/` - Utility functions
  - `types/` - TypeScript type definitions
  - `config/` - Configuration management
- `container-scripts/` - Bash scripts that run inside the container
- `dist/` - Compiled JavaScript output (git-ignored)
- `legacy-bash/` - Original bash scripts (temporary during migration)

## Migration Status
Currently migrating from bash to TypeScript following the plans in `_plans/` directory.

## Testing
Before committing, always run:
```bash
npm run quality
```

## Important Notes
- The project maintains backward compatibility during migration
- Container scripts remain as bash for lightweight container initialization
- All TypeScript code follows strict mode for maximum type safety

## Environment Variable Handling
The setup command now:
- Interactively collects optional environment variables (GitHub token, Linear API key, database URLs)
- Preserves existing values when re-running setup
- Only prompts for updates when values already exist
- Automatically detects user/group IDs and git configuration

## SSH Known Hosts Management
The rebuild command automatically:
- Retrieves the current SSH host key before rebuilding
- Removes old entries from ~/.ssh/known_hosts
- Notifies user they'll need to verify the new host key on next connection
- Prevents SSH connection errors after container rebuilds