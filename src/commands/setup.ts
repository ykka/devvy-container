import * as os from 'node:os';
import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { generateEnvFile } from '@config/environment';
import { loadUserConfig, saveUserConfig, type UserConfig, userConfigExists } from '@config/user-config';
import * as ssh from '@services/ssh';
import * as vscode from '@services/vscode';
import { logger } from '@utils/logger';
import { expandPath, getProjectRoot } from '@utils/paths';
import * as prompt from '@utils/prompt';
import { commandExists, exec } from '@utils/shell';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export async function setupCommand(): Promise<void> {
  try {
    logger.box('Devvy Setup Wizard');
    logger.info('This wizard will help you set up your development environment\n');

    const projectRoot = getProjectRoot();

    const steps = [checkDockerInstallation, checkDockerCompose, createDirectories, generateSSHKeys, generateGitHubSSHKeys, setupUserConfig, setupVSCodeSync];

    for (const step of steps) {
      await step(projectRoot);
    }

    logger.success('\n✨ Setup completed successfully!');
    logger.info('\nNext steps:');
    logger.step(`1. Build the container: ${chalk.cyan('devvy rebuild')}`);
    logger.step(`2. Start the container: ${chalk.cyan('devvy start')}`);
    logger.step(`3. Connect to it: ${chalk.cyan('devvy connect')}`);
    logger.step(`4. Start coding! 🚀`);
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

  const directories = [CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.HOST_PATHS.VSCODE_CONFIG_DIR, 'container-scripts'];

  for (const dir of directories) {
    const dirPath = path.join(projectRoot, dir);
    await fs.ensureDir(dirPath);
  }

  const gitignorePath = path.join(projectRoot, CONSTANTS.HOST_PATHS.SECRETS_DIR, '.gitignore');
  if (!(await fs.pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n');
  }

  spinner.succeed('Project directories created');
}

async function generateSSHKeys(_projectRoot: string): Promise<void> {
  const spinner = new Spinner('Setting up host SSH keys...');
  spinner.start();

  try {
    await ssh.generateHostSSHKey();
    spinner.succeed('Host SSH keys configured');
  } catch (error) {
    spinner.fail('Failed to generate SSH keys');
    throw error;
  }
}

async function generateGitHubSSHKeys(_projectRoot: string): Promise<void> {
  // Check if GitHub SSH key already exists
  const keyExists = await ssh.gitHubSSHKeyExists();

  if (keyExists) {
    logger.warn('\n⚠️  GitHub SSH key already exists');
    logger.info('Regenerating the key will require you to:');
    logger.step('1. Remove the old key from GitHub');
    logger.step('2. Add the new key to GitHub');
    logger.step('3. Update any scripts or CI/CD that use the old key');

    const regenerate = await prompt.confirm('\nDo you want to regenerate the GitHub SSH key?', false);
    if (!regenerate) {
      logger.info('Using existing GitHub SSH key');
      return;
    }
  } else {
    const useGitHub = await prompt.confirm('\nWould you like to configure GitHub SSH authentication?', true);
    if (!useGitHub) {
      return;
    }
  }

  const spinner = new Spinner('Setting up GitHub SSH keys...');
  spinner.start();

  try {
    const { publicKey, existed } = await ssh.generateGitHubSSHKey(keyExists);
    spinner.succeed(existed ? 'GitHub SSH key regenerated' : 'GitHub SSH keys generated');

    // Display the public key and instructions
    logger.info('\n📋 GitHub SSH Public Key:');
    console.log(publicKey.trim());

    logger.info('\nTo complete GitHub SSH setup:');
    logger.step('1. Copy the public key above');
    logger.step(`2. Go to ${chalk.cyan('https://github.com/settings/ssh/new')}`);
    logger.step(`3. Add a title like "${chalk.yellow('Devvy Container SSH Key')}"`);
    logger.step('4. Paste the public key and save');

    if (keyExists) {
      logger.warn('\n⚠️  Remember to remove the old key from GitHub after adding the new one');
    }

    await prompt.confirm('\nPress Enter when you have added the key to GitHub...', true);
  } catch (error) {
    spinner.fail('Failed to generate GitHub SSH keys');
    throw error;
  }
}

async function setupVSCodeSync(projectRoot: string): Promise<void> {
  // Check if settings already exist
  const vscodeConfigDir = path.join(projectRoot, CONSTANTS.HOST_PATHS.VSCODE_CONFIG_DIR);
  const settingsExist = await fs.pathExists(path.join(vscodeConfigDir, 'settings.json'));

  if (settingsExist) {
    // Check if the existing settings file has content
    const existingSettings = await fs.readFile(path.join(vscodeConfigDir, 'settings.json'), 'utf-8');
    if (existingSettings.trim() && existingSettings.trim() !== '{}') {
      const overwrite = await prompt.confirm('Overwrite existing editor settings with your current configuration?', false);
      if (!overwrite) {
        return;
      }
    }
  } else {
    const syncEditor = await prompt.confirm('Import editor settings to the project for container use?', true);
    if (!syncEditor) {
      return;
    }
  }

  // Detect available editors
  const cursorInstalled = (await vscode.detectEditor()) === 'cursor';
  const vscodeInstalled = await fs.pathExists(
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'Code')
      : process.platform === 'win32'
        ? path.join(os.homedir(), 'AppData', 'Roaming', 'Code')
        : path.join(os.homedir(), '.config', 'Code'),
  );

  let editorType: vscode.EditorType | null = null;

  if (cursorInstalled && vscodeInstalled) {
    // Both editors are installed, ask user to choose
    const choice = await prompt.select('Which editor settings would you like to import?', [
      { name: 'Cursor - Import Cursor settings and extensions', value: 'cursor' },
      { name: 'VS Code - Import VS Code settings and extensions', value: 'vscode' },
    ]);
    editorType = choice as vscode.EditorType;
  } else if (cursorInstalled) {
    editorType = 'cursor';
  } else if (vscodeInstalled) {
    editorType = 'vscode';
  } else {
    logger.info('No VS Code or Cursor installation detected, skipping editor sync');
    return;
  }

  const editorName = editorType === 'cursor' ? 'Cursor' : 'VS Code';

  try {
    await vscode.importEditorSettings(editorType);
  } catch (error) {
    logger.error(`Failed to import ${editorName} settings`, error);
  }
}

async function setupUserConfig(_projectRoot: string): Promise<void> {
  // Add a small delay to ensure previous operations are fully completed
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check if config already exists
  let existingConfig: UserConfig | null = null;
  if (await userConfigExists()) {
    const shouldUpdate = await prompt.confirm('\nUpdate Devvy configuration (projects path, API keys, etc)?', false);
    if (!shouldUpdate) {
      // Still generate .env from existing config
      const loadedConfig = await loadUserConfig();
      if (loadedConfig) {
        await generateEnvFile(loadedConfig);
      }
      return;
    }
    existingConfig = await loadUserConfig();
    logger.info('\nUpdating configuration...\n');
  } else {
    logger.info('\nSetting up configuration...\n');
  }

  // Step 1: Projects Directory
  const defaultProjectsPath = CONSTANTS.DEFAULT_PATHS.PROJECTS;
  const projectsPath = await prompt.input({
    message: 'Path to your projects folder (will be mounted to /home/devvy/repos):',
    default: existingConfig?.projectsPath || defaultProjectsPath,
  });

  const expandedProjectsPath = expandPath(projectsPath);
  if (!(await fs.pathExists(expandedProjectsPath))) {
    const createDir = await prompt.confirm(`Directory ${projectsPath} doesn't exist. Create it?`, true);
    if (createDir) {
      await fs.ensureDir(expandedProjectsPath);
      logger.success(`Created directory: ${projectsPath}`);
    }
  }

  // Step 2: Integrations
  const integrations: UserConfig['integrations'] = {
    github: undefined,
  };

  // Check if GitHub SSH is configured
  const githubSSHConfigured = await ssh.gitHubSSHKeyExists();

  // If GitHub SSH is configured, save that in the config
  if (githubSSHConfigured) {
    integrations.github = {
      sshKeyConfigured: true,
    };
  }

  // Step 3: LazyVim

  // Step 3: LazyVim
  const editor: UserConfig['editor'] = {};
  const installLazyvim = await prompt.confirm('Would you like to install LazyVim in the container?', existingConfig?.editor?.lazyvim?.enabled ?? true);

  if (installLazyvim) {
    const useExistingConfig = await prompt.confirm('Use your existing Neovim configuration?', true);
    if (useExistingConfig) {
      const defaultPath = CONSTANTS.DEFAULT_PATHS.LAZYVIM_CONFIG;
      const configPath = await prompt.input({
        message: 'Path to your Neovim config directory:',
        default: existingConfig?.editor?.lazyvim?.readOnlyConfigPath || defaultPath,
      });

      const expandedConfigPath = expandPath(configPath);
      if (await fs.pathExists(expandedConfigPath)) {
        editor.lazyvim = {
          enabled: true,
          readOnlyConfigPath: configPath,
        };
      } else {
        logger.warn(`Path ${configPath} doesn't exist. LazyVim will be installed with defaults.`);
        editor.lazyvim = {
          enabled: true,
        };
      }
    } else {
      editor.lazyvim = {
        enabled: true,
      };
    }
  } else {
    editor.lazyvim = {
      enabled: false,
    };
  }

  // Step 4: Tmux
  const terminal: UserConfig['terminal'] = {};
  const useTmux = await prompt.confirm('Would you like to use your existing tmux configuration?', !!existingConfig?.terminal?.tmux?.readOnlyConfigPath);

  if (useTmux) {
    const defaultPath = CONSTANTS.DEFAULT_PATHS.TMUX_CONFIG;
    const configPath = await prompt.input({
      message: 'Path to your tmux config directory:',
      default: existingConfig?.terminal?.tmux?.readOnlyConfigPath || defaultPath,
    });

    const expandedConfigPath = expandPath(configPath);
    if (await fs.pathExists(expandedConfigPath)) {
      terminal.tmux = {
        readOnlyConfigPath: configPath,
      };
    } else {
      logger.warn(`Path ${configPath} doesn't exist. Tmux will use defaults.`);
    }
  }

  // Build final configuration - merge with existing config or defaults
  const existingFullConfig = await loadUserConfig();
  const userConfig: UserConfig = {
    projectsPath,
    integrations,
    editor,
    terminal,
    firewall: existingFullConfig?.firewall || { allowedDomains: [] },
  };

  // Save configuration
  const spinner = new Spinner('Saving configuration...');
  spinner.start();

  try {
    await saveUserConfig(userConfig);
    await generateEnvFile(userConfig);
    spinner.succeed('Configuration saved successfully');

    // Update .gitignore to exclude the config file
    const gitignorePath = path.join(_projectRoot, '.gitignore');
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    const configFiles = ['user.config.json', '.env'];
    const linesToAdd: string[] = [];

    for (const file of configFiles) {
      if (!gitignoreContent.includes(file)) {
        linesToAdd.push(file);
      }
    }

    if (linesToAdd.length > 0) {
      await fs.appendFile(gitignorePath, `\n# Devvy configuration\n${linesToAdd.join('\n')}\n`);
      logger.info('Updated .gitignore with configuration files');
    }
  } catch (error) {
    spinner.fail('Failed to save configuration');
    throw error;
  }
}
