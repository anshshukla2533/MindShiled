/**
 * @license Apache-2.0
 * ShellMind Plugin Architecture Types
 */

import { RiskAssessment, SystemContext } from '@shellmind/core';

export interface PluginContext {
  systemContext: SystemContext;
  currentCommand?: string;
}

export interface ValidationIssue {
  severity: 'warning' | 'error';
  message: string;
  suggestedCorrection?: string;
}

export interface ShellMindPlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetBinary: string;

  /**
   * Adds tool-specific metadata to system context
   */
  enrichContext?(context: SystemContext): Promise<Record<string, unknown>> | Record<string, unknown>;

  /**
   * Validates command safety specific to this tool
   */
  validateCommand?(command: string, context: SystemContext): ValidationIssue[];

  /**
   * Modifies or guides LLM prompts when this tool is in scope
   */
  promptGuidance?(): string;

  /**
   * Provides domain explanations for command flags
   */
  explainToken?(token: string): string | undefined;
}
