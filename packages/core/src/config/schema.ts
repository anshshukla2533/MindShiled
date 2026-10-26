/**
 * @license Apache-2.0
 * ShellMind Configuration Schema & Defaults
 */

import { ShellMindConfig } from '../types/index.js';

export const DEFAULT_SHELLMIND_CONFIG: ShellMindConfig = {
  version: '1.0.0',
  provider: {
    active: 'gemini',
    gemini: {
      model: 'gemini-3.1-flash-lite',
      temperature: 0.2,
    },
    openai: {
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
    },
    ollama: {
      endpoint: 'http://localhost:11434',
      model: 'llama3:latest',
    },
  },
  security: {
    enforceZeroAutoExecution: true,
    requireTypedConfirmationForCritical: true,
    blockedCommands: [
      ':(){ :|:& };:', // fork bomb
    ],
  },
  ui: {
    theme: 'dark',
    showExplanationByDefault: true,
    colorizedOutput: true,
  },
  telemetry: {
    enabled: false,
  },
};
