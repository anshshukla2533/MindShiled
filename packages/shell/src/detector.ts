/**
 * @license Apache-2.0
 * ShellMind Shell Detector
 */

import { ShellType } from '@shellmind/core';

export class ShellDetector {
  public static detect(): ShellType {
    if (typeof process === 'undefined') return 'bash';

    if (process.platform === 'win32') {
      if (process.env.PSModulePath) return 'powershell';
      return 'cmd';
    }

    const envShell = process.env.SHELL || '';
    if (envShell.endsWith('/zsh') || envShell.includes('zsh')) return 'zsh';
    if (envShell.endsWith('/fish') || envShell.includes('fish')) return 'fish';
    if (envShell.endsWith('/bash') || envShell.includes('bash')) return 'bash';

    return 'bash';
  }

  public static getProfilePath(shell: ShellType): string {
    const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
    const home = typeof process !== 'undefined' ? (process.env.HOME || '/root') : '/root';

    switch (shell) {
      case 'zsh':
        return `${home}/.zshrc`;
      case 'fish':
        return `${home}/.config/fish/config.fish`;
      case 'bash':
        return `${home}/.bashrc`;
      case 'powershell':
        if (isWindows) {
          const docs = process.env.USERPROFILE || 'C:\\';
          return `${docs}\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1`;
        }
        return `${home}/.config/powershell/Microsoft.PowerShell_profile.ps1`;
      case 'cmd':
        return `${home}/autorun.cmd`;
      default:
        return `${home}/.bashrc`;
    }
  }
}
