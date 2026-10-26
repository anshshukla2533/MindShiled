/**
 * @license Apache-2.0
 * ShellMind AI Prompt Templates & System Instructions
 */

import { CommandRequest, SystemContext } from '@shellmind/core';

export const SHELLMIND_SYSTEM_INSTRUCTION = `
You are ShellMind, an expert AI Terminal Copilot.
Your job is to translate natural language user intent into precise, production-ready, safe shell commands.

GUIDELINES:
1. Always generate commands tailored to the user's specific operating system and shell environment.
2. Favor modern, standard POSIX or platform-standard utilities (e.g. rg, find, awk, curl).
3. Do not assume destructive behavior unless explicitly requested by the user.
4. Output MUST be valid JSON adhering strictly to the required schema.
5. Provide a clear, concise 1-sentence explanation of what the command does.
6. Provide accurate risk evaluation (SAFE, MEDIUM, HIGH, CRITICAL).
7. If the request requires multiple steps, provide a multiStepPlan array.
`;

export function formatContextSummary(ctx: SystemContext): string {
  const parts: string[] = [
    `OS: ${ctx.os.platform} (${ctx.os.type} ${ctx.os.release}, ${ctx.os.arch})`,
    `Shell: ${ctx.shell}`,
    `CWD: ${ctx.currentDirectory}`,
    `User: ${ctx.user}`,
  ];

  if (ctx.git?.isRepo) {
    parts.push(`Git: branch=${ctx.git.branch || 'main'}, dirty=${ctx.git.statusSummary ? 'yes' : 'no'}`);
  }

  if (ctx.project?.manifestFiles?.length) {
    parts.push(`Project Files: ${ctx.project.manifestFiles.join(', ')}`);
  }

  if (ctx.tools) {
    const installed = Object.entries(ctx.tools)
      .filter(([_, v]) => Boolean(v))
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    if (installed) {
      parts.push(`Installed Tools: ${installed}`);
    }
  }

  return parts.join('\n');
}

export function buildGenerationPrompt(request: CommandRequest): string {
  return `
User Request: "${request.naturalLanguagePrompt}"

System Context:
${formatContextSummary(request.context)}

Generate a JSON object with:
{
  "command": "the exact shell command to execute",
  "explanation": "clear explanation of what it does",
  "risk": {
    "level": "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reasons": ["reason 1"],
    "requiresTypedConfirmation": boolean
  },
  "alternatives": [
    { "command": "alternative command", "description": "why use this" }
  ],
  "multiStepPlan": ["step 1", "step 2"] (optional),
  "safetyNotes": ["note 1"] (optional)
}
`;
}

export function buildExplanationPrompt(command: string, context?: SystemContext): string {
  return `
Command to Explain: "${command}"

${context ? `Context:\n${formatContextSummary(context)}` : ''}

Generate a JSON object with:
{
  "command": "${command}",
  "summary": "1-2 sentence high-level summary",
  "syntaxBreakdown": [
    { "token": "flag or argument", "description": "what this token specifies" }
  ],
  "risk": {
    "level": "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reasons": ["reason 1"],
    "requiresTypedConfirmation": boolean
  },
  "caveats": ["caveat or edge case"]
}
`;
}

export function buildDiagnosisPrompt(failedCommand: string, stderr: string, context?: SystemContext): string {
  return `
Failed Command: "${failedCommand}"
Captured Stderr:
${stderr}

${context ? `Context:\n${formatContextSummary(context)}` : ''}

Diagnose why this command failed and propose fixes.
Generate a JSON object with:
{
  "failedCommand": "${failedCommand}",
  "stderr": "${stderr.replace(/"/g, '\\"')}",
  "rootCause": "precise root cause explanation",
  "category": "permission" | "missing_dependency" | "syntax_error" | "network" | "resource_limit" | "other",
  "suggestedFixes": ["step 1 to fix", "step 2 to fix"],
  "repairedCommand": "the corrected command that will succeed"
}
`;
}
