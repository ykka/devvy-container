# Devvy - Development Environment Container

**Tested on macOS with Cursor IDE**

> An exploration in secure AI-assisted development: Running development tools safely in an isolated Docker container while maintaining a productive development workflow.

## Why This Exists: The Security Challenge

When running Claude Code directly on your host machine, you're essentially giving an AI system unrestricted access to execute commands. Anthropic themselves warns about this:

> *"Letting Claude run arbitrary commands is risky and can result in data loss, system corruption, or even data exfiltration (e.g., via prompt injection attacks)"* — [Anthropic Security Documentation](https://docs.anthropic.com/en/docs/security/web-artifacts#claude-code)

### The Official Recommendation

Anthropic recommends:
> *"To minimize these risks, use --dangerously-skip-permissions in a container without internet access. You can follow this reference implementation using Docker Dev Containers."*

Even with containers, they caution:
> *"While the devcontainer provides substantial protections, no system is completely immune to all attacks. When executed with --dangerously-skip-permissions, devcontainers do not prevent a malicious project from exfiltrating anything accessible in the devcontainer including Claude Code credentials."*

## This Solution: Best of Both Worlds

This repository represents my exploration of an optimal setup that balances:

- **Security**: Claude Code runs in an isolated container with limited access to your host system
- **Productivity**: Full VS Code/Cursor integration with all your familiar tools and settings
- **Functionality**: Complete development environment with Node.js, Python, build tools, and more
- **Flexibility**: Your projects remain on your host machine, accessible through volume mounts

### Key Design Decisions

1. **Containerized Claude Code**: Runs exclusively inside Docker, never touching your host directly
2. **Selective Volume Mounts**: Only specific directories are accessible to the container
3. **Network Isolation Options**: Can be configured for restricted internet access
4. **Persistent Development State**: Docker volumes preserve your tools, caches, and configurations
5. **Remote Development**: Use Cursor/VS Code's remote container features for a native experience

## Important Caveats

### The Trade-offs

While this setup significantly improves security, there are some limitations:

- **No Visual Browser Automation**: Playwright and similar tools run headlessly - you can't watch the browser or intervene visually
- **Build Inside Container**: All `npm install`, builds, and development servers must run inside the container (this is actually a feature for consistency!)
- **Binary Compatibility**: Node modules are compiled for Linux, not macOS - never run `npm install` on the host
- **SSH Key Management**: Requires separate SSH keys for container Git operations

### When This Setup Shines

- Working with untrusted or experimental code
- Testing packages with native dependencies
- Maintaining consistent development environments across projects
- Isolating Claude Code from sensitive host data
- Running Linux-specific tools on macOS

### When You Might Want Something Else

- Need to watch browser automation visually
- Require direct hardware access (USB devices, etc.)
- Working with macOS-specific development (iOS apps, etc.)
- Need maximum performance for compute-intensive tasks

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│               Your Mac (Host)                    │
│                                                  │
│  ┌─────────────────┐  ┌──────────────────────┐ │
│  │   Cursor IDE    │  │    Your Projects     │ │
│  │                 │  │  ~/repos/claudespace  │ │
│  └────────┬────────┘  └────────┬─────────────┘ │
│           │                     │               │
│           └──────────┬──────────┘               │
│                      │                          │
│         Docker Remote Connection                │
│                      │                          │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│                      ▼                          │
│         Docker Container (Linux)                │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │           Claude Code                     │ │
│  │   (--dangerously-skip-permissions)        │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌──────────┐ ┌────────┐ ┌─────────────────┐ │
│  │ Node.js  │ │ Python │ │ Build Tools     │ │
│  └──────────┘ └────────┘ └─────────────────┘ │
│                                                 │
│  Mounted: ~/repos/claudespace                  │
│        → /home/devvy/claudespace               │
│  Isolated: System files, credentials           │
└─────────────────────────────────────────────────┘
```

## Getting Started

> **Note:** This setup uses your existing VS Code/Cursor configuration files (`settings.json`, `keybindings.json`, `extensions.txt`). During setup, you can choose to import these from your local installation.

## Purpose

This Docker environment solves several critical development challenges:

- **Architecture Compatibility**: Run Linux-compiled npm packages (with native bindings) while developing on macOS
- **Consistent Environment**: Same tools, versions, and configurations across all projects
- **Isolation**: Keep your host system clean; all development dependencies stay in the container
- **Claude Code Integration**: Run Claude Code safely in an isolated environment
- **Remote Development**: Full Cursor/VS Code integration with proper IntelliSense and debugging

## Repository Structure

```
claude-docker/
├── Dockerfile                 # Main container definition
├── docker-compose.yml        # Service orchestration
├── .env                      # Environment variables (create from .env.example)
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── setup-scripts/            # Host-side setup scripts
│   ├── setup.sh             # Initial setup and build script
│   ├── cleanup.sh           # Clean up containers and volumes
│   └── install-vscode-extensions.sh # Extension installer
├── container-scripts/        # Container-side scripts  
│   ├── docker-entrypoint.sh # Container initialization
│   └── init-firewall.sh     # Security/firewall setup
├── secrets/                  # SSH keys (git-ignored)
│   ├── container_rsa        # Container's SSH private key
│   └── container_rsa.pub    # Container's SSH public key
└── vscode-config/           # Cursor/VS Code configuration
    ├── settings.json        # Editor settings (your custom settings)
    ├── extensions.txt       # Extension list (your extensions)
    └── keybindings.json    # Custom keybindings (your keybindings)
```

## Quick Start

### Prerequisites

- Docker Desktop for Mac
- Cursor (or VS Code with Dev Containers extension)
- Git configured on your host machine

### Initial Setup

1. **Clone this repository:**
   ```bash
   git clone <your-repo-url> ~/<your-repos-directory>/claude-docker
   cd ~/<your-repos-directory>/claude-docker
   ```

2. **Create your environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your values:
   # - GIT_USER_NAME
   # - GIT_USER_EMAIL
   # - GITHUB_TOKEN (optional, for GitHub CLI)
   ```

3. **Run the setup script:**
   ```bash
   ./setup-scripts/setup.sh
   ```
   This will:
   - Ask if you want to import your VS Code/Cursor settings
   - Build the Docker image with your user ID/group ID
   - Generate SSH keys for container access
   - Start the container
   - Configure Git inside the container

4. **Verify the container is running:**
   ```bash
   docker ps
   # Should show 'claude-devvy-container' container running
   ```

## Connecting Cursor to the Container

### Method 1: Attach to Running Container (Recommended)

1. Open Cursor on your Mac
2. Press `Cmd+Shift+P` to open command palette
3. Type and select: `Dev Containers: Attach to Running Container`
4. Choose `claude-devvy-container` from the list
5. Cursor will reopen connected to the container


### Alternative Access Methods

#### SSH Access
```bash
# SSH into the container (password-less with key)
ssh -p 2222 devvy@localhost -i ~/.ssh/claude_docker_rsa

# Once inside, start tmux for persistent sessions
tmux new -s dev
# Or attach to existing session
tmux attach -t dev
```

#### Mosh Access (Better for unstable connections)
```bash
# Mosh provides persistent connection that survives network changes
mosh --ssh='ssh -p 2222 -i ~/.ssh/claude_docker_rsa' devvy@localhost

# Start tmux inside mosh session
tmux new -s dev
```

#### Direct Docker Exec
```bash
# Quick access without SSH
docker exec -it claude-devvy-container zsh

# With tmux
docker exec -it claude-devvy-container tmux new -s dev
```

### First-Time Extension Setup

After connecting to the container, install your Cursor extensions:

```bash
# Method 1: Via Docker exec
docker exec -it claude-devvy-container bash -c "
while read ext; do
  [[ \$ext =~ ^#.*$ || -z \$ext ]] && continue
  code --install-extension \$ext 2>/dev/null || true
done < /home/devvy/vscode-config/extensions.txt
"

# Method 2: Via SSH
ssh -p 2222 devvy@localhost -i ~/.ssh/claude_docker_rsa << 'EOF'
while read ext; do
  [[ $ext =~ ^#.*$ || -z $ext ]] && continue
  code --install-extension $ext 2>/dev/null || true
done < /home/devvy/vscode-config/extensions.txt
EOF

# Method 3: Via Mosh (first connect, then run)
mosh --ssh='ssh -p 2222 -i ~/.ssh/claude_docker_rsa' devvy@localhost
# Then inside mosh:
/home/devvy/vscode-config/install-vscode-extensions.sh
```

## 🏗️ Architecture & How It Works

### The Container Environment

The Docker container runs Debian Linux with:
- **Node.js 24**: Latest LTS version
- **Python 3**: With pip and virtual environment support
- **Build Tools**: gcc, make, cmake for compiling native modules
- **Claude Code**: Installed globally via npm
- **Neovim**: Latest stable, built from source
- **Git & GitHub CLI**: Full version control support
- **Development Tools**: ripgrep, fd, jq, tmux, zsh

### Volume Mounts & Persistence

```yaml
# Project files (read-write)
~/<your-repos-directory>/claudespace → /home/devvy/claudespace

# Configuration (read-only, from host)
~/.config/nvim → /home/devvy/.config/nvim
~/.config/tmux → /home/devvy/.config/tmux      # tmux configuration
~/.zshrc → /home/devvy/.zshrc
~/.gitconfig → /home/devvy/.gitconfig

# Persistent data (Docker volumes)
vscode-server → /home/devvy/.vscode-server      # Cursor server & extensions
npm-cache → /home/devvy/.npm                    # npm cache
pnpm-store → /home/devvy/.local/share/pnpm     # pnpm store
nvim-data → /home/devvy/.local/share/nvim      # Neovim data
claude-code-data → /home/devvy/.local/share/claude-code
```

### How Cursor Remote Development Works

1. **Connection**: Cursor on Mac connects to container via Docker API
2. **Server Installation**: Cursor installs a server component at `~/.vscode-server/` in container
3. **Processing**: All language servers, linters, and tools run inside the container
4. **File Access**: Files are accessed through the container's filesystem
5. **Binary Compatibility**: npm packages are compiled for Linux, avoiding macOS/Linux conflicts

## 📦 Node Modules & Package Management

### The Problem This Solves

When npm installs packages with native bindings (like `esbuild`, `sharp`, `node-sass`):
- They compile for the current OS/architecture
- macOS binaries won't work in Linux containers
- Linux binaries won't work on macOS

### The Solution

**All npm operations happen inside the container:**

```bash
# Always run these commands inside the container:
docker exec -it claude-devvy-container bash
npm install
npm run build
npm run dev
```

Or when connected via Cursor:
- Terminal automatically opens in container
- All npm commands run in the Linux environment
- Binaries are compiled correctly for Linux

### Important Notes

- ✅ **DO**: Run `npm install` inside the container
- ✅ **DO**: Run build/dev commands inside the container  
- ✅ **DO**: Use Cursor's integrated terminal (runs in container)
- ❌ **DON'T**: Run `npm install` on your Mac in the mounted folders
- ❌ **DON'T**: Mix node_modules between host and container

## Daily Workflow

### Starting Your Day

```bash
# Start the container (if not running)
cd ~/<your-repos-directory>/claude-docker
docker-compose start

# Option 1: Connect via Cursor
# Open Cursor → Cmd+Shift+P → Attach to Running Container → claude-devvy-container

# Option 2: SSH with tmux for terminal work
ssh -p 2222 devvy@localhost -i ~/.ssh/claude_docker_rsa
tmux new -s main  # Create persistent session

# Option 3: Mosh for mobile/unstable connections
mosh --ssh='ssh -p 2222 -i ~/.ssh/claude_docker_rsa' devvy@localhost
tmux attach -t main || tmux new -s main
```

### Working on Projects

1. **All your projects** live in `~/<your-repos-directory>/claudespace/` on your Mac
2. **Inside container** they're at `/home/devvy/claudespace/`
3. **File changes** sync instantly (bind mount)

### Running Development Servers

```bash
# Inside container (or Cursor terminal)
cd ~/claudespace/your-project
npm run dev
# Server runs on port 3000-3010 (mapped to host)
```

Access on Mac: `http://localhost:3000`

### Using Claude Code

```bash
# Inside the container
docker exec -it claude-devvy-container bash
claude

# Or with specific directory
cd ~/claudespace/your-project
claude
```

### Ending Your Day

```bash
# Stop the container (preserves all data)
docker-compose stop

# Or remove it completely (volumes persist)
docker-compose down
```

## Configuration

### Environment Variables (.env)

```bash
# Required
USER_ID=501                  # Your Mac user ID (run: id -u)
GROUP_ID=20                  # Your Mac group ID (run: id -g)
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="you@email.com"

# Optional
GITHUB_TOKEN=ghp_...        # For GitHub CLI
LINEAR_API_KEY=lin_api_...  # Linear integration
```

### Cursor/VS Code Settings

> **Important:** The files in `vscode-config/` should be YOUR personal configuration files. During initial setup, the setup script will offer to copy these from your local VS Code/Cursor installation.

- **`vscode-config/settings.json`**: Your editor preferences
- **`vscode-config/extensions.txt`**: List of extensions to install
- **`vscode-config/keybindings.json`**: Custom keyboard shortcuts

To update settings:
1. Edit files in `vscode-config/`
2. Restart Cursor connection to apply

### Ports

| Port Range | Purpose | Access |
|------------|---------|--------|
| 2222 | SSH access | `ssh -p 2222 devvy@localhost` |
| 3000-3010 | Dev servers | `http://localhost:3000` |

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs -f

# Rebuild if needed
docker-compose down
./scripts/setup.sh
```

### Permission Issues

```bash
# Ensure USER_ID and GROUP_ID match your Mac user
id -u  # Should match USER_ID in .env
id -g  # Should match GROUP_ID in .env

# Rebuild with correct IDs
docker-compose down
./setup-scripts/setup.sh
```

### Cursor Can't Connect

1. Ensure container is running: `docker ps`
2. Check Docker Desktop is running
3. Reinstall Dev Containers extension in Cursor
4. Try: `docker-compose restart`

### Node Modules Issues

```bash
# If you accidentally ran npm install on Mac:
rm -rf node_modules package-lock.json

# Inside container:
docker exec -it claude-devvy-container bash
npm install
```

### Extensions Not Working

```bash
# Reinstall extensions in container
docker exec -it claude-devvy-container bash
/home/devvy/vscode-config/install-vscode-extensions.sh
```

### Port Already in Use

```bash
# Find what's using the port (e.g., 3000)
lsof -i :3000

# Kill the process or change the port in docker-compose.yml
```

## Advanced Usage


### Multiple Projects

Structure your projects:
```
~/<your-repos-directory>/claudespace/
├── project-a/
├── project-b/
├── shared-libs/
└── experiments/
```

All accessible in container at `/home/devvy/claudespace/`


### Custom Scripts

Add scripts to the container:
1. Create script in `container-scripts/` directory
2. Mount it in `docker-compose.yml`
3. Rebuild: `docker-compose up -d --build`

## Maintenance

### Updating the Container

```bash
# Pull latest changes
git pull

# Rebuild
docker-compose down
./setup-scripts/setup.sh
```

### Cleaning Up

```bash
# Use the cleanup script for interactive cleanup
./setup-scripts/cleanup.sh

# Or manually:
# Remove container but keep volumes
docker-compose down

# Remove everything including volumes (⚠️ loses installed extensions)
docker-compose down -v

# Clean up Docker system
docker system prune -a
```

### Backing Up

```bash
# Backup Cursor extensions & settings
docker run --rm -v claude-docker_vscode-server:/data -v $(pwd):/backup \
  alpine tar czf /backup/vscode-backup.tar.gz -C /data .

# Backup all volumes
docker-compose stop
for vol in $(docker volume ls -q | grep claude-docker); do
  docker run --rm -v $vol:/data -v $(pwd)/backups:/backup \
    alpine tar czf /backup/$vol.tar.gz -C /data .
done
```

## Contributing

1. Fork this repository
2. Create your feature branch
3. Test your changes thoroughly
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- **Issues**: Open an issue in this repository
- **Claude Code Issues**: Use `/bug` command in Claude Code
- **Docker Issues**: Check Docker Desktop logs

---

**Remember**: Always run npm/build commands inside the container to avoid binary compatibility issues!