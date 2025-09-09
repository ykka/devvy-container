// Re-export user config management

// Re-export default values
export { getDefaultLazyvimPath, getDefaultProjectsPath, getDefaultTmuxPath } from './defaults';
// Re-export environment management
export {
  type EnvConfig,
  envSchema,
  generateEnvFile,
  loadEnvConfig,
  validateEnvironment,
} from './environment';
export {
  getUserConfig,
  loadUserConfig,
  saveUserConfig,
  type UserConfig,
  userConfigExists,
  userConfigSchema,
} from './user-config';
