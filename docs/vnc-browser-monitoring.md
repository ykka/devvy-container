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

If Chromium doesn't launch:
1. Ensure DISPLAY is set: `echo $DISPLAY` (should show `:0`)
2. Check Chromium installation: `which chromium`
3. Try with more flags: `chromium --no-sandbox --disable-dev-shm-usage --disable-gpu`

If you see a black screen:
1. XFCE might not have started properly
2. Try restarting the container: `devvy rebuild`
3. Check VNC logs: `vncserver -list`

## Implementation Details

This setup follows the [browser-use-mcp-server](https://github.com/co-browser/browser-use-mcp-server) approach:
- **VNC Server**: TigerVNC (more stable than x11vnc)
- **Desktop**: XFCE4 (full desktop environment)
- **Browser**: Chromium (installed via Playwright)
- **Display**: `:0` (standard display number)
- **Auto-start**: VNC starts with container (no manual commands needed)