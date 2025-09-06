import type { AppConfig } from './schema'

export const DEFAULT_CONFIG: AppConfig = {
  docker: {
    composeFile: 'docker-compose.yml',
    projectName: 'claude-docker',
    containerName: 'claude-dev',
  },
  ssh: {
    port: 2222,
    user: 'developer',
  },
  workspace: {
    containerPath: '/home/developer/projects',
  },
  vscode: {
    syncEnabled: true,
  },
  logging: {
    level: 'info',
  },
}
