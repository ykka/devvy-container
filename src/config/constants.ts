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
  },

  // Host paths (relative to project root)
  HOST_PATHS: {
    ENV_FILE: '.env',
    SECRETS_DIR: 'secrets',
    VSCODE_CONFIG_DIR: 'vscode-config',
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
