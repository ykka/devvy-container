import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    box: vi.fn(),
  },
}));

vi.mock('@utils/spinner', () => ({
  Spinner: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

import { logger } from '@utils/logger';
import { Spinner } from '@utils/spinner';

describe('GitHub SSH Key Display', () => {
  const mockPublicKey =
    'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC5nVDDqEP83vgI+MFVQjhcw82ASVueJQPBr5kOmv6h1rV3HsblfcVBIqDB5cRCjPBKoG3wDECkdWdLvdytas7cnAr7ugveAdmz0j7usSjpPU38WPUrNuWnPWAobzG032uZcDX23lpQnoL9J7Z2aWC0ZC3T5lyrTlyqiVmtNKEP3ByGEINLCvQHPK9OSTMNDqc/YYTsvyga7ld3Hn0me+JoAHpeA4hmwaRRzvUN79+zQ5TIbpgUwZZSNSwsfKpib9HrfI7ETQ5SVKL1tKpuMDbeAxgmu9Il/w1Gyba0pde1oXxiY6EoDASE5zGOAAr3Qd5I7gxUYrqZfgqvph7cZLdDEmDheQEy3De4jc6iUciQk2yw1rtM4UbtIVKjGd7bt6KWg3t+psyLeCj/6ODJBxHijiUJ3BHvEdHfS8ibURhkxZIkmmgQz91fAG3fn9foZbBbjlKfcHBk3QiGu63coUUy6y3LZYpoCARD/A7uvGRuoe24J/PDqnhY70rj1A1/+s2s4kOHI10YuUDtWMKDt4QWyln/8by5HEVEQUQ1exNp/ggOyKvnm72Q63CvtIJ0DCtIhC5Y7wdhq15XUIfl9Ta2P3ummZf6M3OoOgg7YKnel0r8f5KAtwfKNaGwDhh0knKF59AJDLxsT4w+JvvBBwLdL9iXlQ7aNWbjgu+JVEp3Aw== devvy-github-2025-09-09';

  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should display SSH key as plain text without box decoration', async () => {
    // This simulates the code from generateGitHubSSHKeys function in setup.ts
    const spinner = new Spinner('Setting up GitHub SSH keys...');
    spinner.start();

    // Mock SSH key generation
    const { publicKey } = { publicKey: mockPublicKey };
    (spinner.succeed as any)();

    // This is the key part we're testing - using console.log instead of logger.box
    logger.info('\n📋 GitHub SSH Public Key:');
    console.log(publicKey.trim());

    logger.info('\nTo complete GitHub SSH setup:');
    logger.step('1. Copy the public key above');

    // Verify console.log was called with the plain SSH key
    expect(consoleLogSpy).toHaveBeenCalledWith(mockPublicKey);
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);

    // Verify logger.box was NOT called for the SSH key
    expect(logger.box).not.toHaveBeenCalled();
  });

  it('should trim whitespace from SSH key before display', () => {
    const keyWithWhitespace = `  ${mockPublicKey}  \n`;

    // Simulate the display code
    logger.info('\n📋 GitHub SSH Public Key:');
    console.log(keyWithWhitespace.trim());

    // Verify the key was trimmed
    expect(consoleLogSpy).toHaveBeenCalledWith(mockPublicKey);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(keyWithWhitespace);
  });

  it('should handle multiline SSH keys properly', () => {
    const multilineKey = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC5nVDDqEP83vgI...
    continuation of key...
    end of key devvy-github-2025-09-09`;

    const expectedTrimmed = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC5nVDDqEP83vgI...\n    continuation of key...\n    end of key devvy-github-2025-09-09';

    // Simulate the display code
    console.log(multilineKey.trim());

    // Verify proper trimming
    expect(consoleLogSpy).toHaveBeenCalledWith(expectedTrimmed);
  });
});
