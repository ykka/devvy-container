# Claude Docker Development Environment

A containerized development environment that provides a consistent, isolated workspace with Claude Code, Neovim, and full development tooling. Connect via Cursor/VS Code for a seamless remote development experience.

## 🎯 Purpose

This Docker environment solves several critical development challenges:

- **Architecture Compatibility**: Run Linux-compiled npm packages (with native bindings) while developing on macOS
- **Consistent Environment**: Same tools, versions, and configurations across all projects
- **Isolation**: Keep your host system clean; all development dependencies stay in the container
- **Claude Code Integration**: Run Claude Code safely in an isolated environment
- **Remote Development**: Full Cursor/VS Code integration with proper IntelliSense and debugging

## 📁 Repository Structure

```
claude-docker/
├── Dockerfile                 # Main container definition
├── docker-compose.yml        # Service orchestration
├── .env                      # Environment variables (create from .env.example)
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── scripts/
│   ├── setup.sh             # Initial setup and build script
│   ├── docker-entrypoint.sh # Container initialization
│   ├── init-firewall.sh    # Security/firewall setup
│   ├── create-worktree.sh  # Git worktree helper
│   └── install-vscode-extensions.sh # Extension installer
├── secrets/                  # SSH keys (git-ignored)
│   ├── container_rsa        # Container's SSH private key
│   └── container_rsa.pub    # Container's SSH public key
└── vscode-config/           # Cursor/VS Code configuration
    ├── settings.json        # Editor settings
    ├── extensions.txt       # Extension list
    └── keybindings.json    # Custom keybindings
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop for Mac
- Cursor (or VS Code with Dev Containers extension)
- Git configured on your host machine

### Initial Setup

1. **Clone this repository:**
   ```bash
   git clone <your-repo-url> ~/Repos/claude-docker
   cd ~/Repos/claude-docker
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
   ./scripts/setup.sh
   ```
   This will:
   - Build the Docker image with your user ID/group ID
   - Generate SSH keys for container access
   - Start the container
   - Configure Git inside the container

4. **Verify the container is running:**
   ```bash
   docker ps
   # Should show 'claude-dev' container running
   ```

## 🔌 Connecting Cursor to the Container

### Method 1: Attach to Running Container (Recommended)

1. Open Cursor on your Mac
2. Press `Cmd+Shift+P` to open command palette
3. Type and select: `Dev Containers: Attach to Running Container`
4. Choose `claude-dev` from the list
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
docker exec -it claude-dev zsh

# With tmux
docker exec -it claude-dev tmux new -s dev
```

### First-Time Extension Setup

After connecting to the container, install your Cursor extensions:

```bash
# Method 1: Via Docker exec
docker exec -it claude-dev bash -c "
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
~/Repos/claudespace → /home/devvy/claudespace

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
docker exec -it claude-dev bash
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

## 🛠️ Daily Workflow

### Starting Your Day

```bash
# Start the container (if not running)
cd ~/Repos/claude-docker
docker-compose start

# Option 1: Connect via Cursor
# Open Cursor → Cmd+Shift+P → Attach to Running Container → claude-dev

# Option 2: SSH with tmux for terminal work
ssh -p 2222 devvy@localhost -i ~/.ssh/claude_docker_rsa
tmux new -s main  # Create persistent session

# Option 3: Mosh for mobile/unstable connections
mosh --ssh='ssh -p 2222 -i ~/.ssh/claude_docker_rsa' devvy@localhost
tmux attach -t main || tmux new -s main
```

### Working on Projects

1. **All your projects** live in `~/Repos/claudespace/` on your Mac
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
docker exec -it claude-dev bash
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

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Required
USER_ID=501                  # Your Mac user ID (run: id -u)
GROUP_ID=20                  # Your Mac group ID (run: id -g)
GIT_USER_NAME="Your Name"
GIT_USER_EMAIL="you@email.com"

# Optional
GITHUB_TOKEN=ghp_...        # For GitHub CLI
DATABASE_URL=postgres://... # Database connections
LINEAR_API_KEY=lin_api_...  # Linear integration
```

### Cursor/VS Code Settings

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
| 5432 | PostgreSQL | `postgresql://localhost:5432` |
| 27017 | MongoDB | `mongodb://localhost:27017` |
| 6379 | Redis | `redis://localhost:6379` |

## 🐛 Troubleshooting

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
./scripts/setup.sh
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
docker exec -it claude-dev bash
npm install
```

### Extensions Not Working

```bash
# Reinstall extensions in container
docker exec -it claude-dev bash
/home/devvy/vscode-config/install-vscode-extensions.sh
```

### Port Already in Use

```bash
# Find what's using the port (e.g., 3000)
lsof -i :3000

# Kill the process or change the port in docker-compose.yml
```

## 📚 Advanced Usage

### Git Worktrees

Use worktrees to work on multiple branches simultaneously:

```bash
# Inside container
cd ~/claudespace/your-repo
git worktree add worktrees/feature-branch origin/feature-branch
cd worktrees/feature-branch
```

### Multiple Projects

Structure your projects:
```
~/Repos/claudespace/
├── project-a/
├── project-b/
├── shared-libs/
└── experiments/
```

All accessible in container at `/home/devvy/claudespace/`

### Database Connections

Databases running on your Mac are accessible from container:
- Use `host.docker.internal` as hostname
- Or use the mapped ports (5432, 27017, etc.)

### Custom Scripts

Add scripts to the container:
1. Create script in `scripts/` directory
2. Mount it in `docker-compose.yml`
3. Rebuild: `docker-compose up -d --build`

## 🔄 Maintenance

### Updating the Container

```bash
# Pull latest changes
git pull

# Rebuild
docker-compose down
./scripts/setup.sh
```

### Cleaning Up

```bash
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

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch
3. Test your changes thoroughly
4. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🆘 Support

- **Issues**: Open an issue in this repository
- **Claude Code Issues**: Use `/bug` command in Claude Code
- **Docker Issues**: Check Docker Desktop logs

---

**Remember**: Always run npm/build commands inside the container to avoid binary compatibility issues!