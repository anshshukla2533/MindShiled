/**
 * @license Apache-2.0
 * ShellMind Security Analyzer
 * Deterministic command risk classification & guardrail evaluator
 */

import { RiskLevel } from '@shellmind/core';
import { BUILTIN_SECURITY_RULES } from './rules.js';
import { SecurityAnalysisResult, SecurityRule } from './types.js';

export class SecurityAnalyzer {
  private rules: SecurityRule[];

  constructor(customRules: SecurityRule[] = []) {
    this.rules = [...BUILTIN_SECURITY_RULES, ...customRules];
  }

  public analyze(command: string): SecurityAnalysisResult {
    const trimmed = (command || '').trim();
    if (!trimmed) {
      return {
        level: 'SAFE',
        reasons: ['Empty command string'],
        requiresTypedConfirmation: false,
        matchedRuleIds: [],
      };
    }

    const matchedRules: SecurityRule[] = [];
    const reasons: string[] = [];
    let highestLevel: RiskLevel = 'SAFE';
    let requiresTypedConfirmation = false;

    // Check each rule against command
    for (const rule of this.rules) {
      let isMatch = false;
      if (typeof rule.pattern === 'function') {
        isMatch = rule.pattern(trimmed);
      } else {
        isMatch = rule.pattern.test(trimmed);
      }

      if (isMatch) {
        matchedRules.push(rule);
        reasons.push(rule.reason);
        if (rule.requiresTypedConfirmation) {
          requiresTypedConfirmation = true;
        }

        if (this.compareRisk(rule.level, highestLevel) > 0) {
          highestLevel = rule.level;
        }
      }
    }

    // Secondary heuristic checks
    if (this.hasSudoEscalation(trimmed)) {
      reasons.push('Elevated privileges: command invokes sudo / superuser rights.');
      if (highestLevel === 'SAFE') {
        highestLevel = 'MEDIUM';
      } else if (highestLevel === 'MEDIUM') {
        highestLevel = 'HIGH';
      }
    }

    // Default classification if no rules matched
    if (matchedRules.length === 0) {
      // If it modifies files or runs stateful tools, default to MEDIUM, else SAFE
      if (/(\binstall\b|\bmkdir\b|\btouch\b|\bcp\b|\bmv\b|\bset\b|\bexport\b)/i.test(trimmed)) {
        highestLevel = 'MEDIUM';
        reasons.push('Modifies local files or environment variables.');
      } else {
        highestLevel = 'SAFE';
        reasons.push('Standard shell execution with no high-risk markers detected.');
      }
    }

    // If critical level, enforce typed confirmation token
    if (highestLevel === 'CRITICAL') {
      requiresTypedConfirmation = true;
    }

    return {
      level: highestLevel,
      reasons: Array.from(new Set(reasons)),
      requiresTypedConfirmation,
      matchedRuleIds: matchedRules.map(r => r.id),
      destructiveFlags: this.extractDestructiveFlags(trimmed),
    };
  }

  private hasSudoEscalation(command: string): boolean {
    return /\b(sudo|doas|runas)\b/i.test(command);
  }

  private extractDestructiveFlags(command: string): string[] {
    const flags: string[] = [];
    const matches = command.match(/--[a-z0-9-]+|-[a-zA-Z]+/g);
    if (matches) {
      for (const m of matches) {
        if (/(-f|--force|-r|-R|--all|--prune|--hard)/i.test(m)) {
          flags.push(m);
        }
      }
    }
    return flags;
  }

  private compareRisk(a: RiskLevel, b: RiskLevel): number {
    const weights: Record<RiskLevel, number> = {
      SAFE: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };
    return (weights[a] ?? 0) - (weights[b] ?? 0);
  }
}
