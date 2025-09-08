import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import * as config from '@config/index';
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

    const steps = [checkDockerInstallation, checkDockerCompose, createDirectories, generateSSHKeys, setupUserConfig, setupVSCodeSync];

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

  const directories = [CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.HOST_PATHS.VSCODE_CONFIG_DIR, 'setup-scripts', 'container-scripts'];

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

async function setupVSCodeSync(projectRoot: string): Promise<void> {
  // Detect installed editor
  const editorType = await vscode.detectEditor();

  if (!editorType) {
    return; // Skip silently if no editor found
  }

  const editorName = editorType === 'cursor' ? 'Cursor' : 'VS Code';

  // Check if settings already exist
  const vscodeConfigDir = path.join(projectRoot, CONSTANTS.HOST_PATHS.VSCODE_CONFIG_DIR);
  const settingsExist = await fs.pathExists(path.join(vscodeConfigDir, 'settings.json'));

  if (settingsExist) {
    const overwrite = await prompt.confirm(`Overwrite existing ${editorName} settings with your current configuration?`, false);

    if (!overwrite) {
      return;
    }
  } else {
    const syncEditor = await prompt.confirm(`Import ${editorName} settings to the project?`, true);

    if (!syncEditor) {
      return;
    }
  }

  try {
    await vscode.importEditorSettings(editorType);
    logger.success(`${editorName} settings imported`);
  } catch (error) {
    logger.debug('Import error:', error as Record<string, unknown>);
  }
}

async function setupUserConfig(_projectRoot: string): Promise<void> {
  // Add a small delay to ensure previous operations are fully completed
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check if config already exists
  let existingConfig: config.UserConfig | null = null;
  if (await config.userConfigExists()) {
    const shouldUpdate = await prompt.confirm('\nUpdate Devvy configuration (projects path, API keys, etc)?', false);
    if (!shouldUpdate) {
      // Still generate .env from existing config
      const loadedConfig = await config.loadUserConfig();
      if (loadedConfig) {
        await config.generateEnvFile(loadedConfig);
      }
      return;
    }
    existingConfig = await config.loadUserConfig();
    logger.info('\nUpdating configuration...\n');
  } else {
    logger.info('\nSetting up configuration...\n');
  }

  // Step 1: Projects Directory
  const defaultProjectsPath = config.getDefaultProjectsPath();
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
  const integrations: config.UserConfig['integrations'] = {
    github: undefined,
    linear: undefined,
  };

  // GitHub token
  const useGitHub = await prompt.confirm('Would you like to configure GitHub CLI integration?', !!existingConfig?.integrations?.github?.token);
  if (useGitHub) {
    if (existingConfig?.integrations?.github?.token) {
      const updateToken = await prompt.confirm('Update existing GitHub token?', false);
      if (updateToken) {
        const token = await prompt.password({
          message: 'GitHub personal access token:',
          mask: '*',
        });
        integrations.github = { token };
      } else {
        integrations.github = existingConfig.integrations.github;
      }
    } else {
      const token = await prompt.password({
        message: 'GitHub personal access token:',
        mask: '*',
      });
      if (token) {
        integrations.github = { token };
      }
    }
  }

  // Linear API key
  const useLinear = await prompt.confirm('Would you like to configure Linear integration?', !!existingConfig?.integrations?.linear?.apiKey);
  if (useLinear) {
    if (existingConfig?.integrations?.linear?.apiKey) {
      const updateKey = await prompt.confirm('Update existing Linear API key?', false);
      if (updateKey) {
        const apiKey = await prompt.password({
          message: 'Linear API key:',
          mask: '*',
        });
        integrations.linear = { apiKey };
      } else {
        integrations.linear = existingConfig.integrations.linear;
      }
    } else {
      const apiKey = await prompt.password({
        message: 'Linear API key:',
        mask: '*',
      });
      if (apiKey) {
        integrations.linear = { apiKey };
      }
    }
  }

  // Step 3: LazyVim

  // Step 3: LazyVim
  const editor: config.UserConfig['editor'] = {};
  const installLazyvim = await prompt.confirm('Would you like to install LazyVim in the container?', existingConfig?.editor?.lazyvim?.enabled ?? true);

  if (installLazyvim) {
    const useExistingConfig = await prompt.confirm('Use your existing Neovim configuration?', true);
    if (useExistingConfig) {
      const defaultPath = config.getDefaultLazyvimPath();
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
  const terminal: config.UserConfig['terminal'] = {};
  const useTmux = await prompt.confirm('Would you like to use your existing tmux configuration?', !!existingConfig?.terminal?.tmux?.readOnlyConfigPath);

  if (useTmux) {
    const defaultPath = config.getDefaultTmuxPath();
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
  const existingFullConfig = await config.loadUserConfig();
  const userConfig: config.UserConfig = {
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
    await config.saveUserConfig(userConfig);
    await config.generateEnvFile(userConfig);
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
