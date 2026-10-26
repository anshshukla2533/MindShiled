/**
 * @license Apache-2.0
 * ShellMind Context Types
 */

import { SystemContext } from '@shellmind/core';

export interface ContextCollectorOptions {
  cwd?: string;
  maxFilesScanned?: number;
  skipGit?: boolean;
}

export type { SystemContext };
