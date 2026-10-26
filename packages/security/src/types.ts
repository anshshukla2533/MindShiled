/**
 * @license Apache-2.0
 * ShellMind Security Types
 */

import { RiskLevel, RiskAssessment } from '@shellmind/core';

export interface SecurityRule {
  id: string;
  name: string;
  pattern: RegExp | ((command: string) => boolean);
  level: RiskLevel;
  reason: string;
  requiresTypedConfirmation?: boolean;
}

export interface SecurityAnalysisResult extends RiskAssessment {
  matchedRuleIds: string[];
}
