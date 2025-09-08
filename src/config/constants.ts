export const CONSTANTS = {
  APP_NAME: 'devvy-cli',
  VERSION: '2.0.0',

  CONTAINER: {
    NAME: 'claude-devvy-container',
    IMAGE: 'claude-devvy-image',
    WORKSPACE_PATH: '/home/developer/projects',
    DEFAULT_PORT: 2222,
  },

  PATHS: {
    DOCKER_COMPOSE: 'docker-compose.yml',
    DOCKERFILE: 'Dockerfile',
    ENV_FILE: '.env',
    SECRETS_DIR: 'secrets',
    VSCODE_CONFIG_DIR: 'vscode-config',
    CONTAINER_SCRIPTS_DIR: 'container-scripts',
  },

  SSH: {
    KEY_NAME: 'id_rsa',
    CONFIG_FILE: 'config',
    KNOWN_HOSTS: 'known_hosts',
  },

  COMMANDS: {
    TIMEOUT: 30_000,
    MAX_RETRIES: 3,
  },

  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    FILE: 'devvy.log',
  },
} as const;
