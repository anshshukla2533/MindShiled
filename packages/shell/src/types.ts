/**
 * @license Apache-2.0
 * ShellMind Shell Integration Types
 */

import { ShellType } from '@shellmind/core';

export interface ShellProfileInfo {
  shell: ShellType;
  profilePath: string;
  isInstalled: boolean;
  aliasSnippet: string;
}

export interface ShellInstallResult {
  shell: ShellType;
  profilePath: string;
  success: boolean;
  message: string;
}
