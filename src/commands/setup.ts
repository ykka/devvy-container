import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { ConfigService } from '@services/config.service';
import { SSHService } from '@services/ssh.service';
import { VSCodeService } from '@services/vscode.service';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { commandExists, exec } from '@utils/shell';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export async function setupCommand(): Promise<void> {
  try {
    logger.box('Devvy Setup Wizard');
    logger.info('This wizard will help you set up your development environment.\n');

    const config = ConfigService.getInstance();
    const projectRoot = config.getProjectRoot();

    const steps = [checkDockerInstallation, checkDockerCompose, createDirectories, generateSSHKeys, setupGitConfig, setupVSCodeSync, createEnvFile];

    for (const step of steps) {
      await step(projectRoot);
    }

    logger.success('\n✨ Setup completed successfully!');
    logger.info('\nNext steps:');
    logger.step(`1. Start the container: ${chalk.cyan('devvy start')}`);
    logger.step(`2. Connect to it: ${chalk.cyan('devvy connect')}`);
    logger.step(`3. Start coding! 🚀`);
  } catch (error) {
    logger.error('Setup failed', error);
    process.exit(1);
  }
}

async function checkDockerInstallation(_projectRoot: string): Promise<void> {
  const spinner = new Spinner('Checking Docker installation...');
  spinner.start();

  if (!(await commandExists('docker'))) {
    spinner.fail('Docker is not installed');
    logger.error('Please install Docker Desktop from: https://www.docker.com/products/docker-desktop');
    process.exit(1);
  }

  const dockerResult = await exec('docker', ['version', '--format', '{{.Server.Version}}']);
  if (!dockerResult.success) {
    spinner.fail('Docker daemon is not running');
    logger.error('Please start Docker Desktop and try again');
    process.exit(1);
  }

  spinner.succeed(`Docker ${dockerResult.stdout.trim()} is installed and running`);
}

async function checkDockerCompose(_projectRoot: string): Promise<void> {
  const spinner = new Spinner('Checking Docker Compose...');
  spinner.start();

  const composeResult = await exec('docker', ['compose', 'version', '--short']);
  if (!composeResult.success) {
    spinner.fail('Docker Compose is not available');
    logger.error('Please update Docker Desktop to get Docker Compose v2');
    process.exit(1);
  }

  spinner.succeed(`Docker Compose ${composeResult.stdout.trim()} is available`);
}

async function createDirectories(projectRoot: string): Promise<void> {
  const spinner = new Spinner('Creating project directories...');
  spinner.start();

  const directories = [CONSTANTS.PATHS.SECRETS_DIR, CONSTANTS.PATHS.VSCODE_CONFIG_DIR, 'setup-scripts', 'container-scripts'];

  for (const dir of directories) {
    const dirPath = path.join(projectRoot, dir);
    await fs.ensureDir(dirPath);
  }

  const gitignorePath = path.join(projectRoot, CONSTANTS.PATHS.SECRETS_DIR, '.gitignore');
  if (!(await fs.pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n');
  }

  spinner.succeed('Project directories created');
}

async function generateSSHKeys(_projectRoot: string): Promise<void> {
  const sshService = SSHService.getInstance();

  const spinner = new Spinner('Setting up SSH keys...');
  spinner.start();

  try {
    await sshService.generateSSHKey();
    spinner.succeed('SSH keys configured');
  } catch (error) {
    spinner.fail('Failed to generate SSH keys');
    throw error;
  }
}

async function setupGitConfig(projectRoot: string): Promise<void> {
  const useGit = await prompt.confirm('Would you like to configure Git settings?', true);
  if (!useGit) {
    return;
  }

  const gitConfig = await exec('git', ['config', '--global', 'user.name']);
  const currentName = gitConfig.success ? gitConfig.stdout.trim() : '';

  const gitEmail = await exec('git', ['config', '--global', 'user.email']);
  const currentEmail = gitEmail.success ? gitEmail.stdout.trim() : '';

  const name = await prompt.input({
    message: 'Git user name:',
    default: currentName || undefined,
  });

  const email = await prompt.input({
    message: 'Git email:',
    default: currentEmail || undefined,
  });

  const gitConfigPath = path.join(projectRoot, CONSTANTS.PATHS.SECRETS_DIR, '.gitconfig');
  const gitConfigContent = `[user]
  name = ${name}
  email = ${email}
[core]
  editor = nano
[pull]
  rebase = false
`;

  await fs.writeFile(gitConfigPath, gitConfigContent);
  logger.success('Git configuration saved');
}

async function setupVSCodeSync(_projectRoot: string): Promise<void> {
  const vscodeService = VSCodeService.getInstance();

  // Detect installed editor
  const editorType = await vscodeService.detectEditor();

  if (!editorType) {
    logger.info('No VS Code or Cursor installation found, skipping editor sync');
    return;
  }

  const editorName = editorType === 'cursor' ? 'Cursor' : 'VS Code';
  const syncEditor = await prompt.confirm(`Would you like to import your ${editorName} settings to the project?`, true);

  if (!syncEditor) {
    return;
  }

  const spinner = new Spinner(`Importing ${editorName} settings...`);
  spinner.start();

  try {
    await vscodeService.importSettings(editorType);
    spinner.succeed(`${editorName} settings imported successfully`);

    logger.info('\nImported:');
    logger.step('settings.json - Editor preferences');
    logger.step('keybindings.json - Keyboard shortcuts');
    logger.step('extensions.txt - Extension list');
    logger.step('snippets/ - Code snippets');
  } catch (error) {
    spinner.fail(`Failed to import ${editorName} settings`);
    logger.debug('Import error:', error as Record<string, unknown>);
  }
}

async function createEnvFile(projectRoot: string): Promise<void> {
  const envPath = path.join(projectRoot, CONSTANTS.PATHS.ENV_FILE);

  // Check if env file already exists
  const existingEnv: Record<string, string> = {};
  if (await fs.pathExists(envPath)) {
    const shouldUpdate = await prompt.confirm('Environment file already exists. Update it?', true);
    if (!shouldUpdate) {
      logger.info('Keeping existing environment file');
      return;
    }
    // Load existing values
    const envContent = await fs.readFile(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#][^=]+)=(.*)$/);
      if (match?.[1] && match[2]) {
        existingEnv[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
      }
    }
  }

  logger.info('Setting up environment configuration...\n');

  // Get current user's ID and group ID
  const userIdResult = await exec('id', ['-u']);
  const groupIdResult = await exec('id', ['-g']);
  const userId = existingEnv.USER_ID || (userIdResult.success ? userIdResult.stdout.trim() : '1000');
  const groupId = existingEnv.GROUP_ID || (groupIdResult.success ? groupIdResult.stdout.trim() : '1000');

  // Get git config
  const gitNameResult = await exec('git', ['config', '--global', 'user.name']);
  const gitEmailResult = await exec('git', ['config', '--global', 'user.email']);
  const defaultGitName = gitNameResult.success ? gitNameResult.stdout.trim() : 'Your Name';
  const defaultGitEmail = gitEmailResult.success ? gitEmailResult.stdout.trim() : 'your.email@example.com';

  const gitName =
    existingEnv.GIT_USER_NAME ||
    (await prompt.input({
      message: 'Git user name:',
      default: defaultGitName,
    }));

  const gitEmail =
    existingEnv.GIT_USER_EMAIL ||
    (await prompt.input({
      message: 'Git email:',
      default: defaultGitEmail,
    }));

  // Optional GitHub token
  const useGitHub = await prompt.confirm('Would you like to configure GitHub CLI integration?', !!existingEnv.GITHUB_TOKEN);
  let githubToken = '';
  if (useGitHub) {
    if (existingEnv.GITHUB_TOKEN) {
      const updateToken = await prompt.confirm('Update existing GitHub token?', false);
      githubToken = updateToken
        ? await prompt.password({
            message: 'GitHub personal access token:',
            mask: '*',
          })
        : existingEnv.GITHUB_TOKEN;
    } else {
      githubToken = await prompt.password({
        message: 'GitHub personal access token:',
        mask: '*',
      });
    }
  }

  // Optional Linear integration
  const useLinear = await prompt.confirm('Would you like to configure Linear integration?', !!existingEnv.LINEAR_API_KEY);
  let linearApiKey = '';
  if (useLinear) {
    if (existingEnv.LINEAR_API_KEY) {
      const updateKey = await prompt.confirm('Update existing Linear API key?', false);
      linearApiKey = updateKey
        ? await prompt.password({
            message: 'Linear API key:',
            mask: '*',
          })
        : existingEnv.LINEAR_API_KEY;
    } else {
      linearApiKey = await prompt.password({
        message: 'Linear API key:',
        mask: '*',
      });
    }
  }

  // Optional database configurations
  const useDatabases = await prompt.confirm(
    'Would you like to configure database connections?',
    !!(existingEnv.DATABASE_URL || existingEnv.MONGODB_URI || existingEnv.SUPABASE_URL),
  );

  let databaseUrl = '';
  let mongodbUri = '';
  let supabaseUrl = '';
  let supabaseAnonKey = '';

  if (useDatabases) {
    // PostgreSQL
    const usePostgres = await prompt.confirm('Configure PostgreSQL connection?', !!existingEnv.DATABASE_URL);
    if (usePostgres) {
      databaseUrl =
        existingEnv.DATABASE_URL ||
        (await prompt.input({
          message: 'PostgreSQL DATABASE_URL:',
          default: '',
        }));
    }

    // MongoDB
    const useMongo = await prompt.confirm('Configure MongoDB connection?', !!existingEnv.MONGODB_URI);
    if (useMongo) {
      mongodbUri =
        existingEnv.MONGODB_URI ||
        (await prompt.input({
          message: 'MongoDB URI:',
          default: '',
        }));
    }

    // Supabase
    const useSupabase = await prompt.confirm('Configure Supabase connection?', !!existingEnv.SUPABASE_URL);
    if (useSupabase) {
      supabaseUrl =
        existingEnv.SUPABASE_URL ||
        (await prompt.input({
          message: 'Supabase URL:',
          default: '',
        }));
      supabaseAnonKey =
        existingEnv.SUPABASE_ANON_KEY ||
        (await prompt.input({
          message: 'Supabase Anon Key:',
          default: '',
        }));
    }
  }

  const spinner = new Spinner('Writing environment file...');
  spinner.start();

  const envContent = `# User Configuration
# Get these values by running: id -u and id -g on your Mac
USER_ID=${userId}
GROUP_ID=${groupId}

# Git Configuration (Required)
GIT_USER_NAME="${gitName}"
GIT_USER_EMAIL="${gitEmail}"

# GitHub (Optional - for GitHub CLI)
GITHUB_TOKEN=${githubToken}

# Linear Integration (Optional)
LINEAR_API_KEY=${linearApiKey}

# Database URLs (Optional)
DATABASE_URL=${databaseUrl}
MONGODB_URI=${mongodbUri}
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
`;

  await fs.writeFile(envPath, envContent);
  spinner.succeed('Environment file saved');
}
