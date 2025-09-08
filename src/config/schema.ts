import { z } from 'zod';
import { CONSTANTS } from './constants';

export const envSchema = z.object({
  // User Configuration for runtime UID/GID matching
  HOST_UID: z.string().regex(/^\d+$/).default('1000'),
  HOST_GID: z.string().regex(/^\d+$/).default('1000'),

  // Git Configuration
  GIT_USER_NAME: z.string().default('Your Name'),
  GIT_USER_EMAIL: z.string().email().or(z.string()).default('your.email@example.com'),

  // Optional Integrations
  GITHUB_TOKEN: z.string().optional(),
  LINEAR_API_KEY: z.string().optional(),

  // Docker/System (for backward compatibility)
  DOCKER_HOST: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export const dockerComposeSchema = z.object({
  version: z.string(),
  services: z.record(
    z.object({
      build: z
        .union([
          z.string(),
          z.object({
            context: z.string(),
            dockerfile: z.string().optional(),
            args: z.record(z.string()).optional(),
          }),
        ])
        .optional(),
      image: z.string().optional(),
      container_name: z.string().optional(),
      ports: z.array(z.string()).optional(),
      volumes: z.array(z.string()).optional(),
      environment: z.union([z.array(z.string()), z.record(z.string())]).optional(),
      restart: z.string().optional(),
      networks: z.array(z.string()).optional(),
    }),
  ),
  networks: z.record(z.any()).optional(),
  volumes: z.record(z.any()).optional(),
});

export const configSchema = z.object({
  docker: z
    .object({
      composeFile: z.string().default(CONSTANTS.DOCKER.COMPOSE_FILE),
      projectName: z.string().default(CONSTANTS.DOCKER.PROJECT_NAME),
      containerName: z.string().default(CONSTANTS.DOCKER.CONTAINER_NAME),
    })
    .default({}),
  ssh: z
    .object({
      port: z.number().default(CONSTANTS.SSH.PORT),
      keyPath: z.string().optional(),
      user: z.string().default(CONSTANTS.CONTAINER_USER.NAME),
    })
    .default({}),
  workspace: z
    .object({
      hostPath: z.string().optional(),
      mountPath: z.string().default(CONSTANTS.CONTAINER_USER.REPOS_PATH),
    })
    .default({}),
  vscode: z
    .object({
      settingsPath: z.string().optional(),
      extensionsPath: z.string().optional(),
      syncEnabled: z.boolean().default(CONSTANTS.VSCODE.SYNC_ENABLED),
    })
    .default({}),
  logging: z
    .object({
      level: z.enum(['error', 'warn', 'info', 'debug']).default(CONSTANTS.LOGGING.LEVEL as 'info'),
      file: z.string().optional(),
    })
    .default({}),
});

export type EnvConfig = z.infer<typeof envSchema>;
export type DockerComposeConfig = z.infer<typeof dockerComposeSchema>;
export type AppConfig = z.infer<typeof configSchema>;
