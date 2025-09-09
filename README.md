# Devvy - Secure Development Container

A Docker-based development environment that runs Claude Code and development tools in isolation, accessible via VS Code/Cursor.

## Why This Exists

Running Claude Code directly on your host machine gives AI unrestricted system access. This container provides:
- **Security**: Claude Code runs isolated from your host system
- **Consistency**: Linux environment for all npm packages and builds
- **Integration**: Full VS Code/Cursor support with remote development

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- VS Code/Cursor with Dev Containers extension

### Installation

```bash
# Clone repository
git clone <your-repo-url> claude-devvy-container
cd claude-devvy-container

# Install CLI
npm install
npm run compile

# Run setup wizard
./devvy setup
```

The setup wizard will:
- Collect your configuration (GitHub token, etc.)
- Generate SSH keys for container access
- Build the Docker image
- Start the container

## CLI Commands

```bash
devvy setup      # Initial setup wizard
devvy start      # Start container
devvy stop       # Stop container
devvy connect    # SSH into container
devvy status     # Check container status
devvy logs       # View container logs
devvy rebuild    # Rebuild container (preserves data)
devvy sync       # Sync files to container
devvy cleanup    # Clean up Docker resources
```

## Connecting VS Code/Cursor

1. Start the container: `devvy start`
2. Open VS Code/Cursor
3. Press `Cmd+Shift+P` → "Dev Containers: Attach to Running Container"
4. Select `claude-devvy-container`

## Project Structure

```
claude-devvy-container/
├── src/              # TypeScript CLI source
│   ├── commands/     # CLI command implementations
│   ├── services/     # Business logic
│   └── config/       # Configuration management
├── container-scripts/# Container initialization scripts
├── secrets/          # SSH keys (git-ignored)
│   ├── host_rsa          # Private key on local machine for SSH access to the container
│   ├── host_rsa.pub      # Public key
│   └── authorized_keys   # Container's authorized keys
├── vscode-config/    # VS Code settings (copied during setup)
└── .env             # Configuration (created during setup)
```

## Configuration

The `.env` file (created during setup) contains:

```bash
# User/Group IDs
HOST_UID=1000
HOST_GID=1000

# Git configuration
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="you@email.com"

# Project path
PROJECTS_PATH=/Users/you/repos

# Optional services
GITHUB_TOKEN=ghp_...
```

## Working with Projects

Your projects are mounted at:
- **Host**: `~/repos/` (or your configured path)
- **Container**: `/home/devvy/repos/`

### Important: Always Run Commands in Container

```bash
# ✅ CORRECT - Inside container
devvy connect
cd ~/repos/your-project
npm install
npm run dev

# ❌ WRONG - On host machine
cd ~/repos/your-project
npm install  # This creates macOS binaries that won't work in Linux container
```

## SSH Access

```bash
# Connect via SSH
ssh -p 2222 devvy@localhost -i ./secrets/host_rsa

# Or use the CLI (recommended)
devvy connect
```

## Ports

| Port | Purpose |
|------|---------|
| 2222 | SSH access |
| 3000-3010 | Development servers |
| 60000-60010 | Mosh (UDP) |

## Troubleshooting

### Container won't start
```bash
devvy status         # Check current state
devvy logs          # View error logs
devvy rebuild       # Rebuild if needed
```

### Permission issues
Ensure your user/group IDs are correct:
```bash
id -u  # Should match HOST_UID in .env
id -g  # Should match HOST_GID in .env
```

### VS Code can't connect
1. Ensure container is running: `devvy status`
2. Check Docker Desktop is running
3. Try: `devvy stop && devvy start`

### After rebuild, SSH fails
The rebuild command handles SSH known_hosts automatically. If issues persist:
```bash
ssh-keygen -R "[localhost]:2222"
devvy connect  # Will prompt to verify new host key
```

## Development

```bash
# Run quality checks
npm run quality     # TypeScript + linting
npm run format      # Auto-format code

# Build CLI
npm run build       # Compile TypeScript
npm run compile     # Build + make executable

# Development mode
npm run dev         # Run with hot reload
```

## License

MIT