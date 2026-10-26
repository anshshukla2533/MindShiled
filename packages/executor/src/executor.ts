/**
 * @license Apache-2.0
 * ShellMind Process Execution Engine
 */

import { ExecutionResult } from '@shellmind/core';
import { ExecuteOptions } from './types.js';

export class ProcessExecutor {
  public async execute(command: string, options: ExecuteOptions = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 30000;
    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    if (!isNode) {
      // Browser simulator execution
      return this.simulateBrowserExecution(command, startTime);
    }

    try {
      const cp = await import('node:child_process');
      return await new Promise<ExecutionResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let timer: NodeJS.Timeout | null = null;
        let killed = false;

        const child = cp.spawn(command, {
          shell: true,
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...(options.env || {}) },
        });

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
          }, timeoutMs);
        }

        child.stdout?.on('data', (data) => {
          const str = data.toString();
          stdout += str;
          options.onStdoutChunk?.(str);
        });

        child.stderr?.on('data', (data) => {
          const str = data.toString();
          stderr += str;
          options.onStderrChunk?.(str);
        });

        child.on('close', (code) => {
          if (timer) clearTimeout(timer);
          resolve({
            command,
            exitCode: code ?? (killed ? 143 : 1),
            stdout,
            stderr,
            durationMs: Date.now() - startTime,
            cancelled: killed,
          });
        });

        child.on('error', (err) => {
          if (timer) clearTimeout(timer);
          resolve({
            command,
            exitCode: 1,
            stdout,
            stderr: `${stderr}\n${err.message}`.trim(),
            durationMs: Date.now() - startTime,
            cancelled: false,
          });
        });
      });
    } catch (err: any) {
      return {
        command,
        exitCode: 1,
        stdout: '',
        stderr: err?.message || 'Execution failed',
        durationMs: Date.now() - startTime,
        cancelled: false,
      };
    }
  }

  private simulateBrowserExecution(command: string, startTime: number): ExecutionResult {
    return {
      command,
      exitCode: 0,
      stdout: `[ShellMind Executed successfully in simulation environment]:\n$ ${command}\nDone in 42ms.`,
      stderr: '',
      durationMs: Date.now() - startTime,
      cancelled: false,
    };
  }
}
