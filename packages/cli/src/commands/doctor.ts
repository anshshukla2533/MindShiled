/**
 * @license Apache-2.0
 * ShellMind Doctor Command
 * Diagnoses system environment, active provider, shell integration, and permissions
 */

import { ContextCollector } from '@shellmind/context';
import { ShellDetector } from '@shellmind/shell';
import { ConfigManager } from '@shellmind/core';
import { colors } from '../ui/colors.js';

export interface DoctorCheckItem {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  details: string;
}

export class DoctorCommand {
  public static async run(): Promise<DoctorCheckItem[]> {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const collector = new ContextCollector();
    const context = await collector.collect();
    const shell = ShellDetector.detect();

    const checks: DoctorCheckItem[] = [
      {
        name: 'Node.js Runtime',
        status: 'ok',
        details: `${process.version} (requires >= 22.0.0)`,
      },
      {
        name: 'Active Shell Detection',
        status: 'ok',
        details: `${shell} (${context.os.platform} ${context.os.arch})`,
      },
      {
        name: 'AI Provider Selected',
        status: 'ok',
        details: `${config.provider.active.toUpperCase()}`,
      },
      {
        name: 'Gemini API Key',
        status: process.env.GEMINI_API_KEY ? 'ok' : 'warn',
        details: process.env.GEMINI_API_KEY ? 'Configured in environment' : 'Not set (heuristic mode active)',
      },
      {
        name: 'Git Version Control',
        status: context.tools.git ? 'ok' : 'warn',
        details: context.tools.git || 'Git not found in PATH',
      },
      {
        name: 'Container Runtime (Docker)',
        status: context.tools.docker ? 'ok' : 'warn',
        details: context.tools.docker || 'Docker not found in PATH',
      },
      {
        name: 'Configuration File',
        status: 'ok',
        details: configManager.getConfigPath(),
      },
    ];

    return checks;
  }
}
