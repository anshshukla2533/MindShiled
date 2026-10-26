/**
 * @license Apache-2.0
 * ShellMind Event Bus and Lifecycle Hooks
 */

import { CommandPlan, CommandRequest, ExecutionResult, RiskAssessment } from './types/index.js';

export type ShellMindEventType =
  | 'beforeGenerate'
  | 'afterGenerate'
  | 'securityCheck'
  | 'confirmationRequested'
  | 'beforeExecute'
  | 'afterExecute'
  | 'errorDiagnosis';

export interface ShellMindEventDataMap {
  beforeGenerate: { request: CommandRequest };
  afterGenerate: { plan: CommandPlan };
  securityCheck: { command: string; risk: RiskAssessment };
  confirmationRequested: { plan: CommandPlan; userAccepted?: boolean };
  beforeExecute: { command: string };
  afterExecute: { result: ExecutionResult };
  errorDiagnosis: { failedCommand: string; stderr: string };
}

export type EventHandler<T extends ShellMindEventType> = (data: ShellMindEventDataMap[T]) => void | Promise<void>;

export class EventEmitter {
  private listeners: Map<ShellMindEventType, Set<EventHandler<any>>> = new Map();

  public on<T extends ShellMindEventType>(event: T, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(handler);
    return () => set.delete(handler);
  }

  public async emit<T extends ShellMindEventType>(event: T, data: ShellMindEventDataMap[T]): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of Array.from(handlers)) {
      try {
        await handler(data);
      } catch (err) {
        console.error(`[ShellMind Event Error: ${event}]`, err);
      }
    }
  }
}
