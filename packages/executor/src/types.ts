/**
 * @license Apache-2.0
 * ShellMind Execution Engine Types
 */

import { ExecutionResult } from '@shellmind/core';

export interface ExecuteOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export type { ExecutionResult };
