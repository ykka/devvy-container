import * as os from 'node:os';
import * as path from 'node:path';

export const CONSTANTS = {
  VERSION: '1.0.0',

  // Docker configuration
  DOCKER: {
    COMPOSE_FILE: 'docker-compose.yml',
    PROJECT_NAME: 'claude-devvy-container',
    CONTAINER_NAME: 'claude-devvy-container',
  },

  // Container user
  CONTAINER_USER_NAME: 'devvy',

  // SSH configuration
  SSH: {
    PORT: 2222,
    KEY_NAME: 'host_rsa', // SSH key on local/host machine for connecting to container
    GITHUB_KEY_NAME: 'github_rsa', // SSH key for GitHub authentication
    GITHUB_KEY_DIR: 'github', // Directory for GitHub SSH keys within secrets
  },

  // Port ranges for development
  PORTS: {
    DEV_SERVERS: '3000-3010', // Node.js, React, Vue, etc.
    WEBSOCKET: '8080-8090', // WebSocket and alternative HTTP
    HTTPS: 443, // Standard HTTPS/TLS
    HTTPS_ALT: 8443, // Alternative HTTPS
    MOSH_UDP: '60000-60010', // Mosh UDP
    ANGULAR: 4200, // Angular dev server
    FLASK: 5000, // Flask/Python web servers
    VITE: 5173, // Vite dev server
    POSTGRESQL: 5432, // PostgreSQL database
    REDIS: 6379, // Redis cache/database
    DJANGO: 8000, // Django/Python alternate
    PHP_FPM: 9000, // PHP-FPM
    NODE_DEBUG: 9229, // Node.js debugger
    MONGODB: 27017, // MongoDB database
    MYSQL: 3306, // MySQL/MariaDB database
  },

  // Host paths (relative to project root)
  HOST_PATHS: {
    ENV_FILE: '.env',
    SECRETS_DIR: 'secrets',
  },

  // Default paths
  DEFAULT_PATHS: {
    PROJECTS: path.join(os.homedir(), 'Repos', 'devvy-repos'),
    LAZYVIM_CONFIG: path.join(os.homedir(), '.config', 'nvim'),
    TMUX_CONFIG: path.join(os.homedir(), '.config', 'tmux'),
  },

  // Logging
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
  },
} as const;
