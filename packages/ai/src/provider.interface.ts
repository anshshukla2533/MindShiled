/**
 * @license Apache-2.0
 * ShellMind AI Provider Interface
 */

import {
  AIProviderId,
  CommandExplanation,
  CommandPlan,
  CommandRequest,
  ErrorDiagnosis,
  SystemContext,
} from '@shellmind/core';

export interface IAIProvider {
  readonly id: AIProviderId;
  readonly name: string;

  /**
   * Generates a shell command plan from a natural language prompt with system context
   */
  generateCommand(request: CommandRequest): Promise<CommandPlan>;

  /**
   * Explains an existing command in plain English with syntax token breakdown
   */
  explainCommand(command: string, context?: SystemContext): Promise<CommandExplanation>;

  /**
   * Diagnoses a command failure by analyzing stderr and proposing fixes
   */
  diagnoseError(failedCommand: string, stderr: string, context?: SystemContext): Promise<ErrorDiagnosis>;
}
