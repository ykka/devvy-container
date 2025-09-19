# Devvy - TypeScript Migration

## Terminology
**IMPORTANT**: Throughout the codebase, use these terms consistently:
- **local machine** - The host Mac that runs Docker containers, the machine from which we SSH into the container
- **container** - The Docker container itself (devvy-container)

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

### Development Mode Commands
**IMPORTANT**: When running in development mode, use:
```bash
npm run dev rebuild   # Rebuild container in dev mode
npm run dev connect   # Connect to container in dev mode
npm run dev start     # Start container in dev mode
npm run dev setup     # Run setup in dev mode
# etc...
```

**DO NOT** run:
- `npm run dev` alone (this just starts the dev server)
- `devvy rebuild` (use `npm run dev rebuild` instead)

### Testing
```bash
npm run test        # Run tests once and exit
npm run test:watch  # Run tests in watch mode (continuous)
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
devvy cleanup       # Clean up Docker resources
```

## Project Structure
- `src/` - TypeScript source code
  - `commands/` - CLI command implementations
  - `services/` - Business logic services
  - `utils/` - Utility functions
  - `types/` - TypeScript type definitions
  - `config/` - Configuration management
  - `__tests__/` - Test files mirroring src structure
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
Tests are located in the `src/__tests__/` directory, mirroring the source structure:
- `src/__tests__/commands/setup.test.ts` - Tests for setup command (to be implemented)

**IMPORTANT**: Keep tests inside `src/__tests__/` directory, not in a separate `tests/` folder at the root. This ensures:
- Tests are co-located with source code for better organization
- TypeScript compilation includes test files for type checking
- Path aliases work correctly in test files without additional configuration

### Writing Tests
Tests use Vitest's API with TypeScript:
```typescript
import { describe, it, expect, vi } from 'vitest';
```

### Mocking Patterns
**IMPORTANT**: Follow these patterns when mocking in tests:

1. **Module Mocking**: Use `vi.mock()` at the top level with factory functions:
```typescript
// Mock modules - vi.mock is hoisted, so we define mocks inside factory functions
vi.mock('fs-extra', () => ({
  pathExists: vi.fn(),
  writeFile: vi.fn(),
  // ... other functions
}));
```

2. **Import Order and Mock References**:
```typescript
// Import order matters:
// 1. First, import non-mocked modules
import { logger } from '@utils/logger';
import * as shell from '@utils/shell';
// 2. Then import mocked modules AFTER vi.mock
import * as fs from 'fs-extra';

// 3. Create mock references using 'as any' for simplicity
const mockPathExists = fs.pathExists as any;
const mockWriteFile = fs.writeFile as any;
const mockRun = shell.run as any;
```

3. **Mock Return Values**: Use the typed references in tests:
```typescript
// For simple return values
mockPathExists.mockResolvedValue(true);

// For conditional returns based on arguments
mockPathExists.mockImplementation(async (path: string) => {
  return path === '/some/specific/path';
});
```

**Never** use inline type assertions repeatedly - define them once at the top.

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
5. **IMPORTANT**: When using `execa` with `shell: true`, pass the entire command as a single string, NOT split into command and args:
   ```typescript
   // WRONG - triggers Node.js DEP0190 warning
   const [cmd, ...args] = command.split(' ');
   await execa(cmd, args, { shell: true });
   
   // CORRECT - pass full command string when using shell
   await execa(command, { shell: true });
   ```
   This is necessary for commands with pipes, redirections, or shell operators to work correctly.