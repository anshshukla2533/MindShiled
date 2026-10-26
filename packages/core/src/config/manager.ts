/**
 * @license Apache-2.0
 * ShellMind Config Manager
 * Handles loading, saving, and merging configuration from ~/.shellmind/config.json
 */

import { DEFAULT_SHELLMIND_CONFIG } from './schema.js';
import { AIProviderId, ShellMindConfig } from '../types/index.js';

export class ConfigManager {
  private config: ShellMindConfig;
  private configPath: string;

  constructor(initialConfig?: Partial<ShellMindConfig>, customPath?: string) {
    this.configPath = customPath || this.resolveDefaultConfigPath();
    this.config = this.mergeWithDefaults(initialConfig);
  }

  private resolveDefaultConfigPath(): string {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const appData = process.env.APPDATA || process.env.USERPROFILE || 'C:\\';
      return `${appData}\\ShellMind\\config.json`;
    }
    const home = process.env.HOME || '/root';
    return `${home}/.shellmind/config.json`;
  }

  public getConfig(): ShellMindConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public setActiveProvider(providerId: AIProviderId): void {
    this.config.provider.active = providerId;
  }

  public updateConfig(partial: Partial<ShellMindConfig>): ShellMindConfig {
    this.config = this.mergeWithDefaults(partial);
    return this.getConfig();
  }

  public resetToDefaults(): ShellMindConfig {
    this.config = JSON.parse(JSON.stringify(DEFAULT_SHELLMIND_CONFIG));
    return this.getConfig();
  }

  private mergeWithDefaults(partial?: Partial<ShellMindConfig>): ShellMindConfig {
    if (!partial) {
      return JSON.parse(JSON.stringify(DEFAULT_SHELLMIND_CONFIG));
    }
    return {
      ...DEFAULT_SHELLMIND_CONFIG,
      ...partial,
      provider: {
        ...DEFAULT_SHELLMIND_CONFIG.provider,
        ...(partial.provider || {}),
      },
      security: {
        ...DEFAULT_SHELLMIND_CONFIG.security,
        ...(partial.security || {}),
      },
      ui: {
        ...DEFAULT_SHELLMIND_CONFIG.ui,
        ...(partial.ui || {}),
      },
      telemetry: {
        ...DEFAULT_SHELLMIND_CONFIG.telemetry,
        ...(partial.telemetry || {}),
      },
    };
  }
}
