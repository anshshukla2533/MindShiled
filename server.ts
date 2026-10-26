/**
 * @license Apache-2.0
 * ShellMind Server Entrypoint
 * Full-stack Express server bridging AI Studio, Vite dev middlewares, and ShellMind core packages.
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { ConfigManager, ShellMindOrchestrator } from './packages/core/src/index.js';
import { SecurityAnalyzer } from './packages/security/src/index.js';
import { ContextCollector } from './packages/context/src/index.js';
import { GeminiProvider } from './packages/ai/src/providers/gemini.js';
import { AIProviderFactory } from './packages/ai/src/factory.js';
import { ProcessExecutor } from './packages/executor/src/index.js';
import { PluginRegistry } from './packages/plugins/src/index.js';
import { MemoryStore } from './packages/memory/src/index.js';
import { ShellDetector, ShellInstaller } from './packages/shell/src/index.js';
import { DoctorCommand } from './packages/cli/src/commands/doctor.js';
import { runPhase1Tests } from './scripts/test-phase1.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Services
  const configManager = new ConfigManager();
  const securityAnalyzer = new SecurityAnalyzer();
  const executor = new ProcessExecutor();
  const pluginRegistry = new PluginRegistry();
  const memoryStore = new MemoryStore();
  const contextCollector = new ContextCollector();

  // 1. Get Live Environment Context
  app.get('/api/context', async (_req, res) => {
    try {
      const context = await contextCollector.collect();
      res.json(context);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Generate Command from Natural Language
  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { prompt, preferredShell } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        aiGenerator: {
          generate: req => provider.generateCommand(req),
        },
        executionEngine: executor,
      });

      const plan = await orchestrator.plan({
        naturalLanguagePrompt: prompt,
        context,
        preferredShell,
      });

      // Also validate with plugins
      const pluginIssues = pluginRegistry.validateCommand(plan.command, context);

      // Record to history memory
      memoryStore.recordCommand({
        prompt,
        command: plan.command,
        directory: context.currentDirectory,
        riskLevel: plan.risk.level,
        executed: false,
      });

      res.json({
        plan,
        pluginIssues,
      });
    } catch (err: any) {
      console.error('Error generating command:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Explain Command
  app.post('/api/ai/explain', async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const explanation = await provider.explainCommand(command, context);
      res.json(explanation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Diagnose Command Error
  app.post('/api/ai/diagnose', async (req, res) => {
    try {
      const { failedCommand, stderr } = req.body;
      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const diagnosis = await provider.diagnoseError(failedCommand, stderr || '', context);
      res.json(diagnosis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Evaluate Security of Any Command
  app.post('/api/security/evaluate', (req, res) => {
    try {
      const { command } = req.body;
      const assessment = securityAnalyzer.analyze(command || '');
      res.json(assessment);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Doctor System Diagnostics
  app.get('/api/doctor', async (_req, res) => {
    try {
      const checks = await DoctorCommand.run();
      const shell = ShellDetector.detect();
      const profile = ShellInstaller.getProfileInfo();

      res.json({
        checks,
        shell,
        profile,
        activeProvider: configManager.getConfig().provider.active,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Config Management
  app.get('/api/config', (_req, res) => {
    res.json(configManager.getConfig());
  });

  app.post('/api/config', (req, res) => {
    try {
      const updated = configManager.updateConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Plugins
  app.get('/api/plugins', (_req, res) => {
    res.json(pluginRegistry.getAll());
  });

  // 9. Memory & History
  app.get('/api/memory', (_req, res) => {
    res.json({
      history: memoryStore.getHistory(30),
      workflows: memoryStore.getWorkflows(),
      aliases: memoryStore.getAliases(),
    });
  });

  // 10. Run Phase 1 Tests
  app.get('/api/tests/run', async (_req, res) => {
    try {
      const results = await runPhase1Tests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Execute Command with Guardrails
  app.post('/api/execute', async (req, res) => {
    try {
      const { command, confirmed, typedConfirmationToken } = req.body;
      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        executionEngine: executor,
      });

      const result = await orchestrator.executeWithGuardrails(
        command,
        confirmed,
        typedConfirmationToken
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Serve Vite in development or static dist in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ShellMind Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start ShellMind server:', err);
  process.exit(1);
});
