import * as os from 'node:os'
import * as path from 'node:path'

import { CONSTANTS } from '@config/constants'
import { ConfigService } from '@services/config.service'
import { logger } from '@utils/logger'
import { Prompt } from '@utils/prompt'
import { Shell } from '@utils/shell'
import { Spinner } from '@utils/spinner'
import chalk from 'chalk'
import * as fs from 'fs-extra'

export async function setupCommand(): Promise<void> {
  try {
    logger.box('Claude Docker Setup Wizard')
    logger.info('This wizard will help you set up your development environment.\n')

    const config = ConfigService.getInstance()
    const projectRoot = config.getProjectRoot()

    const steps = [
      checkDockerInstallation,
      checkDockerCompose,
      createDirectories,
      generateSSHKeys,
      setupGitConfig,
      setupVSCodeSync,
      createEnvFile,
    ]

    for (const step of steps) {
      await step(projectRoot)
    }

    logger.success('\n✨ Setup completed successfully!')
    logger.info('\nNext steps:')
    logger.step(`1. Start the container: ${chalk.cyan('devvy start')}`)
    logger.step(`2. Connect to it: ${chalk.cyan('devvy connect')}`)
    logger.step(`3. Start coding! 🚀`)
  } catch (error) {
    logger.error('Setup failed', error)
    process.exit(1)
  }
}

async function checkDockerInstallation(_projectRoot: string): Promise<void> {
  const spinner = new Spinner('Checking Docker installation...')
  spinner.start()

  if (!(await Shell.commandExists('docker'))) {
    spinner.fail('Docker is not installed')
    logger.error(
      'Please install Docker Desktop from: https://www.docker.com/products/docker-desktop'
    )
    process.exit(1)
  }

  const dockerResult = await Shell.exec('docker', ['version', '--format', '{{.Server.Version}}'])
  if (!dockerResult.success) {
    spinner.fail('Docker daemon is not running')
    logger.error('Please start Docker Desktop and try again')
    process.exit(1)
  }

  spinner.succeed(`Docker ${dockerResult.stdout.trim()} is installed and running`)
}

async function checkDockerCompose(_projectRoot: string): Promise<void> {
  const spinner = new Spinner('Checking Docker Compose...')
  spinner.start()

  const composeResult = await Shell.exec('docker', ['compose', 'version', '--short'])
  if (!composeResult.success) {
    spinner.fail('Docker Compose is not available')
    logger.error('Please update Docker Desktop to get Docker Compose v2')
    process.exit(1)
  }

  spinner.succeed(`Docker Compose ${composeResult.stdout.trim()} is available`)
}

async function createDirectories(projectRoot: string): Promise<void> {
  const spinner = new Spinner('Creating project directories...')
  spinner.start()

  const directories = [
    CONSTANTS.PATHS.SECRETS_DIR,
    CONSTANTS.PATHS.VSCODE_CONFIG_DIR,
    'setup-scripts',
    'container-scripts',
  ]

  for (const dir of directories) {
    const dirPath = path.join(projectRoot, dir)
    await fs.ensureDir(dirPath)
  }

  const gitignorePath = path.join(projectRoot, CONSTANTS.PATHS.SECRETS_DIR, '.gitignore')
  if (!(await fs.pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n')
  }

  spinner.succeed('Project directories created')
}

async function generateSSHKeys(projectRoot: string): Promise<void> {
  const sshKeyPath = path.join(projectRoot, CONSTANTS.PATHS.SECRETS_DIR, CONSTANTS.SSH.KEY_NAME)

  if (await fs.pathExists(sshKeyPath)) {
    const regenerate = await Prompt.confirm('SSH keys already exist. Regenerate?', false)
    if (!regenerate) {
      logger.info('Using existing SSH keys')
      return
    }
  }

  const spinner = new Spinner('Generating SSH keys...')
  spinner.start()

  await Shell.exec('ssh-keygen', [
    '-t',
    'rsa',
    '-b',
    '4096',
    '-f',
    sshKeyPath,
    '-N',
    '',
    '-C',
    'claude-docker@localhost',
  ])

  await fs.chmod(sshKeyPath, 0o600)
  await fs.chmod(`${sshKeyPath}.pub`, 0o644)

  spinner.succeed('SSH keys generated')
}

async function setupGitConfig(projectRoot: string): Promise<void> {
  const useGit = await Prompt.confirm('Would you like to configure Git settings?', true)
  if (!useGit) {
    return
  }

  const gitConfig = await Shell.exec('git', ['config', '--global', 'user.name'])
  const currentName = gitConfig.success ? gitConfig.stdout.trim() : ''

  const gitEmail = await Shell.exec('git', ['config', '--global', 'user.email'])
  const currentEmail = gitEmail.success ? gitEmail.stdout.trim() : ''

  const name = await Prompt.input({
    message: 'Git user name:',
    default: currentName || undefined,
  })

  const email = await Prompt.input({
    message: 'Git email:',
    default: currentEmail || undefined,
  })

  const gitConfigPath = path.join(projectRoot, CONSTANTS.PATHS.SECRETS_DIR, '.gitconfig')
  const gitConfigContent = `[user]
  name = ${name}
  email = ${email}
[core]
  editor = nano
[pull]
  rebase = false
`

  await fs.writeFile(gitConfigPath, gitConfigContent)
  logger.success('Git configuration saved')
}

async function setupVSCodeSync(projectRoot: string): Promise<void> {
  const editors = []
  const vscodePath = path.join(os.homedir(), '.vscode')
  const cursorPath = path.join(os.homedir(), '.cursor')

  if (await fs.pathExists(vscodePath)) {
    editors.push({ name: 'VS Code', value: vscodePath })
  }

  if (await fs.pathExists(cursorPath)) {
    editors.push({ name: 'Cursor', value: cursorPath })
  }

  if (editors.length === 0) {
    logger.info('No VS Code or Cursor installation found, skipping editor sync')
    return
  }

  const syncEditor = await Prompt.confirm('Would you like to sync editor settings?', true)
  if (!syncEditor) {
    return
  }

  const selectedEditor = await Prompt.select('Select editor to sync:', editors)
  const spinner = new Spinner('Syncing editor settings...')
  spinner.start()

  const configDir = path.join(projectRoot, CONSTANTS.PATHS.VSCODE_CONFIG_DIR)
  const sourceSettings = path.join(selectedEditor, 'User', 'settings.json')
  const sourceKeybindings = path.join(selectedEditor, 'User', 'keybindings.json')
  const sourceSnippets = path.join(selectedEditor, 'User', 'snippets')

  if (await fs.pathExists(sourceSettings)) {
    await fs.copy(sourceSettings, path.join(configDir, 'settings.json'))
  }

  if (await fs.pathExists(sourceKeybindings)) {
    await fs.copy(sourceKeybindings, path.join(configDir, 'keybindings.json'))
  }

  if (await fs.pathExists(sourceSnippets)) {
    await fs.copy(sourceSnippets, path.join(configDir, 'snippets'))
  }

  spinner.succeed(`Editor settings synced, they will be available in VS Code/Cursor if
    you connect via devcontainers to the devvy Docker instance.`)
}

async function createEnvFile(projectRoot: string): Promise<void> {
  const envPath = path.join(projectRoot, CONSTANTS.PATHS.ENV_FILE)

  // Check if env file already exists
  const existingEnv: Record<string, string> = {}
  if (await fs.pathExists(envPath)) {
    const shouldUpdate = await Prompt.confirm('Environment file already exists. Update it?', true)
    if (!shouldUpdate) {
      logger.info('Keeping existing environment file')
      return
    }
    // Load existing values
    const envContent = await fs.readFile(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#][^=]+)=(.*)$/)
      if (match && match[1] && match[2]) {
        existingEnv[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1')
      }
    }
  }

  logger.info('Setting up environment configuration...\n')

  // Get current user's ID and group ID
  const userIdResult = await Shell.exec('id', ['-u'])
  const groupIdResult = await Shell.exec('id', ['-g'])
  const userId = existingEnv.USER_ID || (userIdResult.success ? userIdResult.stdout.trim() : '1000')
  const groupId = existingEnv.GROUP_ID || (groupIdResult.success ? groupIdResult.stdout.trim() : '1000')

  // Get git config
  const gitNameResult = await Shell.exec('git', ['config', '--global', 'user.name'])
  const gitEmailResult = await Shell.exec('git', ['config', '--global', 'user.email'])
  const defaultGitName = gitNameResult.success ? gitNameResult.stdout.trim() : 'Your Name'
  const defaultGitEmail = gitEmailResult.success ? gitEmailResult.stdout.trim() : 'your.email@example.com'

  const gitName = existingEnv.GIT_USER_NAME || await Prompt.input({
    message: 'Git user name:',
    default: defaultGitName,
  })

  const gitEmail = existingEnv.GIT_USER_EMAIL || await Prompt.input({
    message: 'Git email:',
    default: defaultGitEmail,
  })

  // Optional GitHub token
  const useGitHub = await Prompt.confirm('Would you like to configure GitHub CLI integration?', !!existingEnv.GITHUB_TOKEN)
  let githubToken = ''
  if (useGitHub) {
    if (existingEnv.GITHUB_TOKEN) {
      const updateToken = await Prompt.confirm('Update existing GitHub token?', false)
      githubToken = updateToken ? (await Prompt.password({
          message: 'GitHub personal access token:',
          mask: '*',
        })) : existingEnv.GITHUB_TOKEN;
    } else {
      githubToken = await Prompt.password({
        message: 'GitHub personal access token:',
        mask: '*',
      })
    }
  }

  // Optional Linear integration
  const useLinear = await Prompt.confirm('Would you like to configure Linear integration?', !!existingEnv.LINEAR_API_KEY)
  let linearApiKey = ''
  if (useLinear) {
    if (existingEnv.LINEAR_API_KEY) {
      const updateKey = await Prompt.confirm('Update existing Linear API key?', false)
      linearApiKey = updateKey ? (await Prompt.password({
          message: 'Linear API key:',
          mask: '*',
        })) : existingEnv.LINEAR_API_KEY;
    } else {
      linearApiKey = await Prompt.password({
        message: 'Linear API key:',
        mask: '*',
      })
    }
  }

  // Optional database configurations
  const useDatabases = await Prompt.confirm('Would you like to configure database connections?', 
    !!(existingEnv.DATABASE_URL || existingEnv.MONGODB_URI || existingEnv.SUPABASE_URL))
  
  let databaseUrl = ''
  let mongodbUri = ''
  let supabaseUrl = ''
  let supabaseAnonKey = ''

  if (useDatabases) {
    // PostgreSQL
    const usePostgres = await Prompt.confirm('Configure PostgreSQL connection?', !!existingEnv.DATABASE_URL)
    if (usePostgres) {
      databaseUrl = existingEnv.DATABASE_URL || await Prompt.input({
        message: 'PostgreSQL DATABASE_URL:',
        default: '',
      })
    }

    // MongoDB
    const useMongo = await Prompt.confirm('Configure MongoDB connection?', !!existingEnv.MONGODB_URI)
    if (useMongo) {
      mongodbUri = existingEnv.MONGODB_URI || await Prompt.input({
        message: 'MongoDB URI:',
        default: '',
      })
    }

    // Supabase
    const useSupabase = await Prompt.confirm('Configure Supabase connection?', !!existingEnv.SUPABASE_URL)
    if (useSupabase) {
      supabaseUrl = existingEnv.SUPABASE_URL || await Prompt.input({
        message: 'Supabase URL:',
        default: '',
      })
      supabaseAnonKey = existingEnv.SUPABASE_ANON_KEY || await Prompt.input({
        message: 'Supabase Anon Key:',
        default: '',
      })
    }
  }

  const spinner = new Spinner('Writing environment file...')
  spinner.start()

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
`

  await fs.writeFile(envPath, envContent)
  spinner.succeed('Environment file saved')
}
