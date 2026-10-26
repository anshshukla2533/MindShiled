/**
 * @license Apache-2.0
 * ShellMind Main CLI Definition using Commander.js
 */

import { Command } from 'commander';
import { ConfigManager, ShellMindOrchestrator } from '@shellmind/core';
import { ContextCollector } from '@shellmind/context';
import { SecurityAnalyzer } from '@shellmind/security';
import { AIProviderFactory } from '@shellmind/ai';
import { ProcessExecutor } from '@shellmind/executor';
import { ShellInstaller } from '@shellmind/shell';
import { DoctorCommand } from './commands/doctor.js';
import { colors, formatCommandCard, badge } from './ui/colors.js';

export function createCLI(): Command {
  const program = new Command();
  const configManager = new ConfigManager();
  const securityAnalyzer = new SecurityAnalyzer();
  const executor = new ProcessExecutor();

  program
    .name('ai')
    .description('ShellMind — AI Terminal Copilot (Seamless Shell Integration)')
    .version('0.1.0');

  // Natural language command generation (Default command)
  program
    .argument('[prompt...]', 'Natural language description of what you want to do')
    .action(async (promptParts: string[]) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        program.help();
        return;
      }

      const collector = new ContextCollector();
      const context = await collector.collect();
      const config = configManager.getConfig();
      const aiProvider = AIProviderFactory.create(config);

      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        aiGenerator: {
          generate: (req: any) => aiProvider.generateCommand(req),
        },
        executionEngine: executor,
      });

      console.log(`\n${colors.cyan}●${colors.reset} Generating command for: "${prompt}"...`);
      const plan = await orchestrator.plan({
        naturalLanguagePrompt: prompt,
        context,
      });

      console.log(formatCommandCard(plan.command, plan.explanation, plan.risk.level));

      if (plan.risk.reasons.length > 0) {
        console.log(`${colors.dim}Security reasons:${colors.reset}`);
        plan.risk.reasons.forEach((r: string) => console.log(`  - ${r}`));
      }

      if (plan.alternatives && plan.alternatives.length > 0) {
        console.log(`\n${colors.dim}Alternatives:${colors.reset}`);
        plan.alternatives.forEach((alt: { command: string; description: string }) => {
          console.log(`  ${colors.bold}${alt.command}${colors.reset} — ${alt.description}`);
        });
      }

      console.log(`\n${colors.yellow}Proceed?${colors.reset} [Y] Execute  [N] Cancel  [E] Edit`);
    });

  // Explain command
  program
    .command('explain <command>')
    .description('Explain any shell command in plain English with syntax token breakdown')
    .action(async (cmd: string) => {
      const config = configManager.getConfig();
      const aiProvider = AIProviderFactory.create(config);
      const collector = new ContextCollector();
      const context = await collector.collect();

      console.log(`\n${colors.cyan}●${colors.reset} Analyzing command: "${cmd}"...`);
      const explanation = await aiProvider.explainCommand(cmd, context);

      console.log(`\n${colors.bold}Summary:${colors.reset} ${explanation.summary}`);
      console.log(`Risk: ${badge(explanation.risk.level, explanation.risk.level)}\n`);

      if (explanation.syntaxBreakdown.length > 0) {
        console.log(`${colors.bold}Syntax Breakdown:${colors.reset}`);
        explanation.syntaxBreakdown.forEach((tok: { token: string; description: string }) => {
          console.log(`  ${colors.cyan}${tok.token.padEnd(14)}${colors.reset} ${tok.description}`);
        });
      }
    });

  // Run command with explanation & risk check
  program
    .command('run <command>')
    .description('Run a shell command with real-time risk analysis and confirmation')
    .action(async (cmd: string) => {
      const analysis = securityAnalyzer.analyze(cmd);
      console.log(`\n${colors.bold}Command to run:${colors.reset} ${cmd}`);
      console.log(`Risk Assessment: ${badge(analysis.level, analysis.level)}`);
      analysis.reasons.forEach((r: string) => console.log(`  - ${r}`));

      if (analysis.level === 'CRITICAL') {
        console.log(`\n${colors.red}${colors.bold}CRITICAL COMMAND:${colors.reset} Type "CONFIRM" to proceed.`);
      } else {
        console.log(`\nExecute? [Y/n]`);
      }
    });

  // Doctor command
  program
    .command('doctor')
    .description('Diagnose installation health, shell integration, and provider connectivity')
    .action(async () => {
      console.log(`\n${colors.cyan}=== ShellMind Doctor Diagnosis ===${colors.reset}\n`);
      const checks = await DoctorCommand.run();
      checks.forEach(c => {
        const icon = c.status === 'ok' ? `${colors.green}✔ OK${colors.reset}` : `${colors.yellow}⚠ WARN${colors.reset}`;
        console.log(` ${icon}  ${colors.bold}${c.name.padEnd(26)}${colors.reset} ${c.details}`);
      });
      console.log('');
    });

  // Install shell integration
  program
    .command('install')
    .description('Automatically install alias ai="shellmind" and completion scripts to your shell profile')
    .action(async () => {
      console.log(`\n${colors.cyan}●${colors.reset} Detecting active shell and profile path...`);
      const res = await ShellInstaller.install();
      if (res.success) {
        console.log(`${colors.green}✔ ${res.message}${colors.reset}\n`);
      } else {
        console.log(`${colors.red}✖ ${res.message}${colors.reset}\n`);
      }
    });

  // Provider command
  const providerCmd = program.command('provider').description('View or switch active LLM provider');
  providerCmd
    .command('set <provider>')
    .description('Set active provider (gemini, openai, ollama)')
    .action((providerName: string) => {
      const valid = ['gemini', 'openai', 'ollama'];
      if (!valid.includes(providerName.toLowerCase())) {
        console.error(`Invalid provider '${providerName}'. Choose one of: ${valid.join(', ')}`);
        return;
      }
      configManager.setActiveProvider(providerName.toLowerCase() as any);
      console.log(`${colors.green}✔ Active provider set to: ${providerName.toLowerCase()}${colors.reset}`);
    });

  return program;
}
