# Build and Tooling Configuration

## TypeScript Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],

    // Module Resolution
    "moduleResolution": "node",
    "baseUrl": "./src",
    "paths": {
      "@commands/*": ["commands/*"],
      "@services/*": ["services/*"],
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"],
      "@config/*": ["config/*"]
    },
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // Type Checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Emit
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,

    // Interop Constraints
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "legacy-bash"]
}
```

## ESLint Configuration

### .eslintrc.json
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": [
    "@typescript-eslint",
    "import",
    "security",
    "unicorn"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:security/recommended",
    "plugin:unicorn/recommended",
    "prettier"
  ],
  "rules": {
    // TypeScript specific
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",

    // Import rules
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "import/no-duplicates": "error",

    // Unicorn rules (adjust as needed)
    "unicorn/filename-case": ["error", { "case": "kebabCase" }],
    "unicorn/no-null": "off",
    "unicorn/prevent-abbreviations": "off",

    // General rules
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  },
  "env": {
    "node": true
  }
}
```

## Prettier Configuration

### .prettierrc
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### .prettierignore
```
dist/
node_modules/
*.md
legacy-bash/
container-scripts/
secrets/
.env*
```

## Package.json Scripts

```json
{
  "name": "claude-docker-cli",
  "version": "2.0.0",
  "description": "Claude Docker Development Environment CLI",
  "main": "dist/index.js",
  "bin": {
    "devvy": "./devvy"
  },
  "scripts": {
    // Development
    "dev": "tsx watch src/index.ts",
    "dev:debug": "NODE_ENV=development tsx --inspect src/index.ts",

    // Building
    "build": "npm run clean && tsc",
    "build:watch": "tsc --watch",
    "clean": "rimraf dist",
    "compile": "npm run build && npm run make-executable",
    "make-executable": "chmod +x devvy && echo '#!/usr/bin/env node' | cat - dist/index.js > temp && mv temp devvy",


    // Code Quality
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "quality": "npm run typecheck && npm run lint && npm run format:check",

    // Git Hooks
    "prepare": "husky install",
    "pre-commit": "lint-staged"
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## Dependencies

### Production Dependencies
```json
{
  "dependencies": {
    "chalk": "^5.3.0",           // Terminal colors
    "commander": "^11.1.0",      // CLI framework
    "dockerode": "^4.0.0",       // Docker API
    "dotenv": "^16.3.1",         // Environment variables
    "inquirer": "^9.2.12",       // Interactive prompts
    "zod": "^3.22.4",            // Schema validation
    "ora": "^7.0.1",             // Loading spinners
    "cli-table3": "^0.6.3",      // Terminal tables
    "yaml": "^2.3.4",            // YAML parsing
    "winston": "^3.11.0",        // Logging
    "execa": "^8.0.1",           // Better child_process
    "fs-extra": "^11.2.0",       // Enhanced fs operations
    "which": "^4.0.0"            // Find executables
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    // TypeScript
    "@types/node": "^20.10.0",
    "@types/dockerode": "^3.3.23",
    "@types/inquirer": "^9.0.7",
    "@types/which": "^3.0.3",
    "typescript": "^5.3.3",
    "tsx": "^4.6.2",             // TypeScript execution

    // Linting
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.29.0",
    "eslint-plugin-security": "^1.7.1",
    "eslint-plugin-unicorn": "^49.0.0",

    // Formatting
    "prettier": "^3.1.0",

    // Git Hooks
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",

    // Build Tools
    "rimraf": "^5.0.5"
  }
}
```

## Build Process

### Development Build
1. TypeScript compiles to JavaScript in `dist/`
2. Source maps generated for debugging
3. Watch mode for automatic recompilation

### Production Build
1. Clean previous build
2. Compile TypeScript with optimizations
3. Generate type declarations
4. Create executable with shebang
5. Set executable permissions

### CI/CD Pipeline
1. Install dependencies
2. Run type checking
3. Run linting
4. Build production bundle
5. Create release artifacts

## Compilation Target

- **Node.js Version**: 18+ (LTS)
- **ECMAScript Target**: ES2022
- **Module System**: CommonJS (for compatibility)
- **Source Maps**: Enabled for debugging
- **Type Declarations**: Generated for library usage

## Pre-commit Hooks

Using Husky and lint-staged:
1. Type check changed files
2. Lint and auto-fix
3. Format with Prettier
4. Prevent commit if any step fails
