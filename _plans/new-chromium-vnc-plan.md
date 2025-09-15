# Chromium VNC Implementation Plan
## Adopting browser-use-mcp-server's Proven Approach

### Reference Implementation
- **Project**: https://github.com/co-browser/browser-use-mcp-server
- **Dockerfile**: https://raw.githubusercontent.com/co-browser/browser-use-mcp-server/refs/heads/main/Dockerfile

### Overview
Complete replacement of our current Chrome/VNC setup with browser-use-mcp-server's working implementation using TigerVNC, XFCE4 desktop, and Chromium from Playwright.

---

## Phase 1: Remove Current Implementation

### Files to Delete
- `container-scripts/start-vnc.sh`
- `container-scripts/stop-vnc.sh`
- `docs/vnc-browser-monitoring.md`

### Dockerfile Lines to Remove
- **Lines 60-84**: Current Chrome and VNC dependencies section
  ```dockerfile
  # Chrome and VNC dependencies
  RUN apt-get update && apt-get install -y \
      wget \
      gnupg \
      xvfb \
      x11vnc \
      fluxbox \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      && rm -rf /var/lib/apt/lists/*
  ```

- **Lines 86-91**: Google Chrome installation section
  ```dockerfile
  # Install Google Chrome
  RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
      && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
      && apt-get update \
      && apt-get install -y google-chrome-stable \
      && rm -rf /var/lib/apt/lists/*
  ```

- **Lines 154-155**: VNC configuration directory setup
  ```dockerfile
  # VNC configuration directory
  RUN mkdir -p /home/devvy/.vnc && \
      chown -R ${HOST_UID}:${HOST_GID} /home/devvy/.vnc
  ```

- **Lines 190-192**: Script references to remove
  ```dockerfile
  COPY container-scripts/start-vnc.sh /usr/local/bin/start-vnc.sh
  COPY container-scripts/stop-vnc.sh /usr/local/bin/stop-vnc.sh
  ```
  (Remove these lines from the COPY commands section)

- **Line 181**: DISPLAY environment variable
  ```dockerfile
  ENV DISPLAY=:99
  ```

### TypeScript Changes
- **src/commands/vnc.ts**: Simplify to basic connection info (or delete entirely)

---

## Phase 2: Add New Dependencies

### Location: After line 59 (database clients section)

```dockerfile
# XFCE Desktop and TigerVNC for browser monitoring (browser-use-mcp-server approach)
RUN apt-get update && \
    apt-get install --no-install-recommends -y \
    xfce4 \
    xfce4-terminal \
    dbus-x11 \
    tigervnc-standalone-server \
    tigervnc-tools \
    fonts-freefont-ttf \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-noto-color-emoji && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

---

## Phase 3: Install Chromium via Playwright

### Location: After line 148 (Node.js tools installation), as devvy user

```dockerfile
# Install Playwright with Chromium browser
RUN npm install -g playwright && \
    npx playwright install --with-deps --no-shell chromium
```

---

## Phase 4: Configure VNC Setup

### Location: Replace lines 154-155 (VNC configuration), as devvy user

```dockerfile
# VNC configuration for XFCE desktop
RUN mkdir -p /home/devvy/.vnc && \
    printf '#!/bin/sh\nunset SESSION_MANAGER\nunset DBUS_SESSION_BUS_ADDRESS\nstartxfce4' > /home/devvy/.vnc/xstartup && \
    chmod +x /home/devvy/.vnc/xstartup && \
    chown -R ${HOST_UID}:${HOST_GID} /home/devvy/.vnc
```

---

## Phase 5: Set Environment Variables

### Location: Replace line 181

```dockerfile
# Display configuration for VNC
ENV DISPLAY=:0
```

---

## Phase 6: Update Docker Entrypoint

### File: container-scripts/docker-entrypoint.sh

Add this section BEFORE starting SSH service (around line 80-90):

```bash
# Start VNC server automatically (like browser-use-mcp-server does)
echo "Starting VNC server for browser monitoring..."

# Setup VNC password if not exists
if [ ! -f /home/devvy/.vnc/passwd ]; then
    mkdir -p /home/devvy/.vnc
    echo "devvy" | vncpasswd -f > /home/devvy/.vnc/passwd
    chmod 600 /home/devvy/.vnc/passwd
    chown -R devvy:devvy /home/devvy/.vnc
fi

# Start VNC server as devvy user on display :0 (port 5900)
su - devvy -c "vncserver -depth 24 -geometry 1920x1080 -localhost no -PasswordFile /home/devvy/.vnc/passwd :0" 2>/dev/null || true

echo "VNC server started on port 5900 (connect with vnc://localhost:5900, password: devvy)"
```

---

## Phase 7: Update TypeScript VNC Command

### File: src/commands/vnc.ts (complete replacement)

```typescript
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';

export async function vnc(): Promise<void> {
  const isRunning = await docker.isContainerRunning('claude-devvy-container');

  if (!isRunning) {
    logger.warn('Container is not running. Start it first with:');
    console.log(chalk.cyan('  devvy start\n'));
    return;
  }

  console.log(chalk.bold('📺 VNC Browser Monitoring\n'));

  console.log(chalk.green('VNC is automatically running when container starts!\n'));

  console.log(chalk.yellow('Connect from your Mac:'));
  console.log('  1. Open Finder');
  console.log('  2. Press Cmd+K (Connect to Server)');
  console.log(`  3. Enter: ${chalk.cyan('vnc://localhost:5900')}`);
  console.log(`  4. Password: ${chalk.cyan('devvy')}\n`);

  console.log(chalk.yellow('Alternative - Use any VNC client:'));
  console.log(`  • Host: ${chalk.cyan('localhost')}`);
  console.log(`  • Port: ${chalk.cyan('5900')}`);
  console.log(`  • Password: ${chalk.cyan('devvy')}\n`);

  console.log(chalk.dim('Chromium will display here when launched by Playwright'));
  console.log(chalk.dim('VNC runs automatically - no need to start/stop it'));
}
```

---

## Phase 8: Create Documentation

### File: docs/vnc-browser-monitoring.md (new simplified version)

```markdown
# VNC Browser Monitoring

Monitor Chromium browsers running inside the container from your Mac.

## How It Works

- VNC server starts automatically when container starts
- Runs on port 5900 with XFCE desktop
- Chromium installed via Playwright
- No manual start/stop needed

## Connecting from Your Mac

### Option 1: macOS Screen Sharing (Recommended)
1. Open Finder
2. Press `Cmd+K` (Connect to Server)
3. Enter: `vnc://localhost:5900`
4. Password: `devvy`

### Option 2: VNC Client
Use any VNC client (RealVNC, TigerVNC, etc.):
- Host: `localhost`
- Port: `5900`
- Password: `devvy`

## Testing Chromium

Inside the container:

```bash
# Test Chromium manually
DISPLAY=:0 chromium --no-sandbox

# Test with Playwright
cat > test-browser.js << 'EOF'
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('Browser launched! Check VNC viewer');
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
EOF

node test-browser.js
```

## Changing VNC Password

Inside the container:
```bash
vncpasswd
# Then restart the container for changes to take effect
```

## Troubleshooting

If VNC doesn't connect:
1. Ensure port 5900 is exposed in docker-compose.yml
2. Check if VNC is running: `ps aux | grep vnc`
3. Check logs: `docker logs claude-devvy-container`
```

---

## Testing Checklist

After implementation, test each phase:

### Phase 1 Verification
- [ ] Old Chrome/VNC files removed
- [ ] Dockerfile cleaned of old dependencies

### Phase 2 Verification
- [ ] XFCE4 packages installed
- [ ] TigerVNC installed
- [ ] Fonts installed

### Phase 3 Verification
- [ ] Playwright installed globally
- [ ] Chromium installed via Playwright
- [ ] `which chromium` returns path

### Phase 4 Verification
- [ ] VNC configuration directory exists
- [ ] xstartup script created

### Phase 5 Verification
- [ ] DISPLAY=:0 set

### Phase 6 Verification
- [ ] Container starts without errors
- [ ] VNC starts automatically
- [ ] Port 5900 accessible

### Phase 7 Verification
- [ ] `devvy vnc` command works
- [ ] Shows correct connection info

### Phase 8 Verification
- [ ] Can connect via VNC from Mac
- [ ] XFCE desktop appears
- [ ] Chromium launches and displays
- [ ] Playwright can control browser

---

## Key Differences Summary

| Component | Old Setup | New Setup (browser-use-mcp-server) |
|-----------|-----------|-------------------------------------|
| VNC Server | x11vnc | TigerVNC |
| Desktop | Fluxbox | XFCE4 |
| Browser | Google Chrome | Chromium |
| Display | :99 | :0 |
| VNC Management | Manual start/stop | Automatic on container start |
| Browser Install | apt-get | Playwright |
| VNC Port | 5900 | 5900 (same) |

---

## Implementation Order

1. **Phase 1**: Remove old implementation (5 minutes)
2. **Phase 2**: Add new dependencies (2 minutes)
3. **Phase 3**: Install Chromium (2 minutes)
4. **Phase 4**: Configure VNC (1 minute)
5. **Phase 5**: Set environment variables (1 minute)
6. **Phase 6**: Update entrypoint (2 minutes)
7. **Phase 7**: Update TypeScript command (2 minutes)
8. **Phase 8**: Create documentation (2 minutes)
9. **Rebuild**: `devvy rebuild` (5-10 minutes)
10. **Test**: Verify VNC and Chromium work (5 minutes)

Total estimated time: 25-30 minutes

---

## Success Criteria

The implementation is successful when:
1. Container starts with VNC running automatically
2. Can connect to VNC at `vnc://localhost:5900`
3. XFCE desktop appears in VNC viewer
4. Chromium launches with `DISPLAY=:0 chromium --no-sandbox`
5. Playwright can control Chromium with `headless: false`
6. No manual VNC start/stop required