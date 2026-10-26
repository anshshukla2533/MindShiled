/**
 * @license Apache-2.0
 * ShellMind OpenAI-Compatible Provider Adapter
 */

import {
  CommandExplanation,
  CommandPlan,
  CommandRequest,
  ErrorDiagnosis,
  SystemContext,
} from '@shellmind/core';
import { IAIProvider } from '../provider.interface.js';
import {
  SHELLMIND_SYSTEM_INSTRUCTION,
  buildDiagnosisPrompt,
  buildExplanationPrompt,
  buildGenerationPrompt,
} from '../prompts.js';

export class OpenAIProvider implements IAIProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI Compatible (gpt-4o)';
  private apiKey?: string;
  private model: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    this.model = options?.model || 'gpt-4o';
    this.baseUrl = options?.baseUrl || 'https://api.openai.com/v1';
  }

  public async generateCommand(request: CommandRequest): Promise<CommandPlan> {
    if (!this.apiKey) {
      return {
        command: `echo "OpenAI provider requires an API key. Run: ai config set provider.openai.apiKey <key>"`,
        explanation: 'Missing OpenAI API Key in configuration',
        risk: {
          level: 'SAFE',
          reasons: ['Configuration prompt'],
          requiresTypedConfirmation: false,
        },
      };
    }

    try {
      const prompt = buildGenerationPrompt(request);
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SHELLMIND_SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        command: parsed.command || 'echo "Command generation error"',
        explanation: parsed.explanation || 'Generated command',
        risk: parsed.risk || {
          level: 'SAFE',
          reasons: ['Evaluated by OpenAI'],
          requiresTypedConfirmation: false,
        },
        alternatives: parsed.alternatives || [],
        multiStepPlan: parsed.multiStepPlan,
      };
    } catch (err) {
      console.error('[ShellMind OpenAIProvider Error]:', err);
      throw err;
    }
  }

  public async explainCommand(command: string, context?: SystemContext): Promise<CommandExplanation> {
    const prompt = buildExplanationPrompt(command, context);
    if (!this.apiKey) {
      return {
        command,
        summary: `Shell command: ${command}`,
        syntaxBreakdown: [],
        risk: { level: 'SAFE', reasons: [], requiresTypedConfirmation: false },
      };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SHELLMIND_SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || '{}');
  }

  public async diagnoseError(failedCommand: string, stderr: string, context?: SystemContext): Promise<ErrorDiagnosis> {
    const prompt = buildDiagnosisPrompt(failedCommand, stderr, context);
    if (!this.apiKey) {
      return {
        failedCommand,
        stderr,
        category: 'other',
        rootCause: 'Command execution returned non-zero code.',
        suggestedFixes: ['Inspect stderr output'],
      };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SHELLMIND_SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || '{}');
  }
}
