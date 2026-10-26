/**
 * @license Apache-2.0
 * ShellMind Plugin Registry
 */

import { BUILTIN_PLUGINS } from './builtin/index.js';
import { ShellMindPlugin, ValidationIssue } from './types.js';
import { SystemContext } from '@shellmind/core';

export class PluginRegistry {
  private plugins: Map<string, ShellMindPlugin> = new Map();

  constructor(loadBuiltins = true) {
    if (loadBuiltins) {
      for (const p of BUILTIN_PLUGINS) {
        this.plugins.set(p.id, p);
      }
    }
  }

  public register(plugin: ShellMindPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  public getPlugin(id: string): ShellMindPlugin | undefined {
    return this.plugins.get(id);
  }

  public getAll(): ShellMindPlugin[] {
    return Array.from(this.plugins.values());
  }

  public validateCommand(command: string, context: SystemContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.validateCommand) {
        try {
          const res = plugin.validateCommand(command, context);
          issues.push(...res);
        } catch (err) {
          console.error(`[Plugin ${plugin.id} validation error]:`, err);
        }
      }
    }
    return issues;
  }
}
