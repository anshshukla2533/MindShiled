/**
 * @license Apache-2.0
 * ShellMind Phase 1 Test Suite
 * Verifies clean architecture, security categorization, config management, and guardrails.
 */

import { ConfigManager, ShellMindOrchestrator } from '../packages/core/src/index.js';
import { SecurityAnalyzer } from '../packages/security/src/index.js';
import { PluginRegistry } from '../packages/plugins/src/index.js';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export async function runPhase1Tests(): Promise<{ passed: boolean; results: TestResult[] }> {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, failMessage?: string) {
    const t0 = performance.now();
    results.push({
      suite,
      name,
      passed: Boolean(condition),
      message: condition ? undefined : failMessage || 'Assertion failed',
      durationMs: Math.round((performance.now() - t0) * 100) / 100,
    });
  }

  // --- Suite 1: Security Risk Analyzer ---
  const analyzer = new SecurityAnalyzer();

  const safeRes = analyzer.analyze('ls -la /tmp');
  assert('SecurityAnalyzer', 'Categorizes "ls -la /tmp" as SAFE', safeRes.level === 'SAFE' && !safeRes.requiresTypedConfirmation);

  const gitStatRes = analyzer.analyze('git status');
  assert('SecurityAnalyzer', 'Categorizes "git status" as SAFE', gitStatRes.level === 'SAFE');

  const medRes = analyzer.analyze('docker compose down');
  assert('SecurityAnalyzer', 'Categorizes "docker compose down" as MEDIUM', medRes.level === 'MEDIUM');

  const highRes = analyzer.analyze('chmod -R 777 /var/www');
  assert('SecurityAnalyzer', 'Categorizes "chmod -R 777" as HIGH', highRes.level === 'HIGH');

  const gitResetRes = analyzer.analyze('git reset --hard HEAD~1');
  assert('SecurityAnalyzer', 'Categorizes "git reset --hard" as HIGH', gitResetRes.level === 'HIGH');

  const critRootRes = analyzer.analyze('sudo rm -rf /');
  assert(
    'SecurityAnalyzer',
    'Categorizes "sudo rm -rf /" as CRITICAL with typed confirmation required',
    critRootRes.level === 'CRITICAL' && critRootRes.requiresTypedConfirmation
  );

  const mkfsRes = analyzer.analyze('mkfs.ext4 /dev/sdb1');
  assert('SecurityAnalyzer', 'Categorizes "mkfs.ext4" as CRITICAL', mkfsRes.level === 'CRITICAL' && mkfsRes.requiresTypedConfirmation);

  const forkbombRes = analyzer.analyze(':(){ :|:& };:');
  assert('SecurityAnalyzer', 'Detects fork bomb as CRITICAL', forkbombRes.level === 'CRITICAL' && forkbombRes.requiresTypedConfirmation);

  // --- Suite 2: Config Manager ---
  const configManager = new ConfigManager();
  const cfg = configManager.getConfig();
  assert('ConfigManager', 'Defaults active provider to gemini', cfg.provider.active === 'gemini');
  assert('ConfigManager', 'Enforces zero auto execution by default', cfg.security.enforceZeroAutoExecution === true);

  configManager.setActiveProvider('ollama');
  assert('ConfigManager', 'Switches active provider to ollama', configManager.getConfig().provider.active === 'ollama');

  // --- Suite 3: Orchestrator Zero-Auto-Execution Guardrails ---
  const orchestrator = new ShellMindOrchestrator(configManager, {
    securityEngine: analyzer,
    executionEngine: {
      execute: async (cmd: string) => ({
        command: cmd,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        durationMs: 10,
        cancelled: false,
      }),
    },
  });

  let blocked = false;
  try {
    await orchestrator.executeWithGuardrails('echo test', false);
  } catch {
    blocked = true;
  }
  assert('Orchestrator Guardrails', 'Blocks unconfirmed command execution', blocked);

  let critBlocked = false;
  try {
    await orchestrator.executeWithGuardrails('sudo rm -rf /', true, 'INVALID_TOKEN');
  } catch {
    critBlocked = true;
  }
  assert('Orchestrator Guardrails', 'Requires typed token "CONFIRM" for CRITICAL execution', critBlocked);

  // --- Suite 4: Plugin System ---
  const registry = new PluginRegistry();
  const plugins = registry.getAll();
  assert('PluginRegistry', 'Registers 7 builtin plugins (git, docker, node, python, aws, kubectl, terraform)', plugins.length === 7);

  const mockCtx = {
    os: { platform: 'linux', release: '6.0', arch: 'x64', type: 'Linux' },
    shell: 'zsh' as const,
    currentDirectory: '/app',
    user: 'test',
    tools: {},
  };
  const gitIssues = registry.validateCommand('git push origin main --force', mockCtx);
  assert('PluginRegistry', 'Git plugin catches destructive force push', gitIssues.length > 0 && gitIssues[0].severity === 'warning');

  const allPassed = results.every(r => r.passed);
  return { passed: allPassed, results };
}

// When run directly with tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-phase1')) {
  runPhase1Tests().then(({ passed, results }) => {
    console.log('\n--- ShellMind Phase 1 Test Results ---');
    results.forEach(r => {
      console.log(`${r.passed ? '✔ PASS' : '✖ FAIL'} [${r.suite}] ${r.name} (${r.durationMs}ms)`);
      if (!r.passed && r.message) {
        console.log(`    Error: ${r.message}`);
      }
    });
    console.log(`\nSummary: ${results.filter(r => r.passed).length}/${results.length} passed.\n`);
    if (!passed) process.exit(1);
  });
}
