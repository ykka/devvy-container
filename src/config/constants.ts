export const CONSTANTS = {
  APP_NAME: 'devvy-cli',
  VERSION: '1.0.0',

  // Docker configuration
  DOCKER: {
    COMPOSE_FILE: 'docker-compose.yml',
    PROJECT_NAME: 'claude-devvy-container',
    CONTAINER_NAME: 'claude-devvy-container',
  },

  // User and paths inside container
  CONTAINER_USER: {
    NAME: 'devvy',
    REPOS_PATH: '/home/devvy/repos',
  },

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

  // Logging
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
  },
} as const;
