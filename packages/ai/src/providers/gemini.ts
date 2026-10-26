/**
 * @license Apache-2.0
 * ShellMind Gemini AI Provider
 * Integrates with Google Gen AI SDK (@google/genai)
 */

import { GoogleGenAI } from '@google/genai';
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

export class GeminiProvider implements IAIProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini (gemini-3.1-flash-lite)';
  private ai?: GoogleGenAI;
  private modelName: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.modelName = options?.model || 'gemini-3.1-flash-lite';
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && !apiKey.startsWith('MY_') && apiKey.length > 15) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public async generateCommand(request: CommandRequest): Promise<CommandPlan> {
    if (!this.ai) {
      return this.fallbackGenerate(request);
    }

    try {
      const prompt = buildGenerationPrompt(request);
      const executeCall = async (model: string) => {
        return this.ai!.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 5s')), 5000)
      );

      let response;
      try {
        response = await Promise.race([executeCall(this.modelName), timeoutPromise]);
      } catch (err: any) {
        if (err?.message?.includes('503') || err?.status === 503) {
          console.warn('[Gemini 503 spike, falling back to gemini-3.1-flash-lite]');
          response = await Promise.race([executeCall('gemini-3.1-flash-lite'), timeoutPromise]);
        } else {
          throw err;
        }
      }

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      return {
        command: parsed.command || this.fallbackGenerate(request).command,
        explanation: parsed.explanation || 'Generated shell command',
        risk: {
          level: parsed.risk?.level || 'SAFE',
          reasons: parsed.risk?.reasons || ['Evaluated by Gemini'],
          requiresTypedConfirmation: parsed.risk?.requiresTypedConfirmation || false,
        },
        alternatives: parsed.alternatives || [],
        multiStepPlan: parsed.multiStepPlan,
        safetyNotes: parsed.safetyNotes,
      };
    } catch (err) {
      console.warn('[ShellMind GeminiProvider Error, using heuristic fallback]:', err);
      return this.fallbackGenerate(request);
    }
  }

  public async explainCommand(command: string, context?: SystemContext): Promise<CommandExplanation> {
    if (!this.ai) {
      return this.fallbackExplain(command);
    }

    try {
      const prompt = buildExplanationPrompt(command, context);
      const apiCall = this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API explain timed out after 3.5s')), 3500)
      );

      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      return {
        command,
        summary: parsed.summary || `Explains: ${command}`,
        syntaxBreakdown: parsed.syntaxBreakdown || [],
        risk: parsed.risk || {
          level: 'SAFE',
          reasons: ['Command inspection'],
          requiresTypedConfirmation: false,
        },
        caveats: parsed.caveats,
      };
    } catch (err) {
      console.warn('[ShellMind GeminiProvider Explain Error]:', err);
      return this.fallbackExplain(command);
    }
  }

  public async diagnoseError(failedCommand: string, stderr: string, context?: SystemContext): Promise<ErrorDiagnosis> {
    if (!this.ai) {
      return this.fallbackDiagnose(failedCommand, stderr);
    }

    try {
      const prompt = buildDiagnosisPrompt(failedCommand, stderr, context);
      const apiCall = this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API diagnose timed out after 3.5s')), 3500)
      );

      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.text?.trim() || '{}';
      return JSON.parse(text);
    } catch (err) {
      console.warn('[ShellMind GeminiProvider Diagnosis Error]:', err);
      return this.fallbackDiagnose(failedCommand, stderr);
    }
  }

  // Robust heuristic fallback when offline or when no API key is provided
  private fallbackGenerate(request: CommandRequest): CommandPlan {
    const prompt = request.naturalLanguagePrompt.toLowerCase();

    if (prompt.includes('pdf') && prompt.includes('20mb')) {
      return {
        command: 'find . -type f -name "*.pdf" -size +20M',
        explanation: 'Finds all PDF files in the current directory and subdirectories larger than 20 megabytes.',
        risk: {
          level: 'SAFE',
          reasons: ['Read-only search operation that does not alter disk state.'],
          requiresTypedConfirmation: false,
        },
        alternatives: [
          {
            command: 'fd -e pdf --size +20m',
            description: 'Faster alternative using modern fd-find utility.',
          },
        ],
      };
    }

    if (prompt.includes('delete node_modules') || prompt.includes('remove node_modules')) {
      return {
        command: 'find . -name "node_modules" -type d -prune -exec rm -rf {} +',
        explanation: 'Recursively finds and deletes all node_modules dependency directories.',
        risk: {
          level: 'MEDIUM',
          reasons: ['Deletes directory trees and cache artifacts.'],
          requiresTypedConfirmation: false,
        },
        alternatives: [
          {
            command: 'rm -rf node_modules',
            description: 'Deletes only top-level node_modules.',
          },
        ],
      };
    }

    if (prompt.includes('compress') && prompt.includes('png')) {
      return {
        command: 'find . -name "*.png" -exec pngquant --ext .png --force 256 {} \\;',
        explanation: 'Finds and losslessly compresses every PNG file in place using pngquant.',
        risk: {
          level: 'MEDIUM',
          reasons: ['Overwrites existing image files with compressed versions.'],
          requiresTypedConfirmation: false,
        },
        alternatives: [
          {
            command: 'oxipng -o 4 --strip all **/*.png',
            description: 'Uses multithreaded oxipng optimizer.',
          },
        ],
      };
    }

    // 1. "create a folder <X> and inside it create a file <Y>"
    const folderAndFileMatch = request.naturalLanguagePrompt.match(
      /(?:create|make)\s+(?:a\s+)?(?:folder|dir|directory)\s+([a-zA-Z0-9_.-]+)\s+(?:and\s+)?(?:inside\s+(?:it\s+)?)?(?:create|make|touch|add)\s+(?:a\s+)?(?:file\s+)?([a-zA-Z0-9_.-]+)/i
    );
    if (folderAndFileMatch) {
      const folder = folderAndFileMatch[1];
      const file = folderAndFileMatch[2];
      return {
        command: `mkdir -p ${folder} && touch ${folder}/${file}`,
        explanation: `Creates folder '${folder}' and creates file '${file}' inside it.`,
        risk: {
          level: 'SAFE',
          reasons: ['Creates local directory and empty file.'],
          requiresTypedConfirmation: false,
        },
        alternatives: [
          {
            command: `mkdir -p ${folder}/${file}`,
            description: 'Direct path creation (if supported)',
          },
        ],
      };
    }

    // 2. "create folder <X>"
    const folderMatch = request.naturalLanguagePrompt.match(
      /(?:create|make)\s+(?:a\s+)?(?:folder|dir|directory)\s+([a-zA-Z0-9_.-]+)/i
    );
    if (folderMatch) {
      const folder = folderMatch[1];
      return {
        command: `mkdir -p ${folder}`,
        explanation: `Creates directory '${folder}' (including parent directories if missing).`,
        risk: {
          level: 'SAFE',
          reasons: ['Creates directory.'],
          requiresTypedConfirmation: false,
        },
      };
    }

    // 3. "create file <Y>"
    const fileMatch = request.naturalLanguagePrompt.match(
      /(?:create|touch|make)\s+(?:a\s+)?(?:file\s+)?([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/i
    );
    if (fileMatch) {
      const file = fileMatch[1];
      return {
        command: `touch ${file}`,
        explanation: `Creates new empty file '${file}'.`,
        risk: {
          level: 'SAFE',
          reasons: ['Creates empty file in working directory.'],
          requiresTypedConfirmation: false,
        },
      };
    }

    // 4. "kill port <port>"
    const portMatch = request.naturalLanguagePrompt.match(/kill\s+(?:process\s+on\s+)?(?:port\s+)?(\d{2,5})/i);
    if (portMatch) {
      const port = portMatch[1];
      return {
        command: `lsof -ti:${port} | xargs kill -9`,
        explanation: `Finds the process PID bound to TCP port ${port} and terminates it.`,
        risk: {
          level: 'HIGH',
          reasons: ['Terminates active process running on target port.'],
          requiresTypedConfirmation: false,
        },
      };
    }

    // 5. Common system queries
    if (/list\s+(all\s+)?files|show\s+files/i.test(prompt)) {
      return {
        command: 'ls -la',
        explanation: 'Lists all files including hidden dotfiles with size and permission details.',
        risk: { level: 'SAFE', reasons: ['Read-only file listing.'], requiresTypedConfirmation: false },
      };
    }

    if (/git\s+status|check\s+git/i.test(prompt)) {
      return {
        command: 'git status',
        explanation: 'Inspects active branch and uncommitted modifications in repository.',
        risk: { level: 'SAFE', reasons: ['Read-only git status check.'], requiresTypedConfirmation: false },
      };
    }

    if (/docker\s+ps|running\s+containers/i.test(prompt)) {
      return {
        command: 'docker ps',
        explanation: 'Lists all active running Docker containers.',
        risk: { level: 'SAFE', reasons: ['Read-only container inspection.'], requiresTypedConfirmation: false },
      };
    }

    if (/disk\s+space|check\s+disk/i.test(prompt)) {
      return {
        command: 'df -h',
        explanation: 'Displays disk usage and available space in human-readable format.',
        risk: { level: 'SAFE', reasons: ['Read-only filesystem report.'], requiresTypedConfirmation: false },
      };
    }

    // 6. Generic token builder if no exact pattern matched
    const words = request.naturalLanguagePrompt.split(/\s+/).filter(w => !/^(please|can|you|how|to|the|a|an|for|in|on|at|of)$/i.test(w));
    const commandCandidate = words.join(' ');

    return {
      command: commandCandidate,
      explanation: `Proposed shell command for: "${request.naturalLanguagePrompt}"`,
      risk: {
        level: 'SAFE',
        reasons: ['Parsed from intent tokens.'],
        requiresTypedConfirmation: false,
      },
    };
  }

  private fallbackExplain(command: string): CommandExplanation {
    return {
      command,
      summary: `Executes shell command '${command}'`,
      syntaxBreakdown: command.split(' ').map((tok, idx) => ({
        token: tok,
        description: idx === 0 ? 'Primary command binary' : 'Option or parameter argument',
      })),
      risk: {
        level: command.includes('rm') ? 'HIGH' : 'SAFE',
        reasons: ['Heuristic explanation breakdown'],
        requiresTypedConfirmation: false,
      },
    };
  }

  private fallbackDiagnose(failedCommand: string, stderr: string): ErrorDiagnosis {
    const isEacces = /EACCES|permission denied/i.test(stderr);
    const isNotFound = /not found|command not found|ENOENT/i.test(stderr);

    if (isEacces) {
      return {
        failedCommand,
        stderr,
        category: 'permission',
        rootCause: 'Insufficient user permissions to write to target path or port.',
        suggestedFixes: [
          'Verify file permissions or ownership using ls -la',
          'Use sudo if administrative privileges are required',
          'Fix directory ownership with: sudo chown -R $USER <path>',
        ],
        repairedCommand: `sudo ${failedCommand}`,
      };
    }

    if (isNotFound) {
      return {
        failedCommand,
        stderr,
        category: 'missing_dependency',
        rootCause: 'Command or referenced executable is not in current $PATH.',
        suggestedFixes: [
          'Verify the executable is installed',
          'Check system package manager (e.g. brew, apt, npm -g)',
          'Ensure target directory is included in $PATH',
        ],
      };
    }

    return {
      failedCommand,
      stderr,
      category: 'other',
      rootCause: 'Non-zero exit code encountered during subprocess execution.',
      suggestedFixes: ['Inspect stderr log above for details', 'Run with verbose/debug flags enabled'],
    };
  }
}
