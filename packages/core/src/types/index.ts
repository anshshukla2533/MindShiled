/**
 * @license Apache-2.0
 * ShellMind Core Domain Types
 */

export type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';

export type AIProviderId = 'gemini' | 'openai' | 'ollama';

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  requiresTypedConfirmation: boolean;
  affectedPaths?: string[];
  destructiveFlags?: string[];
}

export interface CommandPlan {
  command: string;
  explanation: string;
  risk: RiskAssessment;
  alternatives?: Array<{
    command: string;
    description: string;
  }>;
  multiStepPlan?: string[];
  safetyNotes?: string[];
}

export interface CommandRequest {
  naturalLanguagePrompt: string;
  context: SystemContext;
  preferredShell?: ShellType;
}

export interface CommandExplanation {
  command: string;
  summary: string;
  syntaxBreakdown: Array<{
    token: string;
    description: string;
  }>;
  risk: RiskAssessment;
  caveats?: string[];
}

export interface ErrorDiagnosis {
  failedCommand: string;
  stderr: string;
  exitCode?: number;
  rootCause: string;
  category: 'permission' | 'missing_dependency' | 'syntax_error' | 'network' | 'resource_limit' | 'other';
  suggestedFixes: string[];
  repairedCommand?: string;
}

export interface SystemContext {
  os: {
    platform: string;
    release: string;
    arch: string;
    type: string;
  };
  shell: ShellType;
  currentDirectory: string;
  user: string;
  git?: {
    isRepo: boolean;
    branch?: string;
    statusSummary?: string;
    remoteOrigin?: string;
  };
  project?: {
    type?: string;
    manifestFiles: string[];
    packageJson?: {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    hasDockerfile: boolean;
    hasDockerCompose: boolean;
  };
  tools: {
    node?: string;
    python?: string;
    git?: string;
    docker?: string;
    pnpm?: string;
    aws?: string;
    kubectl?: string;
    terraform?: string;
  };
}

export interface ShellMindConfig {
  version: string;
  provider: {
    active: AIProviderId;
    gemini?: {
      model: string;
      temperature: number;
    };
    openai?: {
      apiKey?: string;
      model: string;
      baseUrl?: string;
    };
    ollama?: {
      endpoint: string;
      model: string;
    };
  };
  security: {
    enforceZeroAutoExecution: boolean;
    requireTypedConfirmationForCritical: boolean;
    blockedCommands: string[];
  };
  ui: {
    theme: 'dark' | 'light' | 'neon' | 'matrix';
    showExplanationByDefault: boolean;
    colorizedOutput: boolean;
  };
  telemetry: {
    enabled: boolean;
  };
}

export interface ExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  cancelled: boolean;
}

export interface MemoryRecord {
  id: string;
  timestamp: number;
  prompt?: string;
  command: string;
  directory: string;
  riskLevel: RiskLevel;
  exitCode?: number;
  frequency: number;
}
