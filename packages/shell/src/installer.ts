/**
 * @license Apache-2.0
 * ShellMind Shell Installer
 * Safely adds alias ai="shellmind" and completion hooks to user profile
 */

import { ShellDetector } from './detector.js';
import { CompletionGenerator } from './completions.js';
import { ShellInstallResult, ShellProfileInfo } from './types.js';

export class ShellInstaller {
  public static getProfileInfo(): ShellProfileInfo {
    const shell = ShellDetector.detect();
    const profilePath = ShellDetector.getProfilePath(shell);
    const aliasSnippet = shell === 'powershell'
      ? `Set-Alias -Name ai -Value shellmind`
      : `alias ai="shellmind"`;

    return {
      shell,
      profilePath,
      isInstalled: false,
      aliasSnippet,
    };
  }

  public static async install(): Promise<ShellInstallResult> {
    const info = this.getProfileInfo();
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    if (!isNode) {
      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: true,
        message: `Simulation: Added alias ai="shellmind" to ${info.profilePath}`,
      };
    }

    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const dir = path.dirname(info.profilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const existingContent = fs.existsSync(info.profilePath)
        ? fs.readFileSync(info.profilePath, 'utf-8')
        : '';

      if (existingContent.includes('alias ai=') || existingContent.includes('Set-Alias -Name ai')) {
        return {
          shell: info.shell,
          profilePath: info.profilePath,
          success: true,
          message: `ShellMind alias is already installed in ${info.profilePath}`,
        };
      }

      const completion = CompletionGenerator.generate(info.shell);
      const appendBlock = `
# >>> ShellMind Terminal Copilot >>>
${info.aliasSnippet}
${completion}
# <<< ShellMind Terminal Copilot <<<
`;

      fs.appendFileSync(info.profilePath, appendBlock, 'utf-8');

      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: true,
        message: `Successfully installed ShellMind alias & autocompletions to ${info.profilePath}. Restart shell or run: source ${info.profilePath}`,
      };
    } catch (err: any) {
      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: false,
        message: `Failed to update ${info.profilePath}: ${err.message}`,
      };
    }
  }
}
