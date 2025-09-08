import * as os from 'node:os';
import * as path from 'node:path';

import { ConfigService } from '@services/config.service';
import { logger } from '@utils/logger';
import { execAsync } from '@utils/shell';
import * as fs from 'fs-extra';

export class SSHService {
  private static instance: SSHService;
  private readonly config: ConfigService;
  private readonly sshDir: string;
  private readonly knownHostsPath: string;

  private constructor() {
    this.config = ConfigService.getInstance();
    this.sshDir = path.join(os.homedir(), '.ssh');
    this.knownHostsPath = path.join(this.sshDir, 'known_hosts');
  }

  public static getInstance(): SSHService {
    if (!SSHService.instance) {
      SSHService.instance = new SSHService();
    }
    return SSHService.instance;
  }

  public async generateSSHKey(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const keyName = 'devvy_rsa';
    const privateKeyPath = path.join(this.sshDir, keyName);
    const publicKeyPath = `${privateKeyPath}.pub`;

    await fs.ensureDir(this.sshDir);

    if (await fs.pathExists(privateKeyPath)) {
      logger.debug('SSH key already exists, using existing key');
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      return { publicKey, privateKey: privateKeyPath };
    }

    logger.info('Generating SSH key pair...');
    const { stderr } = await execAsync(`ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "devvy@localhost"`);

    if (stderr && !stderr.includes('Generating public/private')) {
      throw new Error(`Failed to generate SSH key: ${stderr}`);
    }

    await fs.chmod(privateKeyPath, 0o600);

    const publicKey = await fs.readFile(publicKeyPath, 'utf8');
    logger.success('SSH key generated successfully');

    return { publicKey, privateKey: privateKeyPath };
  }

  public async removeKnownHost(host: string, port: number): Promise<void> {
    try {
      const hostPattern = port === 22 ? host : `[${host}]:${port}`;
      logger.debug(`Removing known host: ${hostPattern}`);

      const { stderr } = await execAsync(`ssh-keygen -R "${hostPattern}"`);

      if (stderr && !stderr.includes('not found in')) {
        logger.debug(`Known host removal notice: ${stderr}`);
      }
    } catch {
      logger.debug('No existing known host to remove');
    }
  }

  public async addKnownHost(host: string, port: number): Promise<void> {
    try {
      const hostPattern = port === 22 ? host : `[${host}]:${port}`;
      logger.debug(`Adding known host: ${hostPattern}`);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { stdout, stderr } = await execAsync(`ssh-keyscan -p ${port} -H ${host} 2>/dev/null`);

      if (stderr) {
        logger.debug(`SSH keyscan notice: ${stderr}`);
      }

      if (stdout) {
        await fs.ensureFile(this.knownHostsPath);
        await fs.appendFile(this.knownHostsPath, stdout);
        logger.debug('Known host added successfully');
      }
    } catch {
      logger.warn('Could not add known host automatically');
      logger.info('You may need to accept the host key on first connection');
    }
  }

  public async manageKnownHosts(action: 'add' | 'remove', host?: string, port?: number): Promise<void> {
    const sshConfig = this.config.getSshConfig();
    const targetHost = host || 'localhost';
    const targetPort = port || sshConfig.port;

    await (action === 'remove' ? this.removeKnownHost(targetHost, targetPort) : this.addKnownHost(targetHost, targetPort));
  }

  public async cleanupSSHKeys(): Promise<void> {
    const keyName = 'devvy_rsa';
    const privateKeyPath = path.join(this.sshDir, keyName);
    const publicKeyPath = `${privateKeyPath}.pub`;

    try {
      if (await fs.pathExists(privateKeyPath)) {
        await fs.remove(privateKeyPath);
        logger.debug('Removed private SSH key');
      }

      if (await fs.pathExists(publicKeyPath)) {
        await fs.remove(publicKeyPath);
        logger.debug('Removed public SSH key');
      }
    } catch (error) {
      logger.debug('Error cleaning up SSH keys:', error as Record<string, unknown>);
    }
  }

  public getSSHConfig(): {
    user: string;
    host: string;
    port: number;
    keyPath: string;
  } {
    const sshConfig = this.config.getSshConfig();
    const keyName = 'devvy_rsa';
    const keyPath = path.join(this.sshDir, keyName);

    return {
      user: sshConfig.user,
      host: 'localhost',
      port: sshConfig.port,
      keyPath,
    };
  }

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

  public async copySSHKeyToContainer(containerName: string): Promise<void> {
    const { publicKey } = await this.generateSSHKey();

    const authorizedKeysContent = publicKey.trim();
    const tempFile = `/tmp/devvy_authorized_keys_${Date.now()}`;

    await fs.writeFile(tempFile, authorizedKeysContent);

    try {
      await execAsync(`docker cp "${tempFile}" ${containerName}:/home/claude/.ssh/authorized_keys`);

      await execAsync(`docker exec ${containerName} chown claude:claude /home/claude/.ssh/authorized_keys`);

      await execAsync(`docker exec ${containerName} chmod 600 /home/claude/.ssh/authorized_keys`);

      logger.debug('SSH key copied to container');
    } finally {
      await fs.remove(tempFile);
    }
  }
}
