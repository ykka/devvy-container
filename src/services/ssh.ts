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
    // Wait a bit for SSH service to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Scan for the container's SSH key
    const { stdout } = await execAsync('ssh-keyscan', ['-p', port.toString(), '-H', host]);

    if (!stdout) {
      logger.warn("Could not retrieve container's SSH key");
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
    await fs.appendFile(knownHostsPath, stdout);
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
  console.log(chalk.yellow('\n⚠️  Container rebuild will generate new SSH keys'));
  console.log(chalk.gray(`This affects [${host}]:${port} in host's known_hosts: ${knownHostsPath}`));

  // Remove old container SSH key from host known_hosts
  await removeContainerSSHKeyFromHostKnownHosts(host, port);

  console.log("Old container's SSH key removed from host's known_hosts. New key will be added after rebuild.");
}

/**
 * Copy host's public SSH key to container
 */
export async function copyPublicSSHKeyToContainer(containerName: string): Promise<void> {
  await generateHostSSHKey(); // This creates the authorized_keys file in secrets dir

  const authorizedKeysPath = path.join(secretsDir, 'authorized_keys');

  // Copy authorized_keys file to container
  await execAsync('docker', ['cp', authorizedKeysPath, `${containerName}:/home/devvy/.ssh/authorized_keys`]);

  // Set proper ownership and permissions
  await execAsync('docker', ['exec', containerName, 'chown', 'devvy:devvy', '/home/devvy/.ssh/authorized_keys']);
  await execAsync('docker', ['exec', containerName, 'chmod', '600', '/home/devvy/.ssh/authorized_keys']);

  logger.debug("Host SSH public key copied to container's authorized_keys");
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
    user: CONSTANTS.CONTAINER_USER.NAME,
    host: 'localhost',
    port: CONSTANTS.SSH.PORT,
    keyPath,
  };
}

/**
 * Test SSH connection to container
 */
export async function testSSHConnection(): Promise<boolean> {
  try {
    const config = getSSHConfig();
    const { stderr } = await execAsync('ssh', [
      '-o',
      'ConnectTimeout=5',
      '-o',
      'StrictHostKeyChecking=no',
      '-p',
      config.port.toString(),
      `${config.user}@${config.host}`,
      'echo test',
    ]);

    return !stderr || stderr.length === 0;
  } catch {
    return false;
  }
}
