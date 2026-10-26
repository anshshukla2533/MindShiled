/**
 * @license Apache-2.0
 * ShellMind Central Orchestrator
 * Coordinates context extraction, memory lookup, AI command generation,
 * strict security analysis, and safe execution guardrails.
 */

import {
  CommandPlan,
  CommandRequest,
  ExecutionResult,
  RiskAssessment,
  ShellMindConfig,
} from './types/index.js';
import { EventEmitter } from './events.js';
import { ConfigManager } from './config/manager.js';

export interface ISecurityEngine {
  analyze(command: string): RiskAssessment;
}

export interface IAICommandGenerator {
  generate(request: CommandRequest): Promise<CommandPlan>;
}

export interface IExecutionEngine {
  execute(command: string, options?: { timeoutMs?: number; cwd?: string }): Promise<ExecutionResult>;
}

export class ShellMindOrchestrator {
  public readonly events: EventEmitter;
  private configManager: ConfigManager;
  private securityEngine?: ISecurityEngine;
  private aiGenerator?: IAICommandGenerator;
  private executionEngine?: IExecutionEngine;

  constructor(
    configManager?: ConfigManager,
    services?: {
      securityEngine?: ISecurityEngine;
      aiGenerator?: IAICommandGenerator;
      executionEngine?: IExecutionEngine;
    }
  ) {
    this.events = new EventEmitter();
    this.configManager = configManager || new ConfigManager();
    if (services) {
      this.securityEngine = services.securityEngine;
      this.aiGenerator = services.aiGenerator;
      this.executionEngine = services.executionEngine;
    }
  }

  public setSecurityEngine(engine: ISecurityEngine): void {
    this.securityEngine = engine;
  }

  public setAIGenerator(generator: IAICommandGenerator): void {
    this.aiGenerator = generator;
  }

  public setExecutionEngine(engine: IExecutionEngine): void {
    this.executionEngine = engine;
  }

  public getConfig(): ShellMindConfig {
    return this.configManager.getConfig();
  }

  /**
   * Plans a natural language command into a shell command with security validation
   */
  public async plan(request: CommandRequest): Promise<CommandPlan> {
    await this.events.emit('beforeGenerate', { request });

    if (!this.aiGenerator) {
      throw new Error('AI Generator service not configured on ShellMind Orchestrator');
    }

    const rawPlan = await this.aiGenerator.generate(request);

    // Defense-in-depth: run independent security analyzer over generated command
    let finalRisk = rawPlan.risk;
    if (this.securityEngine) {
      const independentRisk = this.securityEngine.analyze(rawPlan.command);
      // Take the most severe risk level
      finalRisk = this.pickHighestRisk(rawPlan.risk, independentRisk);
    }

    const validatedPlan: CommandPlan = {
      ...rawPlan,
      risk: finalRisk,
    };

    await this.events.emit('afterGenerate', { plan: validatedPlan });
    await this.events.emit('securityCheck', {
      command: validatedPlan.command,
      risk: validatedPlan.risk,
    });

    return validatedPlan;
  }

  /**
   * Safe execution entry point - verifies execution confirmation policy
   */
  public async executeWithGuardrails(
    command: string,
    confirmed: boolean,
    typedConfirmationToken?: string
  ): Promise<ExecutionResult> {
    const config = this.getConfig();

    if (config.security.enforceZeroAutoExecution && !confirmed) {
      throw new Error('Execution halted: ShellMind zero auto-execution policy requires user confirmation.');
    }

    if (this.securityEngine) {
      const risk = this.securityEngine.analyze(command);
      if (
        risk.level === 'CRITICAL' &&
        config.security.requireTypedConfirmationForCritical &&
        typedConfirmationToken !== 'CONFIRM'
      ) {
        throw new Error(
          'CRITICAL risk command requires typed confirmation: please type "CONFIRM" to proceed.'
        );
      }
    }

    if (!this.executionEngine) {
      throw new Error('Execution Engine service not configured on ShellMind Orchestrator');
    }

    await this.events.emit('beforeExecute', { command });
    const result = await this.executionEngine.execute(command);
    await this.events.emit('afterExecute', { result });

    return result;
  }

  private pickHighestRisk(a: RiskAssessment, b: RiskAssessment): RiskAssessment {
    const severityMap: Record<string, number> = {
      SAFE: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };

    const severityA = severityMap[a.level] ?? 0;
    const severityB = severityMap[b.level] ?? 0;

    if (severityB > severityA) {
      return {
        ...b,
        reasons: Array.from(new Set([...(a.reasons || []), ...(b.reasons || [])])),
      };
    }
    return {
      ...a,
      reasons: Array.from(new Set([...(a.reasons || []), ...(b.reasons || [])])),
    };
  }
}
