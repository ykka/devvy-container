# VNC Browser Monitoring

This guide explains how to monitor Chrome/Playwright running inside the container from your Mac.

## Architecture

- **Claude Code** runs inside the container
- **Playwright MCP** is managed by Claude Code inside the container
- **Chrome** runs on a virtual display (`:99`) inside the container
- **VNC Server** allows you to view the virtual display from your Mac

## Starting VNC Server

After connecting to the container:

```bash
# Start the VNC server and virtual display
start-vnc

# Or manually:
/usr/local/bin/start-vnc.sh
```

This will:
1. Start Xvfb (virtual display) on `:99`
2. Start Fluxbox window manager
3. Start x11vnc server on port 5900
4. Set default VNC password to `devvy`

## Connecting from Your Mac

### Option 1: Built-in macOS Screen Sharing

1. Open Finder
2. Press `Cmd+K` (Connect to Server)
3. Enter: `vnc://localhost:5900`
4. Password: `devvy`

### Option 2: VNC Client

Use any VNC client (RealVNC, TigerVNC, etc.) and connect to:
- Host: `localhost`
- Port: `5900`
- Password: `devvy`

## Running Chrome

Once VNC is running, you can launch Chrome:

```bash
# Inside the container
DISPLAY=:99 google-chrome --no-sandbox
```

## Using with Playwright MCP

When configuring Playwright MCP in Claude Code settings, ensure it uses the virtual display:

```javascript
// Example Playwright configuration
const browser = await chromium.launch({
  headless: false,  // Run with GUI
  args: ['--display=:99', '--no-sandbox']
});
```

## Stopping VNC

```bash
# Stop all VNC-related processes
stop-vnc

# Or manually:
/usr/local/bin/stop-vnc.sh
```

## Changing VNC Password

To change the default password:

```bash
# Inside the container
vncpasswd
```

## Troubleshooting

### Cannot connect to VNC
- Ensure port 5900 is exposed in docker-compose.yml
- Check if VNC is running: `pgrep x11vnc`
- Verify the virtual display: `DISPLAY=:99 xdpyinfo`

### Chrome won't start
- Always use `--no-sandbox` flag in container
- Ensure DISPLAY is set to `:99`
- Check Chrome installation: `which google-chrome`

### Black screen in VNC
- Fluxbox might not be running: `pgrep fluxbox`
- Restart VNC: `stop-vnc && start-vnc`