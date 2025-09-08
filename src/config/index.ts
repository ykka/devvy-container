// Re-export runtime config functions

// Re-export default values
export { getDefaultLazyvimPath, getDefaultProjectsPath, getDefaultTmuxPath } from './defaults';
// Re-export path utilities
export { getAbsolutePath, getConfigPath, getEnvPath, getProjectRoot } from './paths';
export {
  configExists,
  type DevvyConfig,
  devvyConfigSchema,
  type EnvConfig,
  envSchema,
  expandPath,
  generateEnvFile,
  getConfig,
  getEnvConfig,
  loadConfig,
  loadEnvConfig,
  saveConfig,
  validateEnvironment,
} from './runtime';
