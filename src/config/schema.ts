import { z } from 'zod';

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

  // Database URLs
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

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
  docker: z.object({
    composeFile: z.string().default('docker-compose.yml'),
    projectName: z.string().default('claude-devvy-container'),
    containerName: z.string().default('claude-devvy-container'),
  }),
  ssh: z.object({
    port: z.number().default(2222),
    keyPath: z.string().optional(),
    user: z.string().default('developer'),
  }),
  workspace: z.object({
    hostPath: z.string().optional(),
    containerPath: z.string().default('/home/developer/projects'),
  }),
  vscode: z.object({
    settingsPath: z.string().optional(),
    extensionsPath: z.string().optional(),
    syncEnabled: z.boolean().default(true),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().optional(),
  }),
});

export type EnvConfig = z.infer<typeof envSchema>;
export type DockerComposeConfig = z.infer<typeof dockerComposeSchema>;
export type AppConfig = z.infer<typeof configSchema>;
