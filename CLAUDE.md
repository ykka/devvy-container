# Devvy - TypeScript Migration

## Terminology
**IMPORTANT**: Throughout the codebase, use these terms consistently:
- **local machine** - The host Mac that runs Docker containers, the machine from which we SSH into the container
- **container** - The Docker container itself (claude-devvy-container)

## Project Overview
This is a Docker-based development environment CLI that's being migrated from bash scripts to TypeScript for improved maintainability, type safety, and developer experience.

## Key Commands to Run

### Linting and Type Checking
```bash
npm run lint        # Run Biome linter
npm run format      # Format code with Biome
npm run typecheck   # Run TypeScript type checking
npm run quality     # Run all quality checks (lint + typecheck)
```

### Building
```bash
npm run build       # Build the TypeScript project
npm run dev         # Run in development mode with hot reload
```

### Testing
```bash
npm run test        # Run tests
npm run test:watch  # Run tests in watch mode
npm run test:ui     # Open Vitest UI for interactive testing
npm run test:coverage # Run tests with coverage report
```

**Note**: Run `npm install` first to install test dependencies if you haven't already.

### CLI Usage
```bash
devvy setup         # Initial setup wizard (collects configuration interactively)
devvy start         # Start the development container
devvy connect       # Connect to the container via SSH
devvy rebuild       # Rebuild container (handles SSH known hosts automatically)
devvy stop          # Stop the container
devvy status        # Check container and services status
devvy logs          # View container logs
devvy sync          # Sync local changes to container
devvy cleanup       # Clean up Docker resources
```

## Project Structure
- `src/` - TypeScript source code
  - `commands/` - CLI command implementations
  - `services/` - Business logic services
  - `utils/` - Utility functions
  - `types/` - TypeScript type definitions
  - `config/` - Configuration management
- `tests/` - Test files mirroring src structure
  - `commands/` - Tests for command implementations
  - `services/` - Tests for services
  - `utils/` - Tests for utilities
- `container-scripts/` - Bash scripts that run inside the container
- `dist/` - Compiled JavaScript output (git-ignored)
- `legacy-bash/` - Original bash scripts (temporary during migration)

## Migration Status
Currently migrating from bash to TypeScript following the plans in `_plans/` directory.

## Testing

### Testing Framework
The project uses **Vitest** for testing, which provides:
- Fast test execution with native TypeScript support
- Jest-compatible API
- Built-in mocking capabilities
- Watch mode for development

### Running Tests
```bash
npm run test        # Run all tests once
npm run test:watch  # Run tests in watch mode during development
npm run test:ui     # Open Vitest UI for interactive testing
npm run test:coverage # Generate coverage report
```

### Test Structure
Tests are located in the `tests/` directory, mirroring the `src/` structure:
- `tests/services/vscode.test.ts` - Tests for VS Code sync functionality
- `tests/commands/setup.test.ts` - Tests for setup command (to be implemented)

### Writing Tests
Tests use Vitest's API with TypeScript:
```typescript
import { describe, it, expect, vi } from 'vitest';
```

Before committing, always run:
```bash
npm run quality     # Typecheck and lint
npm run test        # Run tests
```

## Important Notes
- The project has transitioned from ESLint/Prettier to Biome for linting and formatting
- Container scripts remain as bash for lightweight container initialization
- All TypeScript code follows strict mode for maximum type safety
- New services added: SSH service for container connection management, VS Code service for IDE integration

## Environment Variable Handling
The setup command now:
- Interactively collects optional configuration (GitHub token, editor settings)
- Preserves existing values when re-running setup
- Only prompts for updates when values already exist
- Automatically detects user/group IDs and git configuration

## SSH Known Hosts Management
The rebuild command automatically:
- Retrieves the current SSH host key before rebuilding
- Removes old entries from ~/.ssh/known_hosts
- Notifies user they'll need to verify the new host key on next connection
- Prevents SSH connection errors after container rebuilds

## Code Style and Conventions

### Use Functions and Modules Instead of Classes
- Prefer exporting individual functions from modules rather than static class methods
- Example: Use `export function exec()` instead of `export class Shell { static exec() }`
- This makes the code more tree-shakeable and follows modern JavaScript patterns

### Template Literals Over String Concatenation
- Always use template literals for string interpolation
- Example: Use `` `Run ${chalk.cyan('devvy start')}` `` instead of `'Run ' + chalk.cyan('devvy start')`

### Avoid Non-Null Assertions
- Instead of using `!` (non-null assertion), add proper checks
- Example: Use `if (array.length === 0) throw new Error()` before accessing `array[0]`

### Import Patterns
- For utility modules with multiple exports, use namespace imports: `import * as prompt from '@utils/prompt'`
- For specific functions, use named imports: `import { exec, commandExists } from '@utils/shell'`

### Biome Linting Rules to Remember
- `lint/style/useTemplate`: Prefer template literals over string concatenation
- `lint/style/noNonNullAssertion`: Avoid non-null assertions
- `lint/complexity/noStaticOnlyClass`: Avoid classes with only static members

### Quality Checks
Always run these before committing:
```bash
npm run quality     # Runs both typecheck and lint
npm run format      # Auto-formats code with Biome
```

### Common Mistakes to Avoid
1. Don't use string concatenation for building strings with variables
2. Don't use non-null assertions (!) without proper checks
3. Don't create classes with only static methods - use functions instead
4. Always run quality checks before assuming code is ready