export const CONSTANTS = {
  APP_NAME: 'devvy-cli',
  VERSION: '2.0.0',

  // Docker configuration
  DOCKER: {
    COMPOSE_FILE: 'docker-compose.yml',
    PROJECT_NAME: 'claude-devvy-container',
    CONTAINER_NAME: 'claude-devvy-container',
    IMAGE: 'claude-devvy-image',
  },

  // User and paths inside container
  CONTAINER_USER: {
    NAME: 'devvy',
    HOME: '/home/devvy',
    REPOS_PATH: '/home/devvy/repos',
  },

  // SSH configuration
  SSH: {
    PORT: 2222,
    KEY_NAME: 'container_rsa',
    CONFIG_FILE: 'config',
    KNOWN_HOSTS: 'known_hosts',
  },

  // Host paths (relative to project root)
  HOST_PATHS: {
    ENV_FILE: '.env',
    SECRETS_DIR: 'secrets',
    VSCODE_CONFIG_DIR: 'vscode-config',
    CONTAINER_SCRIPTS_DIR: 'container-scripts',
  },

  // VS Code configuration
  VSCODE: {
    SYNC_ENABLED: true,
  },

  // Command execution
  COMMANDS: {
    TIMEOUT: 30_000,
    MAX_RETRIES: 3,
  },

  // Logging
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE: 'devvy.log',
  },
} as const;
