import * as os from 'node:os';
import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { ConfigService } from '@services/config.service';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { execAsync } from '@utils/shell';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export class SSHService {
  private static instance: SSHService;
  private readonly config: ConfigService;
  private readonly secretsDir: string;
  private readonly knownHostsPath: string;

  private constructor() {
    this.config = ConfigService.getInstance();
    this.secretsDir = path.join(this.config.getProjectRoot(), 'secrets');
    this.knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');
  }

  public static getInstance(): SSHService {
    if (!SSHService.instance) {
      SSHService.instance = new SSHService();
    }
    return SSHService.instance;
  }

  /**
   * Generate host SSH key pair on the local machine for connecting to the container.
   * The private key stays on the local machine, public key goes to container's authorized_keys.
   */
  public async generateHostSSHKey(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const keyName = CONSTANTS.SSH.KEY_NAME;
    const privateKeyPath = path.join(this.secretsDir, keyName);
    const publicKeyPath = `${privateKeyPath}.pub`;

    await fs.ensureDir(this.secretsDir);

    // Use existing key if available
    if (await fs.pathExists(privateKeyPath)) {
      logger.debug('Host SSH key already exists, using existing key');
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');

      // Also create authorized_keys file from the public key
      const authorizedKeysPath = path.join(this.secretsDir, 'authorized_keys');
      await fs.writeFile(authorizedKeysPath, publicKey);

      return { publicKey, privateKey: privateKeyPath };
    }

    // Generate new key pair
    logger.info('Generating SSH key pair on local machine...');
    const { stderr } = await execAsync(`ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "${CONSTANTS.DOCKER.CONTAINER_NAME}"`);

    if (stderr && !stderr.includes('Generating public/private')) {
      throw new Error(`Failed to generate SSH key: ${stderr}`);
    }

    await fs.chmod(privateKeyPath, 0o600);

    const publicKey = await fs.readFile(publicKeyPath, 'utf8');

    // Create authorized_keys file from the public key
    const authorizedKeysPath = path.join(this.secretsDir, 'authorized_keys');
    await fs.writeFile(authorizedKeysPath, publicKey);

    logger.success('Host SSH key generated successfully');

    return { publicKey, privateKey: privateKeyPath };
  }

  /**
   * Remove container SSH key from host known_hosts
   */
  public async removeContainerSSHKeyFromHostKnownHosts(host = 'localhost', port?: number): Promise<void> {
    const sshConfig = this.config.getSshConfig();
    const targetPort = port || sshConfig.port;
    const hostPattern = targetPort === 22 ? host : `[${host}]:${targetPort}`;

    try {
      // Use ssh-keygen to remove the entry
      await execAsync(`ssh-keygen -R "${hostPattern}" 2>&1`);
      logger.debug("Removed container's SSH key from host's known_hosts");
    } catch {
      // It's okay if the entry doesn't exist
      logger.debug("No existing container SSH key to remove from host's known_hosts");
    }
  }

  /**
   * Add container SSH key to host known_hosts
   */
  public async addContainerSSHKeyToHostKnownHosts(host = 'localhost', port?: number): Promise<boolean> {
    const sshConfig = this.config.getSshConfig();
    const targetPort = port || sshConfig.port;

    try {
      // Wait a bit for SSH service to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Scan for the container's SSH key
      const { stdout } = await execAsync(`ssh-keyscan -p ${targetPort} -H ${host} 2>/dev/null`);

      if (!stdout) {
        logger.warn("Could not retrieve container's SSH key");
        return false;
      }

      console.log(`\nContainer's SSH key found for [${host}]:${targetPort}`);
      const shouldAdd = await prompt.confirm(`Add to host's ${this.knownHostsPath}?`, true);

      if (!shouldAdd) {
        logger.info("Container's SSH key not added. You will need to accept it manually on first connection.");
        return false;
      }

      // Add to host's known_hosts
      await fs.ensureFile(this.knownHostsPath);
      await fs.appendFile(this.knownHostsPath, stdout);
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
  public async updateContainerKeyForRebuild(host = 'localhost', port?: number): Promise<void> {
    const sshConfig = this.config.getSshConfig();
    const targetPort = port || sshConfig.port;

    console.log(chalk.yellow('\n⚠️  Container rebuild will generate new SSH keys'));
    console.log(chalk.gray(`This affects [${host}]:${targetPort} in host's known_hosts: ${this.knownHostsPath}`));

    // Remove old container SSH key from host known_hosts
    await this.removeContainerSSHKeyFromHostKnownHosts(host, targetPort);

    console.log("Old container's SSH key removed from host's known_hosts. New key will be added after rebuild.");
  }

  /**
   * Copy host's public SSH key to container
   */
  public async copyPublicSSHKeyToContainer(containerName: string): Promise<void> {
    await this.generateHostSSHKey(); // This creates the authorized_keys file in secrets dir

    const authorizedKeysPath = path.join(this.secretsDir, 'authorized_keys');

    // Copy authorized_keys file to container
    await execAsync(`docker cp "${authorizedKeysPath}" ${containerName}:/home/devvy/.ssh/authorized_keys`);

    // Set proper ownership and permissions
    await execAsync(`docker exec ${containerName} chown devvy:devvy /home/devvy/.ssh/authorized_keys`);
    await execAsync(`docker exec ${containerName} chmod 600 /home/devvy/.ssh/authorized_keys`);

    logger.debug("Host SSH public key copied to container's authorized_keys");
  }

  /**
   * Clean up host's SSH keys
   */
  public async cleanupHostSSHKeys(): Promise<void> {
    try {
      if (await fs.pathExists(this.secretsDir)) {
        await fs.remove(this.secretsDir);
        logger.debug('Removed host SSH keys from local machine');
      }
    } catch (error) {
      logger.debug('Error cleaning up SSH keys:', error as Record<string, unknown>);
    }
  }

  /**
   * Get SSH configuration for connecting to container
   */
  public getSSHConfig(): {
    user: string;
    host: string;
    port: number;
    keyPath: string;
  } {
    const sshConfig = this.config.getSshConfig();
    const keyPath = path.join(this.secretsDir, CONSTANTS.SSH.KEY_NAME);

    return {
      user: sshConfig.user,
      host: 'localhost',
      port: sshConfig.port,
      keyPath,
    };
  }

  /**
   * Test SSH connection to container
   */
  public async testSSHConnection(): Promise<boolean> {
    try {
      const config = this.getSSHConfig();
      const { stderr } = await execAsync(
        `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${config.port} ${config.user}@${config.host} "echo test" 2>&1`,
      );

      return !stderr || stderr.length === 0;
    } catch {
      return false;
    }
  }
}
