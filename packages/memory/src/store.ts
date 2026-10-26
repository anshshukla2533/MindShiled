/**
 * @license Apache-2.0
 * ShellMind Memory Store
 * Manages persistent history, frequent patterns, and learned workflows
 */

import { CommandHistoryEntry, LearnedWorkflow, MemoryData } from './types.js';

export class MemoryStore {
  private data: MemoryData;

  constructor(initialData?: Partial<MemoryData>) {
    this.data = {
      version: '1.0.0',
      history: initialData?.history || [
        {
          id: 'hist-1',
          timestamp: Date.now() - 3600000,
          prompt: 'find every pdf larger than 20MB',
          command: 'find . -type f -name "*.pdf" -size +20M',
          directory: '/workspace/docs',
          riskLevel: 'SAFE',
          executed: true,
          exitCode: 0,
        },
        {
          id: 'hist-2',
          timestamp: Date.now() - 1800000,
          prompt: 'delete node_modules',
          command: 'find . -name "node_modules" -type d -prune -exec rm -rf {} +',
          directory: '/workspace/applet',
          riskLevel: 'MEDIUM',
          executed: true,
          exitCode: 0,
        },
      ],
      workflows: initialData?.workflows || [
        {
          phrase: 'start backend',
          commands: ['cd backend', 'pnpm install', 'pnpm dev'],
          usageCount: 14,
          lastUsed: Date.now() - 600000,
        },
        {
          phrase: 'ship release',
          commands: ['pnpm lint', 'pnpm test', 'git push origin main'],
          usageCount: 8,
          lastUsed: Date.now() - 1200000,
        },
      ],
      aliases: initialData?.aliases || {
        gco: 'git checkout',
        dcu: 'docker compose up -d',
      },
    };
  }

  public getHistory(limit = 50): CommandHistoryEntry[] {
    return this.data.history.slice(-limit);
  }

  public recordCommand(entry: Omit<CommandHistoryEntry, 'id' | 'timestamp'>): CommandHistoryEntry {
    const fullEntry: CommandHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    this.data.history.push(fullEntry);
    this.detectWorkflowPattern(fullEntry);
    return fullEntry;
  }

  public getWorkflows(): LearnedWorkflow[] {
    return [...this.data.workflows];
  }

  public findWorkflow(phrase: string): LearnedWorkflow | undefined {
    const norm = phrase.trim().toLowerCase();
    return this.data.workflows.find(w => w.phrase.toLowerCase() === norm);
  }

  public learnWorkflow(phrase: string, commands: string[]): LearnedWorkflow {
    const existing = this.findWorkflow(phrase);
    if (existing) {
      existing.commands = commands;
      existing.usageCount++;
      existing.lastUsed = Date.now();
      return existing;
    }
    const newWf: LearnedWorkflow = {
      phrase,
      commands,
      usageCount: 1,
      lastUsed: Date.now(),
    };
    this.data.workflows.push(newWf);
    return newWf;
  }

  public getAliases(): Record<string, string> {
    return { ...this.data.aliases };
  }

  public setAlias(key: string, command: string): void {
    this.data.aliases[key] = command;
  }

  private detectWorkflowPattern(entry: CommandHistoryEntry): void {
    if (!entry.prompt) return;
    const prompt = entry.prompt.trim().toLowerCase();
    const wf = this.findWorkflow(prompt);
    if (wf) {
      wf.usageCount++;
      wf.lastUsed = Date.now();
    }
  }
}
