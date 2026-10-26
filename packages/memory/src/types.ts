/**
 * @license Apache-2.0
 * ShellMind Memory Types
 */

import { RiskLevel } from '@shellmind/core';

export interface CommandHistoryEntry {
  id: string;
  timestamp: number;
  prompt: string;
  command: string;
  directory: string;
  riskLevel: RiskLevel;
  executed: boolean;
  exitCode?: number;
}

export interface LearnedWorkflow {
  phrase: string;
  commands: string[];
  usageCount: number;
  lastUsed: number;
  projectPath?: string;
}

export interface MemoryData {
  version: string;
  history: CommandHistoryEntry[];
  workflows: LearnedWorkflow[];
  aliases: Record<string, string>;
}
