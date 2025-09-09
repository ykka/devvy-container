import * as os from 'node:os';
import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { execAsync } from '@utils/shell';
import chalk from 'chalk';
import * as fs from 'fs-extra';

// Module-level constants
const projectRoot = process.cwd();
const secretsDir = path.join(projectRoot, 'secrets');
const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');

/**
 * Generate host SSH key pair on the local machine for connecting to the container.
 * The private key stays on the local machine, public key goes to container's authorized_keys.
 */
export async function generateHostSSHKey(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyName = CONSTANTS.SSH.KEY_NAME;
  const privateKeyPath = path.join(secretsDir, keyName);
  const publicKeyPath = `${privateKeyPath}.pub`;

  await fs.ensureDir(secretsDir);

  // Use existing key if available
  if (await fs.pathExists(privateKeyPath)) {
    logger.debug('Host SSH key already exists, using existing key');
    const publicKey = await fs.readFile(publicKeyPath, 'utf8');

    // Also create authorized_keys file from the public key
    const authorizedKeysPath = path.join(secretsDir, 'authorized_keys');
    await fs.writeFile(authorizedKeysPath, publicKey);

    return { publicKey, privateKey: privateKeyPath };
  }

  // Generate new key pair
  logger.info('Generating SSH key pair on local machine...');
  const result = await execAsync('ssh-keygen', ['-t', 'rsa', '-b', '4096', '-f', privateKeyPath, '-N', '', '-C', CONSTANTS.DOCKER.CONTAINER_NAME]);

  if (!result.success) {
    throw new Error(`Failed to generate SSH key: ${result.stderr || 'Unknown error'}`);
  }

  await fs.chmod(privateKeyPath, 0o600);

  const publicKey = await fs.readFile(publicKeyPath, 'utf8');

  // Create authorized_keys file from the public key
  const authorizedKeysPath = path.join(secretsDir, 'authorized_keys');
  await fs.writeFile(authorizedKeysPath, publicKey);

  logger.success('Host SSH key generated successfully');

  return { publicKey, privateKey: privateKeyPath };
}

/**
 * Remove container SSH key from host known_hosts
 */
export async function removeContainerSSHKeyFromHostKnownHosts(host = 'localhost', port = CONSTANTS.SSH.PORT): Promise<void> {
  const hostPattern = port.toString() === '22' ? host : `[${host}]:${port}`;

  try {
    // Use ssh-keygen to remove the entry
    await execAsync('ssh-keygen', ['-R', hostPattern]);
    logger.debug("Removed container's SSH key from host's known_hosts");
  } catch {
    // It's okay if the entry doesn't exist
    logger.debug("No existing container SSH key to remove from host's known_hosts");
  }
}

/**
 * Add container SSH key to host known_hosts
 */
export async function addContainerSSHKeyToHostKnownHosts(host = 'localhost', port = CONSTANTS.SSH.PORT): Promise<boolean> {
  try {
    // Wait for SSH service to be ready with retries
    let sshReady = false;
    let attempts = 0;
    const maxAttempts = 15; // Increased from 10
    let sshKeyOutput = '';

    logger.debug('Waiting for SSH service to be ready...');

    // Initial wait for container to start services
    await new Promise((resolve) => setTimeout(resolve, 3000));

    while (!sshReady && attempts < maxAttempts) {
      // Try to scan for the SSH key
      const { stdout, exitCode } = await execAsync('ssh-keyscan', [
        '-p',
        port.toString(),
        '-H',
        host,
        '-T',
        '5', // 5 second timeout
      ]);

      if (stdout && exitCode === 0) {
        sshReady = true;
        sshKeyOutput = stdout;
      } else {
        // Wait before next attempt
        logger.debug(`SSH service not ready yet (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      attempts++;
    }

    if (!sshReady || !sshKeyOutput) {
      logger.warn("Could not retrieve container's SSH key after multiple attempts");
      return false;
    }

    console.log(`\nContainer's SSH key found for [${host}]:${port}`);
    const shouldAdd = await prompt.confirm(`Add to host's ${knownHostsPath}?`, true);

    if (!shouldAdd) {
      logger.info("Container's SSH key not added. You will need to accept it manually on first connection.");
      return false;
    }

    // Add to host's known_hosts
    await fs.ensureFile(knownHostsPath);
    await fs.appendFile(knownHostsPath, sshKeyOutput);
    logger.success("Container's SSH key added to host's known_hosts");

    return true;
  } catch (error) {
    logger.error("Failed to add container's SSH key:", error as Record<string, unknown>);
    return false;
  }
}

/**
 * Update container SSH key for rebuild
 */
export async function updateContainerKeyForRebuild(host = 'localhost', port = CONSTANTS.SSH.PORT): Promise<void> {
  console.log(chalk.yellow("\n⚠️  Container rebuild will regenerate the container's SSH host key"));
  console.log(chalk.gray(`The container's SSH host key is used to verify you're connecting to the correct container`));
  console.log(chalk.gray(`This is separate from the GitHub SSH key (devvy_github_ed25519) used for git operations`));
  console.log(chalk.gray(`Updating entry [${host}]:${port} in ${knownHostsPath}`));

  // Remove old container SSH key from host known_hosts
  await removeContainerSSHKeyFromHostKnownHosts(host, port);

  console.log(`Removed previous container's fingerprint from your known_hosts file`);
  console.log(`The new container's fingerprint will be automatically added when it starts`);
}

/**
 * Clean up host's SSH keys
 */
export async function cleanupHostSSHKeys(): Promise<void> {
  try {
    if (await fs.pathExists(secretsDir)) {
      await fs.remove(secretsDir);
      logger.debug('Removed host SSH keys from local machine');
    }
  } catch (error) {
    logger.debug('Error cleaning up SSH keys:', error as Record<string, unknown>);
  }
}

/**
 * Get SSH configuration for connecting to container
 */
export function getSSHConfig(): {
  user: string;
  host: string;
  port: number;
  keyPath: string;
} {
  const keyPath = path.join(secretsDir, CONSTANTS.SSH.KEY_NAME);

  return {
    user: CONSTANTS.CONTAINER_USER_NAME,
    host: 'localhost',
    port: CONSTANTS.SSH.PORT,
    keyPath,
  };
}

/**
 * Generate GitHub SSH key pair on the local machine for authenticating with GitHub.
 * The keys are stored in secrets/github/ directory and persist across rebuilds.
 */
export async function generateGitHubSSHKey(regenerate = false): Promise<{
  publicKey: string;
  privateKeyPath: string;
  existed: boolean;
}> {
  const privateKeyPath = getGitHubSSHKeyFullPath();
  const publicKeyPath = `${privateKeyPath}.pub`;
  const githubKeysDir = path.dirname(privateKeyPath);

  await fs.ensureDir(githubKeysDir);

  // Check if key already exists
  if ((await fs.pathExists(privateKeyPath)) && !regenerate) {
    logger.debug('GitHub SSH key already exists, using existing key');
    const publicKey = await fs.readFile(publicKeyPath, 'utf8');
    return { publicKey, privateKeyPath, existed: true };
  }

  // Remove old keys if regenerating
  if (regenerate && (await fs.pathExists(privateKeyPath))) {
    await fs.remove(privateKeyPath);
    await fs.remove(publicKeyPath);
    logger.info('Removing existing GitHub SSH key for regeneration');
  }

  // Generate new key pair
  logger.info('Generating GitHub SSH key pair...');
  const comment = `devvy-github-${new Date().toISOString().split('T')[0]}`;
  const result = await execAsync('ssh-keygen', ['-t', 'rsa', '-b', '4096', '-f', privateKeyPath, '-N', '', '-C', comment]);

  if (!result.success) {
    throw new Error(`Failed to generate GitHub SSH key: ${result.stderr || 'Unknown error'}`);
  }

  await fs.chmod(privateKeyPath, 0o600);

  const publicKey = await fs.readFile(publicKeyPath, 'utf8');
  logger.success('GitHub SSH key generated successfully');

  return { publicKey, privateKeyPath, existed: false };
}

/**
 * Get the full absolute path to the GitHub SSH private key (for internal use)
 */
function getGitHubSSHKeyFullPath(): string {
  return path.join(secretsDir, CONSTANTS.SSH.GITHUB_KEY_DIR, CONSTANTS.SSH.GITHUB_KEY_NAME);
}

/**
 * Check if GitHub SSH key exists
 */
export async function gitHubSSHKeyExists(): Promise<boolean> {
  return fs.pathExists(getGitHubSSHKeyFullPath());
}

/**
 * Get the relative path to the GitHub SSH private key (for display purposes)
 */
export function getGitHubSSHKeyPath(): string {
  return path.join('secrets', CONSTANTS.SSH.GITHUB_KEY_DIR, CONSTANTS.SSH.GITHUB_KEY_NAME);
}
